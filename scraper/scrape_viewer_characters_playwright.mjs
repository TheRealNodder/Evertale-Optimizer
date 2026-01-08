// scraper/scrape_viewer_characters_playwright.mjs
// Extract items from Blazor Server (_blazor) websocket frames (JSON or MessagePack).
//
// Outputs (repo root /data):
//   toolbox.items.json          (flat list; categorized; includes image paths)
//   catalog.toolbox.json        (dropdown-ready catalog)
// Debug:
//   _debug_ws_largest_frames.json   (stores largest WS payloads, base64 if binary)
//   _debug_viewer_rendered.html
//   _debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import { decode as msgpackDecode } from "@msgpack/msgpack";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DOMAIN_HINT = "evertaletoolbox2.runasp.net";

const OUT_ITEMS = "data/toolbox.items.json";
const OUT_CATALOG = "data/catalog.toolbox.json";
const OUT_WS_DEBUG = "data/_debug_ws_largest_frames.json";

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const htmlPath = path.join(outDir, "_debug_viewer_rendered.html");
  const pngPath = path.join(outDir, "_debug_viewer_screenshot.png");

  try {
    const html = await page.content();
    await fs.writeFile(htmlPath, html, "utf8");
    console.log(`Saved debug HTML: ${htmlPath}`);
  } catch {}

  try {
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`Saved debug screenshot: ${pngPath}`);
  } catch {}
}

// --- SignalR JSON protocol messages are delimited by ASCII 0x1E ---
function splitSignalRJson(text) {
  return text
    .split("\u001e")
    .map((s) => s.trim())
    .filter(Boolean);
}

function tryJsonParse(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, err: e?.message || String(e) };
  }
}

// --- SignalR MessagePack protocol uses length-prefixed frames (varint length) ---
// This splits a Buffer into message chunks, each chunk is msgpack payload.
function splitVarintLengthPrefixed(buffer) {
  const chunks = [];
  let offset = 0;

  while (offset < buffer.length) {
    // read varint length
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

// Recursively find large arrays of objects that look like “items”
function findCandidateArrays(obj, minLen = 50) {
  const out = [];
  const seen = new Set();

  function walk(x, pathKey) {
    if (!x) return;
    if (typeof x !== "object") return;
    if (seen.has(x)) return;
    seen.add(x);

    if (Array.isArray(x)) {
      if (x.length >= minLen && x.some((e) => e && typeof e === "object")) {
        out.push({ path: pathKey, arr: x });
      }
      for (let i = 0; i < Math.min(x.length, 50); i++) {
        walk(x[i], `${pathKey}[${i}]`);
      }
      return;
    }

    for (const [k, v] of Object.entries(x)) {
      walk(v, pathKey ? `${pathKey}.${k}` : k);
    }
  }

  walk(obj, "");
  return out;
}

// Normalize a record into our item shape (best-effort, survives unknown schema)
function normalizeRecord(r) {
  if (!r || typeof r !== "object") return null;

  const lower = Object.fromEntries(
    Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])
  );

  const name =
    lower.name ??
    lower.unitname ??
    lower.displayname ??
    lower.title ??
    lower.charactername ??
    null;

  if (!name) return null;

  const id = lower.id ?? lower.unitid ?? lower.uid ?? name;

  // Try to find an image field
  const image =
    lower.image ??
    lower.imagepath ??
    lower.icon ??
    lower.iconpath ??
    lower.portrait ??
    lower.portraitpath ??
    null;

  // Some payloads may include a file name instead of a full path
  const imageStr = image ? String(image) : null;

  return {
    id: String(id),
    name: String(name),
    image: imageStr,
    raw: r,
  };
}

// Categorize by image path or obvious fields
function categorizeItem(item) {
  const img = (item.image || "").toLowerCase();

  if (img.includes("/weapons/")) return "weapons";
  if (img.includes("/accessories/")) return "accessories";
  if (img.includes("/monsters/")) return "enemies";
  if (img.includes("/boss")) return "bosses";
  if (img.includes("/characters/") || img.includes("/units/")) return "characters";

  // fallback heuristics by name patterns or raw keys
  const rawKeys = item.raw && typeof item.raw === "object" ? Object.keys(item.raw).map(k => k.toLowerCase()) : [];
  if (rawKeys.includes("weapon") || rawKeys.includes("weapontype")) return "weapons";
  if (rawKeys.includes("accessory")) return "accessories";

  return "characters"; // default if unknown
}

function toAbsoluteImageUrl(image) {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("/")) return `https://${DOMAIN_HINT}${image}`;
  // if it’s just a filename, don’t guess too hard
  return image;
}

async function run() {
  await ensureDir(path.resolve(process.cwd(), "data"));

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const page = await browser.newPage({
    viewport: { width: 1500, height: 950 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  page.setDefaultTimeout(120000);

  // Store biggest WS frames for debugging + parsing
  const wsFrames = [];
  const MAX_STORE = 12; // keep only biggest few to avoid huge repo

  function storeLargest(frame) {
    wsFrames.push(frame);
    wsFrames.sort((a, b) => (b.length || 0) - (a.length || 0));
    if (wsFrames.length > MAX_STORE) wsFrames.length = MAX_STORE;
  }

  // Extracted candidate arrays across all messages
  const candidateArrays = [];

  page.on("websocket", (ws) => {
    ws.on("framereceived", (evt) => {
      const payload = evt.payload;

      // Playwright may provide payload as string; sometimes it’s Buffer-like
      const isBuffer = Buffer.isBuffer(payload);
      const text = typeof payload === "string" ? payload : isBuffer ? payload.toString("utf8") : String(payload);
      const length = text.length;

      // Store the biggest frames for later inspection
      storeLargest({
        wsUrl: ws.url(),
        direction: "recv",
        length,
        sampleHead: text.slice(0, 1200),
        // if it *is* binary, keep base64
        base64: isBuffer ? Buffer.from(payload).toString("base64") : null,
      });

      // ---- Try JSON protocol parse (delimiter 0x1E) ----
      const parts = splitSignalRJson(text);
      for (const part of parts) {
        const p = tryJsonParse(part);
        if (!p.ok) continue;

        // Many SignalR messages are like:
        // { type:1, target:"...", arguments:[ ... ] }
        const cands = findCandidateArrays(p.value, 50);
        candidateArrays.push(...cands);

        if (p.value && typeof p.value === "object" && Array.isArray(p.value.arguments)) {
          for (const arg of p.value.arguments) {
            candidateArrays.push(...findCandidateArrays(arg, 50));
          }
        }
      }
    });
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let Blazor connect + stream initial data
  await page.waitForTimeout(12000);

  // Encourage additional frames
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => window.scrollBy(0, 1600));
    await page.waitForTimeout(650);
  }

  await page.waitForTimeout(3500);

  await saveDebug(page);
  await browser.close();

  // Save WS debug (largest frames)
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_WS_DEBUG),
    JSON.stringify({ scrapedAt: new Date().toISOString(), largestFrames: wsFrames }, null, 2),
    "utf8"
  );
  console.log(`Wrote WS debug -> ${OUT_WS_DEBUG}`);

  // If JSON-protocol candidates weren’t found, try MessagePack on any stored binary frames
  // (This only works if Playwright actually gives Buffer; often it's already string.)
  if (candidateArrays.length < 1) {
    for (const f of wsFrames) {
      if (!f.base64) continue;
      const buf = Buffer.from(f.base64, "base64");
      const chunks = splitVarintLengthPrefixed(buf);

      for (const chunk of chunks) {
        try {
          const decoded = msgpackDecode(chunk);
          candidateArrays.push(...findCandidateArrays(decoded, 50));

          if (decoded && typeof decoded === "object" && Array.isArray(decoded.arguments)) {
            for (const arg of decoded.arguments) {
              candidateArrays.push(...findCandidateArrays(arg, 50));
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // Pick the best candidate array: biggest length where elements normalize well
  let best = null;
  let bestScore = 0;

  for (const c of candidateArrays) {
    const arr = c.arr;
    const sample = arr.slice(0, 80).map(normalizeRecord).filter(Boolean);
    const score = arr.length * (sample.length / Math.max(1, Math.min(arr.length, 80)));

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best) {
    console.log("No candidate item arrays found yet. Use data/_debug_ws_largest_frames.json to tune selectors/decoding.");
    // Do not fail—keep debug for inspection.
    return;
  }

  // Normalize entire array
  const items = best.arr.map(normalizeRecord).filter(Boolean);

  // Categorize + finalize
  const finalItems = items.map((it) => {
    const category = categorizeItem(it);
    return {
      id: it.id,
      name: it.name,
      category,
      image: toAbsoluteImageUrl(it.image),
    };
  });

  // Deduplicate by (category + name)
  const dedup = new Map();
  for (const it of finalItems) {
    const key = `${it.category}::${it.name}`;
    if (!dedup.has(key)) dedup.set(key, it);
  }
  const dedupItems = Array.from(dedup.values());

  // Write items file
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_ITEMS),
    JSON.stringify(
      {
        source: VIEWER_URL,
        extractedFrom: best.path,
        extractedCount: best.arr.length,
        normalizedCount: dedupItems.length,
        scrapedAt: new Date().toISOString(),
        items: dedupItems,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Wrote ${OUT_ITEMS} items=${dedupItems.length}`);

  // Build catalog (simple dropdown-ready)
  const counts = dedupItems.reduce((acc, it) => {
    acc[it.category] = (acc[it.category] || 0) + 1;
    return acc;
  }, {});

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_CATALOG),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts,
        items: dedupItems.map((it) => ({
          id: it.id,
          name: it.name,
          category: it.category,
          image: it.image,
        })),
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Wrote ${OUT_CATALOG}`);
}

// Never hard-fail; we want debug committed every time.
run().catch((err) => {
  console.error("SCRAPER ERROR (non-fatal):", err);
  process.exit(0);
});