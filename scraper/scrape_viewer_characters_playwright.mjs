// scraper/scrape_viewer_characters_playwright.mjs
// Robust Blazor Server scraper for Viewer page in GitHub Actions.
// Writes: data/characters.viewer.full.json
// On failure, writes debug artifacts:
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

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

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const htmlPath = path.join(outDir, "_debug_viewer_rendered.html");
  const pngPath = path.join(outDir, "_debug_viewer_screenshot.png");

  try {
    const html = await page.content();
    await fs.writeFile(htmlPath, html, "utf8");
    console.log(`Saved debug HTML: ${htmlPath}`);
  } catch (e) {
    console.log("Could not save debug HTML:", e?.message || e);
  }

  try {
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`Saved debug screenshot: ${pngPath}`);
  } catch (e) {
    console.log("Could not save screenshot:", e?.message || e);
  }
}

async function run() {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-features=site-per-process",
    ],
  });

  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    viewport: { width: 1400, height: 900 },
  });

  page.setDefaultTimeout(120000);

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });

  // Give Blazor Server time to connect + render
  await page.waitForTimeout(8000);

  // Wait for ANY of these "Viewer rendered" signals:
  // - table with rows
  // - a lot of <tr> anywhere
  // - "Page X of Y" text
  // - a lot of links/buttons (post-hydration)
  // - large body text length (virtualized renders can still show big text)
  const READY_TIMEOUT = 120000;

  try {
    await page.waitForFunction(() => {
      const table = document.querySelector("table");
      if (table && table.querySelectorAll("tbody tr").length >= 3) return true;

      const trs = document.querySelectorAll("tr");
      if (trs.length > 15) return true;

      const bodyText = document.body?.innerText || "";
      if (/page\s+\d+\s+of\s+\d+/i.test(bodyText)) return true;

      const anchors = document.querySelectorAll("a");
      const buttons = document.querySelectorAll("button");
      if (anchors.length + buttons.length > 80) return true;

      if (bodyText.length > 4000) return true;

      return false;
    }, { timeout: READY_TIMEOUT });
  } catch (e) {
    console.log("Viewer did not render in time. Capturing debug artifacts...");
    await saveDebug(page);
    await browser.close();
    throw new Error(`Viewer hydration timeout: ${e?.message || e}`);
  }

  // At this point, something rendered. Try to extract from a table if present.
  async function extractTablePage() {
    return await page.evaluate(() => {
      const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();
      const table = document.querySelector("table");
      if (!table) return null;

      const headers = Array.from(table.querySelectorAll("thead th, thead td"))
        .map(x => norm(x.textContent).toLowerCase());

      const rows = Array.from(table.querySelectorAll("tbody tr"))
        .map(tr => Array.from(tr.querySelectorAll("td, th")).map(td => norm(td.textContent)))
        .filter(cells => cells.length > 0);

      return { headers, rows };
    });
  }

  // If table isn’t present, fall back to dumping visible text into debug and fail clearly.
  const firstPage = await extractTablePage();
  if (!firstPage || !firstPage.rows || firstPage.rows.length === 0) {
    console.log("No table rows found even though Viewer rendered. Saving debug artifacts...");
    await saveDebug(page);
    await browser.close();
    throw new Error("Viewer rendered, but table rows were not found. Likely layout changed or needs different selectors.");
  }

  // Pagination helpers
  async function clickNextIfPossible() {
    const candidates = [
      page.getByRole("button", { name: /next/i }),
      page.locator('button[aria-label*="next" i]'),
      page.locator('button:has-text("Next")'),
      page.locator('button:has-text("»")'),
      page.locator('a:has-text("Next")'),
      page.locator('a:has-text("»")'),
      page.locator('button:has-text(">")'),
    ];

    for (const loc of candidates) {
      try {
        const el = loc.first();
        if (await el.count() === 0) continue;
        if (!(await el.isVisible({ timeout: 700 }))) continue;
        const disabled = await el.isDisabled().catch(() => false);
        if (disabled) continue;

        await el.click({ timeout: 5000 });
        await page.waitForTimeout(2500);
        return true;
      } catch {
        // try next
      }
    }
    return false;
  }

  const all = [];
  const seen = new Set();

  const MAX_PAGES = 300;

  for (let p = 1; p <= MAX_PAGES; p++) {
    const { headers, rows } = (await extractTablePage()) || { headers: [], rows: [] };
    if (!rows.length) break;

    const headerIndex = (key) => (headers || []).findIndex(h => h.includes(key));

    const idxName = 0;
    const idxCost = headerIndex("cost");
    const idxAtk  = headerIndex("atk");
    const idxHp   = headerIndex("hp");
    const idxSpd  = headerIndex("spd");
    const idxElem = headerIndex("element");

    for (const cells of rows) {
      const name = normText(cells[idxName] ?? "");
      if (!name) continue;
      if (seen.has(name)) continue;
      seen.add(name);

      const cost = parseNumberish(idxCost >= 0 ? cells[idxCost] : cells[1]);
      const atk  = parseNumberish(idxAtk  >= 0 ? cells[idxAtk]  : cells[2]);
      const hp   = parseNumberish(idxHp   >= 0 ? cells[idxHp]   : cells[3]);
      const spd  = parseNumberish(idxSpd  >= 0 ? cells[idxSpd]  : cells[4]);
      const element = normText(idxElem >= 0 ? cells[idxElem] : (cells[5] ?? ""));

      all.push({
        id: name,
        name,
        element,
        cost,
        atk,
        hp,
        spd,
        url: VIEWER_URL
      });
    }

    console.log(`Parsed page ${p}: total unique=${all.length}`);

    const moved = await clickNextIfPossible();
    if (!moved) {
      console.log("No Next button found. Stopping pagination.");
      break;
    }
  }

  await browser.close();

  if (all.length < 50) {
    throw new Error(`Viewer extraction too small (${all.length}). Refusing to write output.`);
  }

  const outPath = path.join(outDir, "characters.viewer.full.json");
  await writeJson(outPath, {
    source: VIEWER_URL,
    scrapedAt: new Date().toISOString(),
    characters: all,
  });

  console.log(`Wrote ${all.length} characters -> ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});