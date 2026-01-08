// scraper/scrape_viewer_characters_playwright.mjs
// Blazor Server Viewer extractor (CI-safe):
// - Captures WS frames from /_blazor
// - Decodes MessagePack chunks (SignalR length-prefixed)
// - Harvests ALL strings from decoded objects (render batches contain text tokens)
// - Parses the known Viewer header row layout into records
//
// Output:
//   data/toolbox.items.json
// Debug:
//   data/_debug_ws_frames.json
//   data/_debug_parsed_hits.json    (counts only, not “hit arrays” now)
//   data/_debug_strings.txt         (joined harvested strings, for inspection)
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
const OUT_STRINGS = "data/_debug_strings.txt";

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

// Recursively collect strings from any decoded object
function harvestStrings(x, out) {
  if (x == null) return;
  const t = typeof x;
  if (t === "string") {
    const s = x.trim();
    // Keep only meaningful strings
    if (s.length >= 2) out.push(s);
    return;
  }
  if (t === "number" || t === "boolean") return;

  if (Array.isArray(x)) {
    for (const v of x) harvestStrings(v, out);
    return;
  }

  if (t === "object") {
    for (const v of Object.values(x)) harvestStrings(v, out);
  }
}

// Parse rows from a big string stream using known header layout.
// We are NOT trying to parse skills perfectly yet—just clean name/stats/element/image.
function parseViewerRowsFromStream(stream) {
  // Normalize
  const text = stream.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();

  // Find a header anchor
  const header = "Name Rarity Element Cost ATK HP SPD Weapon Leader Skill Active Skills Passive Skills";
  const idx = text.indexOf(header);
  const body = idx >= 0 ? text.slice(idx + header.length) : text;

  // Extract image paths for anchoring row boundaries (these DO appear as strings in render batches often)
  const imgRe = /\/files\/images\/[a-z0-9/_-]+?\.(png|jpg|jpeg|webp)/gi;
  const imgPositions = [];
  let m;
  while ((m = imgRe.exec(body)) !== null) {
    imgPositions.push({ pos: m.index, path: m[0] });
  }

  // If we have no images, we can still attempt a weaker parse, but images help a lot.
  const rows = [];

  if (imgPositions.length === 0) {
    // fallback: try to split by element keywords + big number patterns
    const elemRe = /\b(Light|Storm|Fire|Water|Earth|Dark)\b/g;
    const parts = body.split(elemRe);
    // parts looks like [chunk, elem, chunk, elem, chunk...]
    for (let i = 1; i < parts.length; i += 2) {
      const element = parts[i];
      const chunk = (parts[i - 1] + " " + element + " " + (parts[i + 1] || "")).trim();
      rows.push({ chunk, image: null });
    }
  } else {
    // Build row chunks between images (image often sits in the row)
    for (let i = 0; i < imgPositions.length; i++) {
      const start = Math.max(0, imgPositions[i].pos - 900);
      const end = Math.min(body.length, (imgPositions[i + 1]?.pos ?? body.length) + 200);
      const chunk = body.slice(start, end);
      rows.push({ chunk, image: imgPositions[i].path });
    }
  }

  const items = [];
  const seen = new Set();

  for (const r of rows) {
    const chunk = r.chunk.replace(/\s+/g, " ").trim();
    if (!chunk) continue;

    // Name: take first non-empty words until we hit a big number (cost/atk/hp/spd) or an element token
    // This is heuristic but will stop the "entire row text in name" problem.
    const elementMatch = chunk.match(/\b(Light|Storm|Fire|Water|Earth|Dark)\b/i);
    const element = elementMatch ? elementMatch[1] : null;

    // Find first numeric run (we expect cost/atk/hp/spd soon)
    const numMatchIndex = chunk.search(/\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/);
    let namePart = numMatchIndex > 0 ? chunk.slice(0, numMatchIndex) : chunk.slice(0, 120);
    // Also stop name before element word if it appears early
    if (element) {
      const ei = namePart.toLowerCase().indexOf(element.toLowerCase());
      if (ei > 0) namePart = namePart.slice(0, ei);
    }
    const name = norm(namePart);
    if (!name) continue;
    if (name.toLowerCase().includes("rarity element cost atk hp spd")) continue;

    // Pull first 4 numbers as cost/atk/hp/spd
    const nums = chunk.match(/\b\d{1,3}(?:,\d{3})+\b|\b\d+\b/g) || [];
    const cost = nums[0] ?? null;
    const atk = nums[1] ?? null;
    const hp = nums[2] ?? null;
    const spd = nums[3] ?? null;

    const image = r.image ? toAbsUrl(r.image) : null;

    const key = `${name}::${element || ""}::${image || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      id: name,
      name,
      category: "character",
      element: element ? norm(element) : null,
      cost: cost ? norm(cost) : null,
      atk: atk ? norm(atk) : null,
      hp: hp ? norm(hp) : null,
      spd: spd ? norm(spd) : null,
      image,
      url: VIEWER_URL,
    });
  }

  return items;
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
  const MAX_FRAMES = 60;

  function storeFrame(f) {
    frames.push(f);
    frames.sort((a, b) => (b.len || 0) - (a.len || 0));
    if (frames.length > MAX_FRAMES) frames.length = MAX_FRAMES;
  }

  page.on("websocket", (ws) => {
    ws.on("framereceived", (evt) => {
      const payload = evt.payload;
      if (typeof payload === "string") {
        storeFrame({ ws: ws.url(), type: "text", len: payload.length, head: payload.slice(0, 2000) });
      } else if (Buffer.isBuffer(payload)) {
        storeFrame({ ws: ws.url(), type: "binary", len: payload.length, base64: payload.toString("base64") });
      }
    });
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let SignalR connect and send render batches
  await page.waitForTimeout(25000);

  // Scroll to trigger more render traffic
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(900);
  }

  await page.waitForTimeout(7000);

  await saveDebug(page);
  await browser.close();

  // Save WS debug
  await fs.writeFile(path.resolve(process.cwd(), OUT_WS_DEBUG), JSON.stringify({ scrapedAt: new Date().toISOString(), frames }, null, 2), "utf8");
  console.log(`Wrote WS debug -> ${OUT_WS_DEBUG}`);

  // Decode MessagePack and harvest strings
  const strings = [];
  let decodedCount = 0;
  let decodedOk = 0;

  for (const f of frames) {
    if (f.type !== "binary" || !f.base64) continue;
    const buf = Buffer.from(f.base64, "base64");

    const chunks = splitVarintLengthPrefixed(buf);
    decodedCount += chunks.length;

    for (const chunk of chunks) {
      try {
        const obj = msgpackDecode(chunk);
        decodedOk++;
        harvestStrings(obj, strings);
      } catch {
        // ignore undecodable
      }
    }
  }

  // Also include any text frames (sometimes SignalR sends json headers)
  for (const f of frames) {
    if (f.type === "text" && f.head) strings.push(f.head);
  }

  // Dedup + join
  const uniq = Array.from(new Set(strings.map(s => s.trim()).filter(Boolean)));
  const stream = uniq.join(" ");

  await fs.writeFile(path.resolve(process.cwd(), OUT_STRINGS), stream.slice(0, 2_500_000), "utf8"); // cap debug size
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_HITS_DEBUG),
    JSON.stringify({ decodedCount, decodedOk, stringCount: uniq.length, streamLen: stream.length }, null, 2),
    "utf8"
  );
  console.log(`Wrote strings debug -> ${OUT_STRINGS}`);
  console.log(`Wrote parse stats -> ${OUT_HITS_DEBUG}`);

  const items = parseViewerRowsFromStream(stream);

  if (items.length < 5) {
    throw new Error(
      `Could not extract enough rows from decoded string stream (items=${items.length}). Open data/_debug_strings.txt and search for the header or '/files/images/'.`
    );
  }

  // Dedup by id
  const dedup = new Map();
  for (const it of items) dedup.set(it.id, it);

  const finalItems = Array.from(dedup.values());

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_ITEMS),
    JSON.stringify(
      {
        source: VIEWER_URL,
        scrapedAt: new Date().toISOString(),
        count: finalItems.length,
        items: finalItems,
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