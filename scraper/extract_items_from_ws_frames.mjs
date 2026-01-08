// scraper/extract_items_from_ws_frames.mjs
// Robust extractor for Blazor Server / SignalR WS captures.
// Supports:
//   - SignalR JSON protocol (text frames, 0x1e separated)
//   - SignalR MessagePack protocol (binary frames, varint-length-prefixed)
// Also searches invocation messages (arguments) for item-like arrays.
//
// Input:  data/explorer.ws.frames.json
// Output: data/toolbox.items.json
// Debug:  data/_debug_ws_decoded.json, data/_debug_ws_messages.sample.json

import fs from "fs/promises";
import path from "path";
import { decode as msgpackDecode } from "@msgpack/msgpack";

const IN_WS = "data/explorer.ws.frames.json";
const OUT_ITEMS = "data/toolbox.items.json";
const OUT_DEBUG = "data/_debug_ws_decoded.json";
const OUT_SAMPLE = "data/_debug_ws_messages.sample.json";

const BASE = "https://evertaletoolbox2.runasp.net";
const SOURCE_URL = `${BASE}/Explorer`;

const RS = String.fromCharCode(0x1e);

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function toAbsUrl(u) {
  if (!u) return null;
  const s = String(u);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return BASE + s;
  return s;
}

// ---------- SignalR helpers ----------

// SignalR MessagePack frames are varint-length-prefixed chunks.
// Each chunk is a message.
function splitVarintLengthPrefixed(buffer) {
  const chunks = [];
  let offset = 0;

  while (offset < buffer.length) {
    let length = 0;
    let shift = 0;
    let b = 0;

    do {
      if (offset >= buffer.length) return chunks;
      b = buffer[offset++];
      length |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);

    if (length <= 0) continue;
    if (offset + length > buffer.length) break;

    chunks.push(buffer.subarray(offset, offset + length));
    offset += length;
  }
  return chunks;
}

// Text protocol messages are separated by 0x1e record separator.
function splitTextMessages(text) {
  const parts = text.split(RS).map(p => p.trim()).filter(Boolean);
  return parts;
}

// Try JSON parse safely
function tryJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// ---------- Item detection + extraction ----------

function looksItemish(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

  const keys = Object.keys(obj).map(k => k.toLowerCase());
  const hasName =
    keys.includes("name") || keys.includes("title") || keys.includes("displayname");
  const hasType =
    keys.includes("type") || keys.includes("category") || keys.includes("kind");
  const hasImg =
    keys.some(k => k.includes("image") || k.includes("icon") || k.includes("portrait"));
  const hasStats =
    keys.includes("atk") || keys.includes("hp") || keys.includes("spd") || keys.includes("cost") || keys.includes("element");

  return hasName && (hasType || hasImg || hasStats);
}

function scoreArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sample = arr.slice(0, Math.min(250, arr.length));
  const good = sample.filter(looksItemish).length;
  return good / sample.length;
}

// Search deep for arrays that contain item-like objects.
// Lower minLen because some payloads are chunked.
function findCandidateArrays(root, minLen = 10) {
  const out = [];
  const seen = new Set();

  function walk(v, p) {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);

    if (Array.isArray(v)) {
      if (v.length >= minLen) {
        const s = scoreArray(v);
        if (s >= 0.15) {
          out.push({ path: p, length: v.length, score: s, arr: v });
        }
      }
      // Walk a little inside
      for (let i = 0; i < Math.min(15, v.length); i++) {
        walk(v[i], `${p}[${i}]`);
      }
      return;
    }

    for (const [k, vv] of Object.entries(v)) {
      walk(vv, p ? `${p}.${k}` : k);
    }
  }

  walk(root, "");
  out.sort((a, b) => (b.score - a.score) || (b.length - a.length));
  return out;
}

function normalizeItem(obj) {
  if (!obj || typeof obj !== "object") return null;
  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));

  const name = lower.name ?? lower.displayname ?? lower.title ?? null;
  if (!name) return null;

  const id = String(lower.id ?? lower.uid ?? lower.key ?? lower.unitid ?? name);

  const category =
    (lower.category ?? lower.type ?? lower.kind ?? "")
      .toString()
      .toLowerCase()
      .trim() || "unknown";

  const image =
    lower.image ?? lower.imageurl ?? lower.icon ?? lower.iconurl ?? lower.portrait ?? lower.portraiturl ?? null;

  return {
    id: norm(id),
    name: norm(name),
    category,
    element: lower.element ?? null,
    cost: lower.cost ?? null,
    atk: lower.atk ?? lower.attack ?? null,
    hp: lower.hp ?? lower.health ?? null,
    spd: lower.spd ?? lower.speed ?? null,
    image: image ? toAbsUrl(image) : null,
    url: SOURCE_URL,
  };
}

// SignalR Invocation messages often store actual payload in "arguments"
function unwrapSignalRMessage(msg) {
  // JSON protocol message examples contain:
  // {type:1,target:"...",arguments:[...]}
  // or {type:6} ping, etc.
  if (!msg || typeof msg !== "object") return [msg];

  const out = [msg];

  if (Array.isArray(msg.arguments)) {
    for (let i = 0; i < msg.arguments.length; i++) {
      out.push(msg.arguments[i]);
    }
  }
  return out;
}

async function run() {
  const raw = JSON.parse(await fs.readFile(path.resolve(process.cwd(), IN_WS), "utf8"));
  const frames = raw.frames || raw.wsFrames || raw.data || [];
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error(`No frames found in ${IN_WS}`);
  }

  const decodedMessages = [];
  const debug = {
    scrapedAt: new Date().toISOString(),
    framesCount: frames.length,
    counts: {
      textFrames: 0,
      binaryFrames: 0,
      jsonMessages: 0,
      msgpackMessages: 0,
      msgpackDecodeFailures: 0,
    },
    bestCandidate: null,
    notes: [],
  };

  // 1) Decode text frames (SignalR JSON protocol)
  for (const f of frames) {
    if (f.type !== "text" && f.opcode !== 1 && !f.text) continue;

    debug.counts.textFrames++;
    const text = f.text ?? f.data ?? f.payload ?? "";
    if (!text) continue;

    for (const part of splitTextMessages(String(text))) {
      const obj = tryJsonParse(part);
      if (obj) {
        debug.counts.jsonMessages++;
        decodedMessages.push(obj);
      }
    }
  }

  // 2) Decode binary frames (SignalR MessagePack protocol)
  for (const f of frames) {
    if (f.type !== "binary" && f.opcode !== 2 && !f.base64) continue;

    debug.counts.binaryFrames++;
    const b64 = f.base64 ?? f.dataBase64 ?? f.payloadBase64 ?? null;
    if (!b64) continue;

    const buf = Buffer.from(b64, "base64");
    const chunks = splitVarintLengthPrefixed(buf);

    for (const c of chunks) {
      // Try MessagePack decode
      try {
        const obj = msgpackDecode(c);
        debug.counts.msgpackMessages++;
        decodedMessages.push(obj);
        continue;
      } catch {
        debug.counts.msgpackDecodeFailures++;
      }

      // Fallback: sometimes binary contains UTF-8 JSON protocol fragments
      try {
        const asText = c.toString("utf8");
        for (const part of splitTextMessages(asText)) {
          const obj = tryJsonParse(part);
          if (obj) {
            debug.counts.jsonMessages++;
            decodedMessages.push(obj);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // Save a sample of decoded messages for inspection
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_SAMPLE),
    JSON.stringify(decodedMessages.slice(0, 80), null, 2),
    "utf8"
  );

  // Build a list of "search roots": messages + unwrapped arguments
  const searchRoots = [];
  for (const m of decodedMessages) {
    for (const u of unwrapSignalRMessage(m)) searchRoots.push(u);
  }

  // Find best candidate array across all roots
  let best = null;

  for (let i = 0; i < searchRoots.length; i++) {
    const root = searchRoots[i];
    const cands = findCandidateArrays(root, 10);
    if (!cands.length) continue;

    const top = cands[0];
    const cand = {
      index: i,
      path: top.path,
      length: top.length,
      score: top.score,
      // keep only for selection; don’t write to debug huge
      arr: top.arr,
    };

    if (!best ||
        cand.score > best.score ||
        (cand.score === best.score && cand.length > best.length)) {
      best = cand;
    }
  }

  debug.bestCandidate = best
    ? { index: best.index, path: best.path, length: best.length, score: best.score }
    : null;

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_DEBUG),
    JSON.stringify(debug, null, 2),
    "utf8"
  );

  if (!best) {
    throw new Error(
      `No usable dataset array found in decoded WS payloads. Check ${OUT_DEBUG} and ${OUT_SAMPLE}.`
    );
  }

  const normalized = best.arr.map(normalizeItem).filter(Boolean);

  if (normalized.length < 25) {
    throw new Error(
      `Found a candidate array but normalized too small (${normalized.length}). Check ${OUT_SAMPLE}.`
    );
  }

  // Dedup by id
  const dedup = new Map();
  for (const it of normalized) dedup.set(it.id, it);

  const items = Array.from(dedup.values());

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_ITEMS),
    JSON.stringify({
      source: SOURCE_URL,
      generatedAt: new Date().toISOString(),
      picked: debug.bestCandidate,
      count: items.length,
      items,
    }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${OUT_ITEMS} items=${items.length}`);
  console.log(`Debug: ${OUT_DEBUG}`);
  console.log(`Sample: ${OUT_SAMPLE}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});