// scraper/scrape_viewer_characters_playwright.mjs
// Capture Viewer traffic (HTTP + WS) and ALWAYS succeed so logs get committed.
// Outputs:
//   data/viewer.raw.responses.json
//   data/viewer.raw.ws.json
// Debug:
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DOMAIN_HINT = "evertaletoolbox2.runasp.net";

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

function safeSlice(str, n = 800) {
  const s = String(str ?? "");
  return s.length > n ? s.slice(0, n) + "..." : s;
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

  // ---------- HTTP capture ----------
  const httpCaptures = [];
  const MAX_HTTP = 200;

  page.on("response", async (resp) => {
    try {
      const url = resp.url();
      if (!url.includes(DOMAIN_HINT)) return;
      if (httpCaptures.length >= MAX_HTTP) return;

      const status = resp.status();
      const ct = (resp.headers()["content-type"] || "").toLowerCase();

      if (status < 200 || status >= 300) {
        httpCaptures.push({ url, status, contentType: ct, note: "non-2xx" });
        return;
      }

      const buf = await resp.body().catch(() => null);
      const size = buf ? buf.length : 0;

      // capture a small sample (so file doesn't explode)
      const sample = buf ? buf.subarray(0, Math.min(size, 20000)).toString("utf8") : "";

      httpCaptures.push({
        url,
        status,
        contentType: ct,
        size,
        sampleHead: safeSlice(sample, 900),
      });
    } catch {}
  });

  // ---------- WebSocket capture ----------
  const wsFrames = [];
  const MAX_WS = 250;

  page.on("websocket", (ws) => {
    const wsUrl = ws.url();

    const record = (direction, payload) => {
      try {
        if (wsFrames.length >= MAX_WS) return;

        let text = "";
        if (typeof payload === "string") text = payload;
        else if (Buffer.isBuffer(payload)) text = payload.toString("utf8");
        else text = String(payload);

        // Keep a small sample
        wsFrames.push({
          wsUrl,
          direction,
          length: text.length,
          sampleHead: safeSlice(text, 900),
        });
      } catch {}
    };

    ws.on("framereceived", (evt) => record("recv", evt.payload));
    ws.on("framesent", (evt) => record("sent", evt.payload));
  });

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Let Blazor connect
  await page.waitForTimeout(12000);

  // Encourage more traffic
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => window.scrollBy(0, 1600));
    await page.waitForTimeout(600);
  }

  await page.waitForTimeout(3000);

  await saveDebug(page);
  await browser.close();

  // Write raw logs
  const httpPath = path.join(outDir, "viewer.raw.responses.json");
  const wsPath = path.join(outDir, "viewer.raw.ws.json");

  await fs.writeFile(
    httpPath,
    JSON.stringify({ scrapedAt: new Date().toISOString(), captures: httpCaptures }, null, 2),
    "utf8"
  );
  await fs.writeFile(
    wsPath,
    JSON.stringify({ scrapedAt: new Date().toISOString(), frames: wsFrames }, null, 2),
    "utf8"
  );

  console.log(`Wrote HTTP capture log -> ${httpPath} (captures=${httpCaptures.length})`);
  console.log(`Wrote WS capture log   -> ${wsPath} (frames=${wsFrames.length})`);

  // Print top candidates into Actions log
  const topHttp = [...httpCaptures]
    .filter(x => typeof x.size === "number")
    .sort((a, b) => (b.size || 0) - (a.size || 0))
    .slice(0, 15);

  const topWs = [...wsFrames]
    .filter(x => typeof x.length === "number")
    .sort((a, b) => (b.length || 0) - (a.length || 0))
    .slice(0, 15);

  console.log("=== TOP HTTP by size ===");
  for (const h of topHttp) {
    console.log(`size=${h.size} ct=${h.contentType} url=${h.url}`);
  }

  console.log("=== TOP WS by length ===");
  for (const f of topWs) {
    console.log(`len=${f.length} dir=${f.direction} ws=${f.wsUrl}`);
  }

  // IMPORTANT: do NOT fail the job — we want these logs committed.
  console.log("Done. (Not failing even if we didn't identify the big dataset yet.)");
}

run().catch((err) => {
  // Still do not fail the job—write what we can and exit 0
  console.error("SCRAPER ERROR (non-fatal):", err);
  process.exit(0);
});