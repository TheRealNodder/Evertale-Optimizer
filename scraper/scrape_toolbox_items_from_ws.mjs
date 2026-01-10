// scraper/scrape_toolbox_items_from_ws.mjs
// Captures Blazor/SignalR WS frames and tries to extract a large items dataset.
// Outputs: data/toolbox.items.json + debug files.

import fs from "fs";
import path from "path";
import process from "process";
import { chromium } from "playwright";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";

const OUT_DIR = path.resolve("data");
const OUT_ITEMS = path.join(OUT_DIR, "toolbox.items.json");

const DBG_FRAMES = path.join(OUT_DIR, "_debug_toolbox_ws_frames.json");
const DBG_DECODED = path.join(OUT_DIR, "_debug_toolbox_ws_decoded.json");
const DBG_HITS = path.join(OUT_DIR, "_debug_toolbox_ws_hits.json");

const TOOLBOX_URL =
  process.env.TOOLBOX_URL ||
  "https://evertaletoolbox2.runasp.net/Viewer"; // if Toolbox has a different route, set env TOOLBOX_URL in workflow

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function looksLikeBase64(s) {
  if (typeof s !== "string") return false;
  if (s.length < 40) return false;
  if (s.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(s);
}

function toBytes(payload) {
  // Playwright websocket payloads are strings; binary frames commonly arrive base64-encoded.
  if (Buffer.isBuffer(payload)) return new Uint8Array(payload);
  if (payload instanceof Uint8Array) return payload;
  if (typeof payload === "string") {
    if (looksLikeBase64(payload)) {
      try {
        return new Uint8Array(Buffer.from(payload, "base64"));
      } catch {}
    }
    // best effort: treat as utf8
    return new Uint8Array(Buffer.from(payload, "utf8"));
  }
  return null;
}

function safeJson(x) {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch {
    return null;
  }
}

function walkFindLargestArray(node, wantPredicate) {
  // returns {arr, path, score}
  const seen = new Set();
  let best = { arr: null, path: "", score: 0 };

  function rec(v, p) {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);

    if (Array.isArray(v)) {
      let score = v.length;

      if (v.length > 0 && wantPredicate) {
        // boost if many elements match
        let hit = 0;
        for (let i = 0; i < Math.min(v.length, 50); i++) {
          if (wantPredicate(v[i])) hit++;
        }
        score += hit * 5;
      }

      if (score > best.score) best = { arr: v, path: p, score };

      for (let i = 0; i < Math.min(v.length, 200); i++) {
        rec(v[i], `${p}[${i}]`);
      }
      return;
    }

    for (const [k, vv] of Object.entries(v)) {
      rec(vv, p ? `${p}.${k}` : k);
    }
  }

  rec(node, "");
  return best;
}

function itemLike(o) {
  if (!o || typeof o !== "object") return false;
  const s = JSON.stringify(o);
  // toolbox image paths or known fields often appear in these objects
  return (
    s.includes("/files/images/") ||
    "Name" in o ||
    "name" in o ||
    "Id" in o ||
    "id" in o ||
    "Element" in o ||
    "element" in o
  );
}

function normalizeRawItem(o) {
  // Very tolerant mapping (Toolbox/Blazor properties may be PascalCase)
  const get = (...keys) => {
    for (const k of keys) {
      if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    }
    return null;
  };

  const name = get("name", "Name", "UnitName", "Title");
  const id = get("id", "Id", "ID", "Key", "key") || name;
  const image =
    get("image", "Image", "imageUrl", "ImageUrl", "Icon", "icon") || null;

  const category =
    (get("category", "Category", "type", "Type") || "").toString().toLowerCase() ||
    null;

  const element = get("element", "Element") ?? null;
  const cost = get("cost", "Cost") ?? null;

  const atk = get("atk", "ATK", "Attack") ?? null;
  const hp = get("hp", "HP") ?? null;
  const spd = get("spd", "SPD", "Speed") ?? null;

  return {
    id: id ? String(id) : null,
    name: name ? String(name) : null,
    category,
    element,
    image,
    cost,
    atk,
    hp,
    spd,
    raw: o
  };
}

async function run() {
  ensureDir(OUT_DIR);

  const frames = [];
  const decodedMessages = [];
  const hits = [];

  const protocol = new MessagePackHubProtocol();
  const logger = { log: () => {} };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("websocket", (ws) => {
    ws.on("framereceived", (frame) => {
      frames.push({
        t: Date.now(),
        dir: "in",
        opcode: frame.opcode, // 'text' or 'binary' (Playwright sets this)
        len: frame.payload?.length ?? 0,
        payload: frame.payload
      });
    });
    ws.on("framesent", (frame) => {
      frames.push({
        t: Date.now(),
        dir: "out",
        opcode: frame.opcode,
        len: frame.payload?.length ?? 0,
        payload: frame.payload
      });
    });
  });

  console.log(`Loading Toolbox page: ${TOOLBOX_URL}`);
  await page.goto(TOOLBOX_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Give Blazor time to connect and stream
  await page.waitForTimeout(20000);

  // Save raw frames first
  fs.writeFileSync(DBG_FRAMES, JSON.stringify(frames, null, 2), "utf8");

  // Decode frames -> SignalR hub messages
  for (const f of frames) {
    // Only try decoding incoming frames (server -> client)
    if (f.dir !== "in") continue;

    const bytes = toBytes(f.payload);
    if (!bytes || bytes.length < 8) continue;

    try {
      const msgs = protocol.parseMessages(bytes, logger);
      for (const m of msgs) decodedMessages.push(m);
    } catch {
      // ignore non-signalr frames
    }
  }

  fs.writeFileSync(DBG_DECODED, JSON.stringify(safeJson(decodedMessages) ?? [], null, 2), "utf8");

  // Find best candidate dataset: usually inside Invocation arguments
  let best = { arr: null, path: "", score: 0, msgIndex: -1 };

  for (let i = 0; i < decodedMessages.length; i++) {
    const m = decodedMessages[i];
    const cand = walkFindLargestArray(m, itemLike);
    if (cand.arr && cand.score > best.score) {
      best = { ...cand, msgIndex: i };
    }
  }

  if (!best.arr || best.arr.length < 20) {
    // also try: search for any single string stream that contains /files/images/
    const jsonText = JSON.stringify(decodedMessages);
    const hasImages = jsonText.includes("/files/images/");
    fs.writeFileSync(
      DBG_HITS,
      JSON.stringify(
        {
          messageCount: decodedMessages.length,
          bestScore: best.score,
          bestMsgIndex: best.msgIndex,
          bestPath: best.path,
          bestLength: best.arr ? best.arr.length : 0,
          sawFilesImages: hasImages
        },
        null,
        2
      ),
      "utf8"
    );
    throw new Error(
      `No large dataset found in WS frames (best count=${best.arr ? best.arr.length : 0}). ` +
        `Check ${DBG_DECODED} and ${DBG_FRAMES}`
    );
  }

  // Normalize extracted array
  const normalized = best.arr
    .map((x) => normalizeRawItem(x))
    .filter((x) => x && x.id && x.name);

  fs.writeFileSync(
    DBG_HITS,
    JSON.stringify(
      {
        messageCount: decodedMessages.length,
        bestMsgIndex: best.msgIndex,
        bestPath: best.path,
        extractedCount: best.arr.length,
        normalizedCount: normalized.length,
        sample: normalized.slice(0, 5)
      },
      null,
      2
    ),
    "utf8"
  );

  fs.writeFileSync(OUT_ITEMS, JSON.stringify(normalized, null, 2), "utf8");
  console.log(`Wrote toolbox items -> ${OUT_ITEMS} (${normalized.length})`);

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});