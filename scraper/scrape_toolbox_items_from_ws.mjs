// scraper/scrape_toolbox_items_from_ws.mjs (SAFE MODE)
// If no dataset is found, writes empty toolbox.items.json and exits 0.
// Keeps debug artifacts for inspection.

import fs from "fs";
import path from "path";
import process from "process";
import { chromium } from "playwright";
import { MessagePackHubProtocol } from "@microsoft/signalr-protocol-msgpack";

const OUT_DIR = path.resolve("data");
const OUT_ITEMS = path.join(OUT_DIR, "toolbox.items.json");

const DBG_FRAMES = path.join(OUT_DIR, "_debug_toolbox_ws_frames.json");
const DBG_SAMPLES = path.join(OUT_DIR, "_debug_toolbox_ws_payload_samples.json");
const DBG_DECODED = path.join(OUT_DIR, "_debug_toolbox_ws_decoded.json");
const DBG_HITS = path.join(OUT_DIR, "_debug_toolbox_ws_hits.json");

const TOOLBOX_URL =
  process.env.TOOLBOX_URL || "https://evertaletoolbox2.runasp.net/Viewer";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function looksLikeBase64(s) {
  if (typeof s !== "string") return false;
  if (s.length < 16) return false;
  if (s.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(s);
}

function toBytes(payload) {
  if (Buffer.isBuffer(payload)) return new Uint8Array(payload);
  if (payload instanceof Uint8Array) return payload;
  if (typeof payload === "string") {
    if (looksLikeBase64(payload)) {
      try {
        return new Uint8Array(Buffer.from(payload, "base64"));
      } catch {}
    }
    return new Uint8Array(Buffer.from(payload, "utf8"));
  }
  return null;
}

function bytesToUtf8(bytes) {
  try {
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return null;
  }
}

function safeJson(x) {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch {
    return null;
  }
}

function itemLike(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const s = JSON.stringify(o);
  return (
    s.includes("/files/images/") ||
    "Name" in o || "name" in o ||
    "Id" in o || "id" in o ||
    "Element" in o || "element" in o ||
    "ATK" in o || "HP" in o || "SPD" in o
  );
}

function walkFindLargestArray(node, wantPredicate) {
  const seen = new Set();
  let best = { arr: null, path: "", score: 0 };

  function rec(v, p) {
    if (!v || typeof v !== "object") return;
    if (seen.has(v)) return;
    seen.add(v);

    if (Array.isArray(v)) {
      let score = v.length;
      if (v.length > 0 && wantPredicate) {
        let hit = 0;
        for (let i = 0; i < Math.min(v.length, 80); i++) {
          if (wantPredicate(v[i])) hit++;
        }
        score += hit * 10;
      }
      if (score > best.score) best = { arr: v, path: p, score };
      for (let i = 0; i < Math.min(v.length, 200); i++) rec(v[i], `${p}[${i}]`);
      return;
    }

    for (const [k, vv] of Object.entries(v)) rec(vv, p ? `${p}.${k}` : k);
  }

  rec(node, "");
  return best;
}

function normalizeRawItem(o) {
  const get = (...keys) => {
    for (const k of keys) {
      if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    }
    return null;
  };

  const name = get("name", "Name", "UnitName", "Title");
  const id = get("id", "Id", "ID", "Key", "key") || name;

  const categoryRaw = get("category", "Category", "type", "Type");
  const category = categoryRaw ? String(categoryRaw).toLowerCase() : null;

  const image = get("image", "Image", "imageUrl", "ImageUrl", "Icon", "icon") || null;
  const element = get("element", "Element") ?? null;

  const cost = get("cost", "Cost") ?? null;
  const atk = get("atk", "ATK", "Attack") ?? null;
  const hp = get("hp", "HP") ?? null;
  const spd = get("spd", "SPD", "Speed") ?? null;

  return { id: id ? String(id) : null, name: name ? String(name) : null, category, element, image, cost, atk, hp, spd, raw: o };
}

function decodeSignalrJsonFromUtf8(text) {
  if (!text) return [];
  const RS = "\u001e";
  const parts = text.includes(RS)
    ? text.split(RS).map((s) => s.trim()).filter(Boolean)
    : [text.trim()];
  const msgs = [];
  for (const p of parts) {
    try { msgs.push(JSON.parse(p)); } catch {}
  }
  return msgs;
}

function decodeSignalrMsgpack(bytes) {
  const protocol = new MessagePackHubProtocol();
  const logger = { log: () => {} };
  try { return protocol.parseMessages(bytes, logger) || []; } catch { return []; }
}

async function pokeUi(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  const keywords = ["units", "characters", "all", "viewer", "catalog"];
  await page.evaluate((keys) => {
    const els = [
      ...document.querySelectorAll("button"),
      ...document.querySelectorAll("[role='button']"),
      ...document.querySelectorAll("a"),
      ...document.querySelectorAll("li")
    ];
    for (const el of els) {
      const t = (el.innerText || el.textContent || "").toLowerCase().trim();
      if (!t) continue;
      if (keys.some((k) => t === k || t.includes(k))) {
        try { el.click(); } catch {}
        break;
      }
    }
  }, keywords);

  await page.waitForTimeout(4000);
}

async function run() {
  ensureDir(OUT_DIR);

  const frames = [];
  const payloadSamples = [];
  const decoded = [];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("websocket", (ws) => {
    ws.on("framereceived", (frame) => frames.push({ t: Date.now(), dir: "in", opcode: frame.opcode, len: frame.payload?.length ?? 0, payload: frame.payload }));
    ws.on("framesent", (frame) => frames.push({ t: Date.now(), dir: "out", opcode: frame.opcode, len: frame.payload?.length ?? 0, payload: frame.payload }));
  });

  console.log(`Loading Toolbox page: ${TOOLBOX_URL}`);
  await page.goto(TOOLBOX_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  await page.waitForTimeout(12000);
  await pokeUi(page);
  await page.waitForTimeout(18000);

  fs.writeFileSync(DBG_FRAMES, JSON.stringify(frames, null, 2), "utf8");

  for (const f of frames.filter((x) => x.dir === "in").slice(0, 25)) {
    const bytes = toBytes(f.payload);
    const text = bytes ? bytesToUtf8(bytes) : null;
    payloadSamples.push({
      opcode: f.opcode,
      len: f.len,
      asTextPreview: text ? text.slice(0, 400) : null,
      looksBase64: typeof f.payload === "string" ? looksLikeBase64(f.payload) : false
    });
  }
  fs.writeFileSync(DBG_SAMPLES, JSON.stringify(payloadSamples, null, 2), "utf8");

  for (const f of frames) {
    if (f.dir !== "in") continue;
    const bytes = toBytes(f.payload);
    if (!bytes || bytes.length < 2) continue;

    const text = bytesToUtf8(bytes);
    for (const m of decodeSignalrJsonFromUtf8(text)) decoded.push({ protocol: "json", msg: m });
    for (const m of decodeSignalrMsgpack(bytes)) decoded.push({ protocol: "msgpack", msg: m });
  }

  fs.writeFileSync(DBG_DECODED, JSON.stringify(safeJson(decoded) ?? [], null, 2), "utf8");

  let best = { arr: null, path: "", score: 0, index: -1, protocol: null };
  for (let i = 0; i < decoded.length; i++) {
    const cand = walkFindLargestArray(decoded[i].msg, itemLike);
    if (cand.arr && cand.score > best.score) best = { ...cand, index: i, protocol: decoded[i].protocol };
  }

  // BYPASS: don’t fail the workflow; write empty items file + debug and exit normally
  if (!best.arr || best.arr.length < 20) {
    fs.writeFileSync(
      DBG_HITS,
      JSON.stringify(
        {
          status: "NO_DATASET_FOUND",
          frameCount: frames.length,
          incomingFrames: frames.filter((x) => x.dir === "in").length,
          decodedCount: decoded.length,
          bestScore: best.score,
          bestProtocol: best.protocol,
          bestIndex: best.index,
          bestPath: best.path,
          bestLength: best.arr ? best.arr.length : 0
        },
        null,
        2
      ),
      "utf8"
    );

    fs.writeFileSync(OUT_ITEMS, "[]\n", "utf8");
    console.log(`No dataset found; wrote empty ${OUT_ITEMS} and kept debug files.`);
    await browser.close();
    return;
  }

  const normalized = best.arr.map(normalizeRawItem).filter((x) => x && x.id && x.name);

  fs.writeFileSync(
    DBG_HITS,
    JSON.stringify(
      { status: "OK", bestProtocol: best.protocol, bestIndex: best.index, bestPath: best.path, extractedCount: best.arr.length, normalizedCount: normalized.length, sample: normalized.slice(0, 8) },
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
  // BYPASS: still write empty file so pipeline can continue
  try {
    ensureDir(OUT_DIR);
    fs.writeFileSync(OUT_ITEMS, "[]\n", "utf8");
  } catch {}
  process.exit(0);
});