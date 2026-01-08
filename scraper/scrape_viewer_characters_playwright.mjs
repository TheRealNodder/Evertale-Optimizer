// scraper/scrape_viewer_characters_playwright.mjs
// Blazor Server Viewer extractor via WebSocket (_blazor) using MessagePack decode.
//
// Goal: produce data/toolbox.items.json in CI where DOM doesn't render.
// Strategy:
// 1) Capture WS frames (text + binary)
// 2) For binary frames: split SignalR length-prefixed frames, decode MessagePack
// 3) Recursively scan decoded objects for arrays of row-like objects
// 4) Normalize into toolbox.items.json
//
// Outputs:
//   data/toolbox.items.json
// Debug:
//   data/_debug_ws_frames.json   (largest frames)
//   data/_debug_parsed_hits.json (what arrays we found)
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { decode as msgpackDecode } from "@msgpack/msgpack";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DOMAIN_HINT = "evertaletoolbox2.runasp.net";

const OUT_ITEMS = "data/toolbox.items.json";
const OUT_WS_DEBUG = "data/_debug_ws_frames.json";
const OUT_HITS_DEBUG = "data/_debug_parsed_hits.json";

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}
function toAbsUrl(src) {
  if (!src) return null;
  const s = String(src);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `https://${DOMAIN_HINT}${s}`;
  return s;
}

async function ensureDataDir() {
  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
}

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  try {
    await fs.writeFile(path.join(outDir, "_debug_viewer_rendered.html"), await page.content(), "utf8");
  } catch {}
  try {
    await page.screenshot({ path: path.join(outDir, "_debug_viewer_screenshot.png"), fullPage: true });
  } catch {}
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

function looksLikeRowObject(obj) {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());

  const hasName = keys.includes("name") || keys.includes("unitname") || keys.includes("displayname") || keys.includes("title");
  const hasStats = keys.includes("atk") || keys.includes("hp") || keys.includes("spd") || keys.includes("cost") || keys.includes("element");
  const hasImage = keys.includes("image") || keys.includes("imagepath") || keys.includes("icon") || keys.includes("portrait");

  return hasName && (hasStats || hasImage);
}

function findCandidateArrays(root, minLen = 10) {
  const results = [];
  const seen = new Set();

  function walk(x, p) {
    if (!x) return;
    if (typeof x !== "object") return;
    if (seen.has(x)) return;
    seen.add(x);

    if (Array.isArray(x)) {
      if (x.length >= minLen && x.some(v => v && typeof v === "object")) {
        // compute "row-likeness"
        const sample = x.slice(0, 100);
        const good = sample.filter(looksLikeRowObject).length;
        const score = good / Math.max(1, sample.length);
        results.push({ path: p, length: x.length, score, arr: x });
      }
      for (let i = 0; i < Math.min(x.length, 30); i++) walk(x[i], `${p}[${i}]`);
      return;
    }

    for (const [k, v] of Object.entries(x)) walk(v, p ? `${p}.${k}` : k);
  }

  walk(root, "");
  results.sort((a, b) => (b.score - a.score) || (b.length - a.length));
  return results;
}

function normalizeItem(obj) {
  if (!obj || typeof obj !== "object") return null;

  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));

  const name =
    lower.name ??
    lower.unitname ??
    lower.displayname ??
    lower.title ??
    null;

  if (!name) return null;

  const id = String(lower.id ?? lower.unitid ?? lower.uid ?? name);

  const image =
    lower.image ??
    lower.imagepath ??
    lower.icon ??
    lower.iconpath ??
    lower.portrait ??
    lower.portraitpath ??
    null;

  const element = lower.element ?? null;

  const cost = lower.cost ?? null;
  const atk = lower.atk ?? lower.attack ?? null;
  const hp = lower.hp ?? lower.health ?? null;
  const spd = lower.spd ?? lower.speed ?? null;

  return {
    id: norm(id),
    name: norm(name),
    category: "character",
    element: element ? norm(element) : null,
    cost: cost != null ? norm(cost) : null,
    atk: atk != null ? norm(atk) : null,
    hp: hp != null ? norm(hp) : null,
    spd: spd != null ? norm(spd) : null,
    image: image ? toAbsUrl(String(image)) : null,
    url: VIEWER_URL,
    raw: obj,
  };
}

async function run() {
  await ensureDataDir();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1500, height: 950 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  const frames = [];
  const MAX_FRAMES = 40;

  function storeFrame(f) {
    frames.push(f);
    frames.sort((a, b) => (b.len || 0) - (a.len || 0));
    if (frames.length > MAX_FRAMES) frames.length = MAX_FRAMES;
  }

  page.on("websocket", (ws) => {
    ws.on("framereceived", (evt) => {
      const payload = evt.payload;

      if (typeof payload === "string") {
        storeFrame({ ws: ws.url(), type: "text", len: payload.length, head: payload.slice(0, 1600) });
      } else if (Buffer.isBuffer(payload)) {
        storeFrame({ ws: ws.url(), type: "binary", len: payload.length, base64: payload.toString("base64") });
      }
    });
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // let SignalR connect and send batches
  await page.waitForTimeout(25000);

  // trigger more traffic
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(900);
  }

  await page.waitForTimeout(6000);

  await saveDebug(page);
  await browser.close();

  // Save frame debug
  await fs.writeFile(path.resolve(process.cwd(), OUT_WS_DEBUG), JSON.stringify({ scrapedAt: new Date().toISOString(), frames }, null, 2), "utf8");
  console.log(`Wrote WS debug -> ${OUT_WS_DEBUG}`);

  // Decode MessagePack from binary frames
  const decodedObjects = [];
  for (const f of frames) {
    if (f.type !== "binary" || !f.base64) continue;
    const buf = Buffer.from(f.base64, "base64");

    // Split into SignalR packets
    const chunks = splitVarintLengthPrefixed(buf);
    for (const chunk of chunks) {
      try {
        const obj = msgpackDecode(chunk);
        decodedObjects.push(obj);
      } catch {
        // ignore
      }
    }
  }

  // Search decoded objects for candidate arrays
  const hits = [];
  for (let i = 0; i < decodedObjects.length; i++) {
    const obj = decodedObjects[i];
    const candidates = findCandidateArrays(obj, 10);
    if (candidates.length) {
      hits.push({
        index: i,
        top: candidates.slice(0, 5).map(c => ({ path: c.path, length: c.length, score: c.score })),
      });
    }
  }

  await fs.writeFile(path.resolve(process.cwd(), OUT_HITS_DEBUG), JSON.stringify({ decodedCount: decodedObjects.length, hits }, null, 2), "utf8");
  console.log(`Wrote hits debug -> ${OUT_HITS_DEBUG}`);

  // Pick best array overall
  let bestArr = null;
  let bestMeta = null;

  for (const obj of decodedObjects) {
    const candidates = findCandidateArrays(obj, 10);
    if (!candidates.length) continue;

    const best = candidates[0];
    if (!bestArr || (best.score > bestMeta.score) || (best.score === bestMeta.score && best.length > bestMeta.length)) {
      bestArr = best.arr;
      bestMeta = { path: best.path, length: best.length, score: best.score };
    }
  }

  if (!bestArr || bestArr.length < 5) {
    throw new Error(
      `No suitable dataset array found in decoded WS frames. Check data/_debug_parsed_hits.json and data/_debug_ws_frames.json.`
    );
  }

  const itemsRaw = bestArr.map(normalizeItem).filter(Boolean);

  // Remove header junk
  const items = itemsRaw.filter(it => {
    const n = (it.name || "").toLowerCase();
    return n && !n.includes("rarity element cost atk hp spd");
  });

  // Dedup by id
  const dedup = new Map();
  for (const it of items) {
    if (!dedup.has(it.id)) dedup.set(it.id, it);
  }

  const finalItems = Array.from(dedup.values());

  if (finalItems.length < 5) {
    throw new Error(`Decoded array produced too few normalized items (${finalItems.length}).`);
  }

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_ITEMS),
    JSON.stringify(
      {
        source: VIEWER_URL,
        scrapedAt: new Date().toISOString(),
        extracted: bestMeta,
        count: finalItems.length,
        items: finalItems.map(({ raw, ...rest }) => rest), // keep file smaller
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote ${OUT_ITEMS} items=${finalItems.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});