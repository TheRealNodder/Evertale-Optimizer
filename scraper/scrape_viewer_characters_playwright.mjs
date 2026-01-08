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

  // Extract rows from current table page
  async function extractPageRows() {
    return await page.evaluate(() => {
      const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();
      const table = document.querySelector("table");
      if (!table) return [];

      const headers = Array.from(table.querySelectorAll("thead th, thead td"))
        .map(x => norm(x.textContent).toLowerCase());

      const rows = Array.from(table.querySelectorAll("tbody tr"))
        .map(tr => Array.from(tr.querySelectorAll("td, th")).map(td => norm(td.textContent)))
        .filter(cells => cells.length > 0);

      return { headers, rows };
    });
  }

  // Pagination: try to click a "Next" control if present
  async function clickNextIfPossible() {
    const candidates = [
      page.getByRole("button", { name: /next/i }),
      page.locator('button[aria-label*="next" i]'),
      page.locator('button:has-text("Next")'),
      page.locator('button:has-text("»")'),
      page.locator('a:has-text("Next")'),
      page.locator('a:has-text("»")'),
    ];

    for (const loc of candidates) {
      try {
        const el = loc.first();
        if (await el.count() === 0) continue;
        if (!(await el.isVisible({ timeout: 500 }))) continue;
        const disabled = await el.isDisabled().catch(() => false);
        if (disabled) continue;

        await el.click({ timeout: 3000 });
        await page.waitForTimeout(2500);
        return true;
      } catch {
        // try next candidate
      }
    }
    return false;
  }

  const all = [];
  const seen = new Set();

  const MAX_PAGES = 300;
  for (let p = 1; p <= MAX_PAGES; p++) {
    const { headers, rows } = await extractPageRows();

    if (!rows || rows.length === 0) {
      console.log(`No rows on page ${p}. Stopping.`);
      break;
    }

    const headerIndex = (key) => headers.findIndex(h => h.includes(key));

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
        id: name,     // stable fallback ID
        name,
        element,
        cost,
        atk,
        hp,
        spd,
        url: VIEWER_URL
      });
    }

    console.log(`Parsed page ${p}: +${rows.length} rows, total unique=${all.length}`);

    const moved = await clickNextIfPossible();
    if (!moved) {
      console.log("No Next button found. Stopping pagination.");
      break;
    }
  }

  await browser.close();

  // Refuse to overwrite with junk
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