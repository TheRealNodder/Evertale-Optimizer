// scraper/scrape_explorer_capture_json.mjs
// Robust approach: open /Explorer and capture ANY JSON responses.
// Many Blazor apps fetch their datasets via normal HTTP (not WS), even if UI is Blazor.
// We store the biggest JSON responses and try to identify items inside.
//
// Outputs:
//   data/explorer.captured.json (list of captured JSON responses metadata + small sample)
//   data/toolbox.items.json     (best-effort normalized items if we find a big dataset)
// Debug:
//   data/_debug_explorer_rendered.html
//   data/_debug_explorer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;

const OUT_CAPTURE = "data/explorer.captured.json";
const OUT_ITEMS = "data/toolbox.items.json";

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

async function ensureDataDir() {
  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
}

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  try {
    await fs.writeFile(path.join(outDir, "_debug_explorer_rendered.html"), await page.content(), "utf8");
  } catch {}
  try {
    await page.screenshot({ path: path.join(outDir, "_debug_explorer_screenshot.png"), fullPage: true });
  } catch {}
}

function isProbablyItem(obj) {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj).map(k => k.toLowerCase());
  const hasName = keys.includes("name") || keys.includes("title") || keys.includes("displayname");
  const hasImage = keys.some(k => k.includes("image") || k.includes("icon") || k.includes("portrait"));
  const hasType = keys.includes("type") || keys.includes("category") || keys.includes("kind");
  const hasStats = keys.includes("atk") || keys.includes("hp") || keys.includes("spd") || keys.includes("cost") || keys.includes("element");
  return hasName && (hasType || hasImage || hasStats);
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
    url: EXPLORER_URL,
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

  const captures = [];

  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      const ct = (resp.headers()["content-type"] || "").toLowerCase();

      if (!ct.includes("application/json")) return;
      if (!url.startsWith(BASE)) return;

      const text = await resp.text();
      const size = text.length;

      // Avoid storing gigantic full bodies in capture file; keep sample
      let parsed = null;
      try { parsed = JSON.parse(text); } catch { return; }

      captures.push({
        url,
        status: resp.status(),
        contentType: ct,
        size,
        // lightweight sample:
        topKeys: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed).slice(0, 40) : null,
        isArray: Array.isArray(parsed),
        arrayLen: Array.isArray(parsed) ? parsed.length : null,
      });

      // Also stash parsed for later selection (in memory only)
      captures[captures.length - 1]._parsed = parsed;

    } catch {
      // ignore
    }
  });

  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  await page.goto(EXPLORER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let it load requests
  await page.waitForTimeout(25000);

  // Interact/scroll to trigger loads
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(800);
  }

  await page.waitForTimeout(5000);

  await saveDebug(page);
  await browser.close();

  // Write capture meta (without full parsed bodies)
  const captureMeta = captures
    .map(({ _parsed, ...rest }) => rest)
    .sort((a, b) => (b.size - a.size));

  await fs.writeFile(path.resolve(process.cwd(), OUT_CAPTURE), JSON.stringify({
    scrapedAt: new Date().toISOString(),
    count: captureMeta.length,
    captures: captureMeta,
  }, null, 2), "utf8");

  console.log(`Wrote capture list -> ${OUT_CAPTURE} (${captureMeta.length} json responses)`);

  // Try to pick best dataset
  let best = null;

  for (const c of captures) {
    const parsed = c._parsed;
    if (!parsed) continue;

    // Find best big array inside this JSON
    const arrays = findBigArrays(parsed, 50);
    if (!arrays.length) continue;

    const top = arrays[0];
    // prefer higher "score" then length then response size
    const candidate = {
      url: c.url,
      size: c.size,
      path: top.path,
      length: top.length,
      score: top.score,
      arr: top.arr,
    };

    if (!best ||
        candidate.score > best.score ||
        (candidate.score === best.score && candidate.length > best.length) ||
        (candidate.score === best.score && candidate.length === best.length && candidate.size > best.size)) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error(
      `No usable JSON dataset found on Explorer. Open data/explorer.captured.json to see what endpoints returned JSON.`
    );
  }

  const normalized = best.arr.map(normalizeItem).filter(Boolean);

  if (normalized.length < 20) {
    throw new Error(
      `Found a candidate array but normalized too small (${normalized.length}). Best was path=${best.path} len=${best.length} score=${best.score}.`
    );
  }

  await fs.writeFile(
    path.resolve(process.cwd(), OUT_ITEMS),
    JSON.stringify({
      source: EXPLORER_URL,
      scrapedAt: new Date().toISOString(),
      picked: { url: best.url, path: best.path, length: best.length, score: best.score, size: best.size },
      count: normalized.length,
      items: normalized,
    }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${OUT_ITEMS} items=${normalized.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
