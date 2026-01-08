// scraper/scrape_viewer_characters_playwright.mjs
// Scrape Viewer by TYPE (character/weapon/accessory/enemy/boss) and save:
//   data/viewer.toolbox.full.json
// Debug (on failure):
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_FILE = "data/viewer.toolbox.full.json";

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
  await ensureDir(path.resolve(process.cwd(), "data"));

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  page.setDefaultTimeout(120000);

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(8000); // Blazor hydration

  // Wait for “something rendered”
  try {
    await page.waitForFunction(() => {
      const bodyText = document.body?.innerText || "";
      if (document.querySelectorAll("select").length) return true;
      if (document.querySelector("table")) return true;
      if (document.querySelectorAll(".mud-table-row,[role='row']").length > 10) return true;
      if (bodyText.length > 2000) return true;
      return false;
    }, { timeout: 120000 });
  } catch (e) {
    console.log("Viewer did not render in time. Capturing debug artifacts...");
    await saveDebug(page);
    await browser.close();
    throw new Error(`Viewer hydration timeout: ${e?.message || e}`);
  }

  // Extract visible rows (table OR grid)
  async function extractVisibleRows() {
    return await page.evaluate(() => {
      const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

      // TABLE PATH
      const table = document.querySelector("table");
      if (table) {
        const headers = Array.from(table.querySelectorAll("thead th, thead td"))
          .map(x => norm(x.textContent).toLowerCase());

        const rows = Array.from(table.querySelectorAll("tbody tr"))
          .map(tr => Array.from(tr.querySelectorAll("td, th")).map(td => norm(td.textContent)))
          .filter(cells => cells.length > 0);

        return { mode: "table", headers, rows };
      }

      // GRID / MUD PATH
      const rowSelectors = [
        ".mud-table-body .mud-table-row",
        ".mud-table-row",
        ".mud-data-grid-row",
        "[role='row']",
      ];
      const cellSelectors = [
        ".mud-table-cell",
        ".mud-td",
        "[role='cell']",
        ".mud-data-grid-cell",
      ];

      let rowsEls = [];
      for (const sel of rowSelectors) {
        const found = Array.from(document.querySelectorAll(sel));
        if (found.length > rowsEls.length) rowsEls = found;
      }

      rowsEls = rowsEls.filter(r => norm(r.textContent).length > 0);

      const rows = rowsEls.map(r => {
        let cells = [];
        for (const csel of cellSelectors) {
          const cs = Array.from(r.querySelectorAll(csel)).map(c => norm(c.textContent)).filter(Boolean);
          if (cs.length > cells.length) cells = cs;
        }
        if (!cells.length) {
          const t = norm(r.textContent);
          cells = t ? t.split("  ").map(x => norm(x)).filter(Boolean) : [];
          if (!cells.length && t) cells = [t];
        }
        return cells;
      }).filter(cells => cells.length > 0);

      return { mode: "grid", headers: [], rows };
    });
  }

  async function clickNextIfPossible() {
    const candidates = [
      page.getByRole("button", { name: /next/i }),
      page.locator('button[aria-label*="next" i]'),
      page.locator('button:has-text("Next")'),
      page.locator('button:has-text("»")'),
      page.locator('a:has-text("Next")'),
      page.locator('a:has-text("»")'),
      page.locator('button:has-text(">")'),
      page.locator('button:has-text("›")'),
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
      } catch {}
    }
    return false;
  }

  // Find a select that contains at least one of our keywords
  const targets = [
    { key: "character", keywords: ["character", "characters", "unit", "units"] },
    { key: "weapon", keywords: ["weapon", "weapons"] },
    { key: "accessory", keywords: ["accessory", "accessories"] },
    { key: "enemy", keywords: ["enemy", "enemies"] },
    { key: "boss", keywords: ["boss", "bosses"] },
  ];

  async function getSelectOptions(selectLocator) {
    const options = await selectLocator.locator("option").allTextContents();
    return options.map(o => normText(o));
  }

  async function pickTypeSelect() {
    const selects = page.locator("select");
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const sel = selects.nth(i);
      const opts = (await getSelectOptions(sel)).map(o => o.toLowerCase());
      const hits = targets.reduce((acc, t) => acc + (t.keywords.some(k => opts.some(o => o.includes(k))) ? 1 : 0), 0);
      if (hits >= 2) return sel; // good candidate
    }
    return null;
  }

  const typeSelect = await pickTypeSelect();

  const byType = {};
  for (const t of targets) byType[t.key] = [];

  if (!typeSelect) {
    // No type selector found — still scrape once as “character” but keep raw.
    console.log("WARNING: Could not find a type selector. Scraping once as 'character'.");
    const scraped = await scrapeCurrentView("character");
    byType.character = scraped;
  } else {
    const opts = await getSelectOptions(typeSelect);
    const optsLower = opts.map(o => o.toLowerCase());

    for (const t of targets) {
      const idx = optsLower.findIndex(o => t.keywords.some(k => o.includes(k)));
      if (idx < 0) {
        console.log(`Type option not found for: ${t.key} (skipping)`);
        continue;
      }

      console.log(`Selecting type: ${t.key} -> "${opts[idx]}"`);
      await typeSelect.selectOption({ index: idx });
      await page.waitForTimeout(2500); // allow rerender

      const scraped = await scrapeCurrentView(t.key);
      byType[t.key] = scraped;
    }
  }

  await browser.close();

  // Basic sanity check: at least one category should have > 50 rows.
  const total = Object.values(byType).reduce((a, arr) => a + (arr?.length || 0), 0);
  if (total < 50) {
    throw new Error(`Viewer scrape too small total=${total}.`);
  }

  await writeJson(path.resolve(process.cwd(), OUT_FILE), {
    source: VIEWER_URL,
    scrapedAt: new Date().toISOString(),
    byType,
  });

  console.log(`Wrote viewer toolbox dataset -> ${OUT_FILE} (total=${total})`);

  // ---- inner function uses closures above ----
  async function scrapeCurrentView(typeKey) {
    // reset paging to first page if there’s a “first” button (best-effort)
    try {
      const firstBtn = page.getByRole("button", { name: /first/i });
      if (await firstBtn.count()) {
        await firstBtn.first().click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
    } catch {}

    const results = [];
    const seen = new Set();
    const MAX_PAGES = 350;

    for (let p = 1; p <= MAX_PAGES; p++) {
      const { rows } = await extractVisibleRows();
      if (!rows || rows.length === 0) break;

      for (const cells of rows) {
        const name = normText(cells[0] ?? "");
        if (!name) continue;
        const unique = `${typeKey}::${name}`;
        if (seen.has(unique)) continue;
        seen.add(unique);

        // Best-effort stats mapping (will improve once we inspect the actual columns per type)
        const cost = parseNumberish(cells[1]);
        const atk  = parseNumberish(cells[2]);
        const hp   = parseNumberish(cells[3]);
        const spd  = parseNumberish(cells[4]);
        const element = normText(cells[5] ?? "");

        results.push({
          id: name,
          type: typeKey,
          name,
          element,
          cost,
          atk,
          hp,
          spd,
          url: VIEWER_URL,
          _raw: cells,
        });
      }

      const moved = await clickNextIfPossible();
      if (!moved) break;
    }

    console.log(`Scraped type=${typeKey} count=${results.length}`);
    return results;
  }
}

run().catch(async (err) => {
  console.error(err);
  process.exit(1);
});