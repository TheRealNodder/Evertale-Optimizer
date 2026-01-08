// scraper/scrape_viewer_characters_playwright.mjs
// Capture Viewer data from ANY response type (JSON/text/octet-stream) for Blazor/SignalR apps.
// Outputs:
//   data/viewer.raw.responses.json    (all candidate responses summarized + small samples)
//   data/viewer.toolbox.full.json     (normalized list if a big payload is found)
// Debug:
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DOMAIN_HINT = "evertaletoolbox2.runasp.net";

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

function scoreListFromAny(obj) {
  if (!obj) return { score: 0, count: 0, shape: "none" };

  if (Array.isArray(obj)) return { score: obj.length, count: obj.length, shape: "array" };

  if (typeof obj === "object") {
    const keys = ["items", "data", "results", "records", "rows", "value"];
    for (const k of keys) {
      if (Array.isArray(obj[k])) return { score: obj[k].length, count: obj[k].length, shape: `obj.${k}` };
    }
    // 1-level deep
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) return { score: v.length * 0.9, count: v.length, shape: `obj.${k}` };
    }
  }

  return { score: 0, count: 0, shape: "object" };
}

function extractList(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  const keys = ["items", "data", "results", "records", "rows", "value"];
  for (const k of keys) if (Array.isArray(obj[k])) return obj[k];
  if (typeof obj === "object") {
    for (const v of Object.values(obj)) if (Array.isArray(v)) return v;
  }
  return [];
}

function normalizeRecord(r) {
  if (!r) return null;

  if (typeof r === "string") {
    const name = normText(r);
    return name ? { id: name, name, type: null, element: null, raw: r } : null;
  }

  if (typeof r !== "object") return null;

  const lower = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]));
  const name =
    lower.name ??
    lower.unitname ??
    lower.displayname ??
    lower.title ??
    lower.charactername ??
    null;

  if (!name) return null;

  const id = lower.id ?? lower.unitid ?? lower.uid ?? name;
  const type = lower.type ?? lower.category ?? lower.kind ?? lower.group ?? null;
  const element = lower.element ?? lower.attr ?? lower.attribute ?? null;

  return {
    id: String(id),
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

  const captures = [];
  const MAX_CAPTURES = 60;

  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!url.includes(DOMAIN_HINT)) return;
      if (captures.length >= MAX_CAPTURES) return;

      const status = resp.status();
      const headers = resp.headers();
      const ct = (headers["content-type"] || "").toLowerCase();

      // Only attempt body reads for ok-ish responses
      if (status < 200 || status >= 300) {
        captures.push({ url, status, contentType: ct, note: "non-2xx" });
        return;
      }

      // Read as buffer so we can handle octet-stream too
      const buf = await resp.body().catch(() => null);
      const size = buf ? buf.length : 0;

      // Avoid huge memory usage
      if (!buf || size === 0) {
        captures.push({ url, status, contentType: ct, size, note: "no-body" });
        return;
      }

      // Decode small-to-medium responses to text for JSON sniffing
      const sampleBuf = buf.subarray(0, Math.min(size, 150000)); // 150 KB cap
      const text = sampleBuf.toString("utf8");

      let parsed = null;
      let parseOk = false;
      let parseErr = null;

      // Try JSON.parse if it looks like JSON
      const looksJson = /^\s*[{[]/.test(text);
      if (looksJson || ct.includes("json") || ct.includes("text")) {
        try {
          parsed = JSON.parse(text);
          parseOk = true;
        } catch (e) {
          parseErr = e?.message || String(e);
        }
      }

      const { score, count, shape } = parseOk ? scoreListFromAny(parsed) : { score: 0, count: 0, shape: "unparsed" };

      captures.push({
        url,
        status,
        contentType: ct,
        size,
        looksJson,
        parseOk,
        parseErr,
        shape,
        count,
        score,
        sampleHead: text.slice(0, 1200),
      });
    } catch {
      // ignore
    }
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Allow Blazor/SignalR to connect and fetch data
  await page.waitForTimeout(10000);

  // Encourage additional loads
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(700);
  }

  await page.waitForTimeout(3000);

  await saveDebug(page);
  await browser.close();

  const rawPath = path.join(outDir, "viewer.raw.responses.json");
  await fs.writeFile(rawPath, JSON.stringify({ scrapedAt: new Date().toISOString(), captures }, null, 2), "utf8");
  console.log(`Wrote response capture log -> ${rawPath} (captures=${captures.length})`);

  // Pick best parsed candidate
  const best = captures
    .filter(c => c.parseOk && (c.count || 0) >= 50)
    .sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  if (!best) {
    throw new Error(
      "No large parsed payload found yet. Open data/viewer.raw.responses.json and look for the biggest response (size/count) or any endpoint that returns octet-stream. We'll target it directly next."
    );
  }

  // Refetch best URL directly and parse again (full size)
  const fullResp = await fetch(best.url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!fullResp.ok) throw new Error(`Refetch failed best.url=${best.url} status=${fullResp.status}`);

  // Attempt json() first, fallback to text->JSON
  let fullObj = null;
  try {
    fullObj = await fullResp.json();
  } catch {
    const t = await fullResp.text();
    fullObj = JSON.parse(t);
  }

  const list = extractList(fullObj);
  if (!Array.isArray(list) || list.length < 50) {
    throw new Error(`Best refetched payload does not contain usable list. listLen=${list?.length || 0}`);
  }

  const items = [];
  for (const r of list) {
    const n = normalizeRecord(r);
    if (n) items.push(n);
  }

  if (items.length < 50) {
    throw new Error(`Normalization too small (${items.length}). We need to tune field mapping based on actual payload keys.`);
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