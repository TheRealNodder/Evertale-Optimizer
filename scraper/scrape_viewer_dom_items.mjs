// scraper/scrape_viewer_dom_items.mjs
import fs from "fs";
import { chromium } from "playwright";

const URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT = "data/catalog.dom.raw.json";

const DEBUG_HTML = "data/_debug_viewer_dom_rendered.html";
const DEBUG_PNG  = "data/_debug_viewer_dom_screenshot.png";
const DEBUG_TXT  = "data/_debug_viewer_dom_counts.txt";

function ensureDataDir() {
  fs.mkdirSync("data", { recursive: true });
}

async function saveDebug(page, note = "") {
  try {
    const html = await page.content();
    fs.writeFileSync(DEBUG_HTML, html, "utf8");
  } catch {}
  try {
    await page.screenshot({ path: DEBUG_PNG, fullPage: true });
  } catch {}
  try {
    const counts = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll("img")];
      const fileImgs = imgs.filter(i => (i.src || "").includes("/files/"));
      const tables = document.querySelectorAll("table").length;
      const rows = document.querySelectorAll("tr").length;
      const bodyText = (document.body?.innerText || "").slice(0, 2000);
      return {
        imgs: imgs.length,
        fileImgs: fileImgs.length,
        tables,
        rows,
        bodyTextSample: bodyText
      };
    });
    fs.writeFileSync(
      DEBUG_TXT,
      `${note}\n\n` + JSON.stringify(counts, null, 2),
      "utf8"
    );
  } catch {}
}

// scroll helper (triggers lazy loads)
async function autoScroll(page, maxRounds = 12) {
  for (let i = 0; i < maxRounds; i++) {
    await page.evaluate(() => window.scrollBy(0, Math.max(800, window.innerHeight)));
    await page.waitForTimeout(800);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

async function run() {
  ensureDataDir();

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  const page = await context.newPage();

  console.log("Loading Viewer:", URL);

  // IMPORTANT: do NOT use networkidle on Blazor Server pages
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });

  // Give Blazor time to connect/render
  await page.waitForTimeout(3000);

  // Wait for *something* indicating real render:
  // - images from /files/
  // - table rows
  // - or /files/images/ appearing anywhere in HTML
  const ok = await Promise.race([
    page.waitForSelector("img[src*='/files/']", { timeout: 45000 }).then(() => true).catch(() => false),
    page.waitForSelector("tr", { timeout: 45000 }).then(() => true).catch(() => false),
    page.waitForFunction(
      () => (document.documentElement?.innerHTML || "").includes("/files/images/"),
      { timeout: 45000 }
    ).then(() => true).catch(() => false),
  ]);

  // trigger lazy-loading by scrolling
  await autoScroll(page, 14);

  // try extraction in multiple ways
  const items = await page.evaluate(() => {
    const results = [];

    // Prefer rows that contain an image from /files/
    const rows = [...document.querySelectorAll("tr")];

    for (const tr of rows) {
      const img = tr.querySelector("img");
      const src = img?.getAttribute("src") || img?.src || "";
      const text = (tr.innerText || "").replace(/\s+/g, " ").trim();

      if (!text) continue;

      // Ignore obvious header row
      if (text.toLowerCase().startsWith("name rarity element")) continue;

      if (src.includes("/files/")) {
        results.push({ text, image: src });
        continue;
      }

      // Fallback: sometimes images are background-image or inside other tags
      const anyFileLink = tr.querySelector("a[href*='/files/']")?.getAttribute("href") || "";
      if (anyFileLink) {
        results.push({ text, image: anyFileLink });
      }
    }

    // If still empty, try grabbing any images on page + nearby text blocks
    if (results.length === 0) {
      const imgs = [...document.querySelectorAll("img")]
        .map(i => i.getAttribute("src") || i.src || "")
        .filter(s => s.includes("/files/"));
      for (const src of imgs.slice(0, 4000)) {
        results.push({ text: src.split("/").pop() || src, image: src });
      }
    }

    return results;
  });

  if (!items.length) {
    console.log("No DOM items extracted — saving debug artifacts…");
    await saveDebug(page, "DOM extraction returned 0 items");
    await browser.close();
    throw new Error("No DOM items extracted");
  }

  // Write output
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: URL,
        count: items.length,
        items,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote ${items.length} DOM items -> ${OUT}`);

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});