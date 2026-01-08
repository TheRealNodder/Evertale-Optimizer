// scraper/extract_items_from_ws_frames.mjs
// Read WS frames captured by scrape_explorer_capture_json.mjs and attempt to extract
// real datasets from SignalR MessagePack payloads.
//
// Inputs:
//   data/explorer.ws.frames.json
//
// Outputs:
//   data/toolbox.items.json
// Debug:
//   data/_debug_ws_decoded.json

import fs from "fs/promises";
import path from "path";
import { decode as msgpackDecode } from "@msgpack/msgpack";

const IN_WS = "data/explorer.ws.frames.json";
const OUT_ITEMS = "data/toolbox.items.json";
const OUT_DEBUG = "data/_debug_ws_decoded.json";

const BASE = "https://evertaletoolbox2.runasp.net";
const SOURCE_URL = `${BASE}/Explorer`;

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

// SignalR MessagePack frames are length-prefixed with a VarInt length
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

function isProbablyItem(obj) {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  const hasName = keys.includes("name") || keys.includes("title") || keys.includes("displayname");
  const hasType = keys.includes("type") || keys.includes("category") || keys.includes("kind");
  const hasImg = keys.some(k => k.includes("image") || k.includes("icon") || k.includes("portrait"));
  const hasStats = keys.includes("atk") || keys.includes("hp") || keys.includes("spd") || keys.includes("cost") || keys.includes("element");
  return hasName && (hasType || hasImg || hasStats);
}

function findBigArrays(x, minLen = 50) {
  const res = [];
  const seen = new Set();

  function walk(v, p) {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);

    if (Array.isArray(v)) {
      if (v.length >= minLen) {
        const sample = v.slice(0, 200);
        const good = sample.filter(isProbablyItem).length;
        const score = good / Math.max(1, sample.length);
        res.push({ path: p, length: v.length, score, arr: v });
      }
      for (let i = 0; i < Math.min(20, v.length); i++) walk(v[i], `${p}[${i}]`);
      return;
    }

    for (const [k, vv] of Object.entries(v)) {
      walk(vv, p ? `${p}.${k}` : k);
    }
  }

  walk(x, "");
  res.sort((a, b) => (b.score - a.score) || (b.length - a.length));
  return res;
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

async function run() {
  const wsJson = JSON.parse(await fs.readFile(path.resolve(process.cwd(), IN_WS), "utf8"));
  const frames = wsJson.frames || wsJson.wsFrames || wsJson.data || [];
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error(`No frames found in ${IN_WS}`);
  }

  const decoded = [];
  let totalChunks = 0;
  let decodedOk = 0;

  for (const f of frames) {
    if (f.type !== "binary" || !f.base64) continue;
    const buf = Buffer.from(f.base64, "base64");

    const chunks = splitVarintLengthPrefixed(buf);
    totalChunks += chunks.length;

    for (const c of chunks) {
      try {
        const obj = msgpackDecode(c);
        decodedOk++;
        decoded.push(obj);
      } catch {
        // ignore
      }
    }
  }

  // Try to find candidate arrays in decoded objects (often under Invocation.arguments)
  let best = null;

  for (let i = 0; i < decoded.length; i++) {
    const obj = decoded[i];

    // Search whole object
    const arrays = findBigArrays(obj, 50);
    if (!arrays.length) continue;

    const top = arrays[0];
    const cand = {
      index: i,
      path: top.path,
      length: top.length,
      score: top.score,
      arr: top.arr,
      // helpful for debugging:
      topKeys: obj && typeof obj === "object" && !Array.isArray(obj) ? Object.keys(obj).slice(0, 30) : null,
    };

    if (!best ||
        cand.score > best.score ||
        (cand.score === best.score && cand.length > best.length)) {
      best = cand;
    }
  }

  // Write debug no matter what
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_DEBUG),
    JSON.stringify({
      scrapedAt: new Date().toISOString(),
      framesCount: frames.length,
      decodedObjects: decoded.length,
      totalChunks,
      decodedOk,
      bestCandidate: best ? { index: best.index, path: best.path, length: best.length, score: best.score, topKeys: best.topKeys } : null,
    }, null, 2),
    "utf8"
  );

  if (!best) {
    throw new Error(`No usable dataset array found in decoded WS payloads. Check ${OUT_DEBUG}.`);
  }

  const normalized = best.arr.map(normalizeItem).filter(Boolean);

  if (normalized.length < 20) {
    throw new Error(`Found candidate array but normalized too small (${normalized.length}). Check ${OUT_DEBUG}.`);
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
      picked: { decodedIndex: best.index, path: best.path, length: best.length, score: best.score },
      count: items.length,
      items,
    }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${OUT_ITEMS} items=${items.length}`);
  console.log(`Debug: ${OUT_DEBUG}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});