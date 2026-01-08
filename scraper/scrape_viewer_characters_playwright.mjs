// scraper/scrape_viewer_characters_playwright.mjs
// Scrapes the Toolbox Viewer (Blazor Server) with Playwright and writes:
//   data/characters.viewer.full.json
//
// NOTE: We do NOT scrape Explorer; it's unreliable in CI. Viewer is the data source.

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

function normText(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function parseNumberish(s) {
  const m = String(s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filepath, obj) {
  await fs.writeFile(filepath, JSON.stringify(obj, null, 2), "utf8");
}

async function run() {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  page.setDefaultTimeout(90000);

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "load", timeout: 90000 });

  // Blazor hydration time
  await page.waitForTimeout(6000);

  // Wait for something table-like to appear
  await page.waitForFunction(() => {
    const t = document.querySelector("table");
    if (t && t.querySelectorAll("tbody tr").length >= 5) return true;
    // fallback: any big list of elements
    const rows = document.querySelectorAll("tbody tr, tr, .row, .list-group-item");
    return rows.length > 25;
  }, { timeout: 90000 });

  // Try to switch type filter to "Characters" if there is a dropdown/select
  // (best-effort; harmless if absent)
  try {
    const selects = page.locator("select");
    if (await selects.count()) {
      const sel = selects.first();
      const options = await sel.locator("option").allTextContents();
      const idx = options.findIndex(t => t.toLowerCase().includes("character"));
      if (idx >= 0) {
        await sel.selectOption({ index: idx });
        await page.waitForTimeout(2000);
      }
    }
  } catch {
    // ignore
  }

 