// scraper/scrape_viewer_characters_playwright.mjs
// Blazor Server (_blazor) websocket extraction for EvertaleToolbox Viewer.
//
// Writes (repo root /data):
//   data/toolbox.items.json
//   data/catalog.toolbox.json
//   data/_debug_ws_largest_frames.json
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png
//
// Important:
// - We DO NOT hard-fail the workflow. If extraction fails, we still write debug files and exit 0.

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

// Fix #1: clean names if they accidentally include stats
function cleanName(maybeName) {
  let s = norm(maybeName);

  const STOP_TOKENS = [
    "HP", "ATK", "DEF", "SPD", "AGI", "TU",
    "LUK", "COST", "LEVEL", "RARITY"
  ];

  const upper = s.toUpperCase();

  // Cut at first " <TOKEN> "
  let cutAt = -1;
  for (const t of STOP_TOKENS) {
    const idx = upper.indexOf(` ${t} `);
    if (idx !== -1) cutAt = (cutAt === -1 ? idx : Math.min(cutAt, idx));
  }
  if (cutAt !== -1) s = s.slice(0, cutAt).trim();

  // Also cut on "HP:" / "ATK:" / etc
  s = s.split(/\b(HP|ATK|DEF|SPD|AGI|TU|LUK|COST|LEVEL|RARITY)\s*[:=]/i)[0].trim();

  // cleanup
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
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

// SignalR JSON protocol: messages separated by ASCII 0x1E
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

// SignalR MessagePack: length-prefixed frames (varint length)
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

// Find arrays of objects that could be a dataset
function findCandidateArrays(obj, minLen = 50) {
  const out = [];
  const seen = new Set();

  function walk(x, p) {
    if (!x) return;
    if (typeof x !== "object") return;
    if (seen.has(x)) return;
    seen.add(x);

    if (Array.isArray(x)) {
      if (x.length >= minLen && x.some((e) => e && typeof e === "object")) {
        out.push({ path: p, arr: x });
      }
      // only walk some elements for speed
      for (let i = 0; i < Math.min(x.length, 60); i++) {
        walk(x[i], `${p}[${i}]`);
      }
      return;
    }

    for (const [k, v] of Object.entries(x)) {
      walk(v, p ? `${p}.${k}` : k);
    }
  }

  walk(obj, "");
  return out;
}

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

  const image =
    lower.image ??
    lower.imagepath ??
    lower.icon ??
    lower.iconpath ??
    lower.portrait ??
    lower.portraitpath ??
    null;

  const imageStr = image ? String(image) : null;

  return {
    id: String(id),
    name: cleanName(name),          // ✅ FIX: clean stat-mixed names
    image: imageStr,
    raw: r,
  };
}

function categorizeItem(item) {
  const img = (item.image || "").toLowerCase();

  if (img.includes("/weapons/")) return "weapons";
  if (img.includes("/accessories/")) return "accessories";
  if (img.includes("/monsters/")) return "enemies";
  if (img.includes("/boss")) return "bosses";
  if (img.includes("/characters/") || img.includes("/units/")) return "characters";

  // fallback based on keys
  const keys = item.raw && typeof item.raw === "object"
    ? Object.keys(item.raw).map(k => k.toLowerCase())
    : [];

  if (keys.some(k => k.includes("weapon"))) return "weapons";
  if (keys.some(k => k.includes("accessory"))) return "accessories";
  if (keys.some(k => k.includes("monster") || k.includes("enemy"))) return "enemies";

  return "characters";
}

function toAbsoluteImageUrl(image) {
  if (!image) return null;
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  if (image.startsWith("/")) return `https://${DOMAIN_HINT}${image}`;
  return image;
}

// Fix #2: better selection of the correct dataset array
function looksLikeRealItem(obj) {
  if (!obj || typeof obj !== "object") return false;

  const keys = Object.keys(obj).map((k) => k.toLowerCase());

  const hasName =
    keys.includes("name") ||
    keys.includes("unitname") ||
    keys.includes("displayname") ||
    keys.includes("title") ||
    keys.includes("charactername");

  const hasId =
    keys.includes("id") ||
    keys.includes("unitid") ||
    keys.includes("uid");

  const hasImage =
    keys.includes("image") ||
    keys.includes("imagepath") ||
    keys.includes("icon") ||
    keys.includes("iconpath") ||
    keys.includes("portrait") ||
    keys.includes("portraitpath");

  return hasName && (hasId || hasImage);
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

  // Keep only a handful of the biggest WS frames for debug
  const wsLargest = [];
  const MAX_STORE = 10;

  function storeLargestFrame(frame) {
    wsLargest.push(frame);
    wsLargest.sort((a, b) => (b.length || 0) - (a.length || 0));
    if (wsLargest.length > MAX_STORE) wsLargest.length = MAX_STORE;
  }

  const candidateArrays = [];

  page.on("websocket", (ws) => {
    ws.on("framereceived", (evt) => {
      try {
        const payload = evt.payload;
        const isBuffer = Buffer.isBuffer(payload);

        const text =
          typeof payload === "string"
            ? payload
            : isBuffer
            ? payload.toString("utf8")
            : String(payload);

        const length = text.length;

        storeLargestFrame({
          wsUrl: ws.url(),
          direction: "recv",
          length,
          sampleHead: text.slice(0, 1400),
          base64: isBuffer ? Buffer.from(payload).toString("base64") : null,
        });

        // Try JSON protocol first
        const parts = splitSignalRJson(text);
        for (const part of parts) {
          const p = tryJsonParse(part);
          if (!p.ok) continue;

          candidateArrays.push(...findCandidateArrays(p.value, 50));

          if (p.value && typeof p.value === "object" && Array.isArray(p.value.arguments)) {
            for (const arg of p.value.arguments) {
              candidateArrays.push(...findCandidateArrays(arg, 50));
            }
          }
        }
      } catch {
        // ignore frame
      }
    });
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let Blazor connect
  await page.waitForTimeout(12000);

  // Encourage more traffic (virtualized grids often load on scroll)
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => window.scrollBy(0, 1700));
    await page.waitForTimeout(650);
  }

  await page.waitForTimeout(3500);

  await saveDebug(page);
  await browser.close();

  // Save WS debug
  await fs.writeFile(
    path.resolve(process.cwd(), OUT_WS_DEBUG),
    JSON.stringify(
      { scrapedAt: new Date().toISOString(), largestFrames: wsLargest },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Wrote WS debug -> ${OUT_WS_DEBUG}`);

  // If we didn't find candidate arrays through JSON protocol, attempt MessagePack decode
  if (candidateArrays.length === 0) {
    for (const f of wsLargest) {
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

  // -------- Choose best dataset array (FIXED scoring) --------
  let best = null;
  let bestScore = 0;

  for (const c of candidateArrays) {
    const arr = c.arr;
    if (!Array.isArray(arr) || arr.length < 20) continue;

    const sample = arr.slice(0, 120);

    const good = sample.filter(looksLikeRealItem).length;
    const goodRatio = good / Math.max(1, sample.length);

    const strings = sample.filter((x) => typeof x === "string").length;
    const stringRatio = strings / Math.max(1, sample.length);

    // prefer big arrays of real objects; penalize string-heavy arrays
    const score = (arr.length * goodRatio) - (arr.length * 0.5 * stringRatio);

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best) {
    console.log("No usable dataset array found yet. Debug frames saved. (Not failing.)");
    return;
  }

  // Normalize all records
  const normalized = best.arr.map(normalizeRecord).filter(Boolean);

  // Categorize + absolute image urls
  const items = normalized.map((it) => ({
    id: it.id,
    name: it.name,
    category: categorizeItem(it),
    image: toAbsoluteImageUrl(it.image),
  }));

  // Deduplicate by category+name
  const dedup = new Map();
  for (const it of items) {
    const key = `${it.category}::${it.name}`;
    if (!dedup.has(key)) dedup.set(key, it);
  }
  const dedupItems = Array.from(dedup.values());

  // Write flat items
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

  // Build catalog
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

// Never hard-fail. Always keep debug output.
run().catch((err) => {
  console.error("SCRAPER ERROR (non-fatal):", err);
  process.exit(0);
});