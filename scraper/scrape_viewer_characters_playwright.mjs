// scraper/scrape_viewer_characters_playwright.mjs
// Viewer scraper that captures JSON from network (preferred for Blazor apps).
// Outputs:
//   data/viewer.raw.network.json      (all candidate JSON hits, trimmed)
//   data/viewer.toolbox.full.json     (best-candidate normalized list, if found)
// Debug:
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

function normText(s) {
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

// Heuristic: count “records” if the JSON looks like a list or contains a list.
function scoreJson(obj) {
  if (!obj) return { score: 0, count: 0, shape: "none" };

  // direct array
  if (Array.isArray(obj)) return { score: obj.length, count: obj.length, shape: "array" };

  // common list keys
  const listKeys = ["items", "data", "results", "records", "rows", "value"];
  for (const k of listKeys) {
    if (Array.isArray(obj[k])) {
      const n = obj[k].length;
      return { score: n, count: n, shape: `obj.${k}` };
    }
  }

  // deep scan 1 level for arrays
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) {
        const n = v.length;
        return { score: n * 0.9, count: n, shape: `obj.${k}` };
      }
    }
  }

  return { score: 0, count: 0, shape: "object" };
}

function extractList(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;

  const listKeys = ["items", "data", "results", "records", "rows", "value"];
  for (const k of listKeys) {
    if (Array.isArray(obj[k])) return obj[k];
  }

  // deep scan 1 level
  if (typeof obj === "object") {
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

// Normalize arbitrary records into a consistent item shape (best-effort)
function normalizeRecord(r) {
  if (!r || typeof r !== "object") return null;

  const keys = Object.keys(r).map(k => k.toLowerCase());

  const pick = (cands) => {
    for (const c of cands) {
      const i = keys.indexOf(c.toLowerCase());
      if (i >= 0) {
        const realKey = Object.keys(r)[i];
        return r[realKey];
      }
    }
    return null;
  };

  const name =
    pick(["name", "unitName", "title", "displayName"]) ??
    (typeof r === "string" ? r : null);

  if (!name) return null;

  const type = pick(["type", "category", "kind", "group"]) ?? null;
  const element = pick(["element", "attr", "attribute"]) ?? null;

  return {
    id: String(pick(["id", "unitId", "uid"]) ?? name),
    name: String(name),
    type: type ? String(type) : null,
    element: element ? String(element) : null,
    raw: r,
  };
}

async function run() {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

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

  // Capture JSON responses
  const jsonHits = [];
  const MAX_HITS = 80;

  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      const ct = (resp.headers()["content-type"] || "").toLowerCase();

      // only consider JSON-ish responses
      if (!ct.includes("application/json") && !ct.includes("+json")) return;

      // avoid huge spam
      if (jsonHits.length >= MAX_HITS) return;

      const status = resp.status();
      if (status < 200 || status >= 300) return;

      const text = await resp.text();
      if (!text || text.length < 2) return;

      let obj = null;
      try {
        obj = JSON.parse(text);
      } catch {
        return;
      }

      const { score, count, shape } = scoreJson(obj);
      jsonHits.push({
        url,
        contentType: ct,
        status,
        shape,
        count,
        score,
        sampleKeys: obj && typeof obj === "object" && !Array.isArray(obj) ? Object.keys(obj).slice(0, 30) : [],
        // store a trimmed sample so repo doesn’t explode
        sample: text.slice(0, 5000),
      });
    } catch {
      // ignore
    }
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Give Blazor time + trigger some activity
  await page.waitForTimeout(9000);

  // Light scroll to encourage virtualized/XHR loads
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(800);
  }

  // Wait a moment for network to settle
  await page.waitForTimeout(3000);

  // Save debug DOM artifacts always (helps)
  await saveDebug(page);

  await browser.close();

  // Write network hits list
  const hitsPath = path.join(outDir, "viewer.raw.network.json");
  await fs.writeFile(hitsPath, JSON.stringify({ scrapedAt: new Date().toISOString(), hits: jsonHits }, null, 2), "utf8");
  console.log(`Wrote network JSON hit log -> ${hitsPath} (hits=${jsonHits.length})`);

  // Pick best candidate by highest score (count of records)
  const best = [...jsonHits].sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  if (!best || (best.count || 0) < 50) {
    throw new Error(
      `No suitable JSON payload found (best count=${best?.count || 0}). Open data/viewer.raw.network.json to see captured endpoints.`
    );
  }

  // We only stored trimmed sample; we need the full JSON again.
  // To do that, we re-fetch the best URL using node fetch (Node 20 has fetch).
  const fullResp = await fetch(best.url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!fullResp.ok) throw new Error(`Refetch failed for best URL: ${best.url} status=${fullResp.status}`);

  const fullObj = await fullResp.json();
  const list = extractList(fullObj);

  if (!Array.isArray(list) || list.length < 50) {
    throw new Error(`Best URL did not contain a usable list when refetched. shape=${best.shape} count=${list?.length || 0}`);
  }

  // Normalize
  const items = [];
  for (const r of list) {
    const n = normalizeRecord(r);
    if (n) items.push(n);
  }

  if (items.length < 50) {
    throw new Error(`Normalization produced too few items (${items.length}). We need to tune field mapping based on the payload.`);
  }

  const outPath = path.join(outDir, "viewer.toolbox.full.json");
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        source: VIEWER_URL,
        bestUrl: best.url,
        scrapedAt: new Date().toISOString(),
        items,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote normalized dataset -> ${outPath} items=${items.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});