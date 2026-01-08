// scraper/scrape_viewer_characters_playwright.mjs
// Robust Blazor Viewer scraper (table OR MudBlazor grid/div layout).
// Writes: data/characters.viewer.full.json
// On failure writes:
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

  // Blazor hydration time
  await page.waitForTimeout(8000);

  // Wait for “something rendered”
  try {
    await page.waitForFunction(() => {
      const bodyText = document.body?.innerText || "";
      const tables = document.querySelectorAll("table");
      const trs = document.querySelectorAll("tr");
      const mudRows =
        document.querySelectorAll(".mud-table-row, .mud-virtualize, .mud-data-grid, [role='row']").length;

      if (tables.length) return true;
      if (trs.length > 10) return true;
      if (mudRows > 10) return true;
      if (/page\s+\d+\s+of\s+\d+/i.test(bodyText)) return true;
      if (bodyText.length > 4000) return true;
      return false;
    }, { timeout: 120000 });
  } catch (e) {
    console.log("Viewer did not render in time. Capturing debug artifacts...");
    await saveDebug(page);
    await browser.close();
    throw new Error(`Viewer hydration timeout: ${e?.message || e}`);
  }

  // Extract visible rows (table OR MudBlazor-like div rows)
  async function extractVisibleRows() {
    return await page.evaluate(() => {
      const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

      // 1) TABLE PATH
      const table = document.querySelector("table");
      if (table) {
        const headers = Array.from(table.querySelectorAll("thead th, thead td"))
          .map(x => norm(x.textContent).toLowerCase());

        const rows = Array.from(table.querySelectorAll("tbody tr"))
          .map(tr => Array.from(tr.querySelectorAll("td, th")).map(td => norm(td.textContent)))
          .filter(cells => cells.length > 0);

        return { mode: "table", headers, rows };
      }

      // 2) MUDBLAZOR / GRID / DIV ROW PATHS
      // Try common row/cell patterns.
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

      // Filter out header-ish rows where possible
      rowsEls = rowsEls.filter(r => !r.querySelector("th") && norm(r.textContent).length > 0);

      const rows = rowsEls.map(r => {
        // If row has clear cell nodes, use them; else fallback to splitting text
        let cells = [];
        for (const csel of cellSelectors) {
          const cs = Array.from(r.querySelectorAll(csel)).map(c => norm(c.textContent)).filter(Boolean);
          if (cs.length > cells.length) cells = cs;
        }
        if (!cells.length) {
          // fallback: split row text on big spaces
          const t = norm(r.textContent);
          cells = t ? t.split("  ").map(x => norm(x)).filter(Boolean) : [];
          // If split fails, return single cell
          if (!cells.length && t) cells = [t];
        }
        return cells;
      }).filter(cells => cells.length > 0);

      // We may not have headers in grid mode
      return { mode: "grid", headers: [], rows };
    });
  }

  // Click “Next” in many possible paging UIs
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
      } catch {
        // keep trying
      }
    }
    return false;
  }

  const all = [];
  const seen = new Set();

  const MAX_PAGES = 350;

  for (let p = 1; p <= MAX_PAGES; p++) {
    const { rows } = await extractVisibleRows();

    if (!rows || rows.length === 0) {
      console.log(`No rows found on page ${p}. Stopping.`);
      break;
    }

    // We assume first cell is name; others are stats-ish.
    // This is best-effort and will be refined once we see the debug HTML.
    for (const cells of rows) {
      const name = normText(cells[0] ?? "");
      if (!name) continue;
      if (seen.has(name)) continue;
      seen.add(name);

      // Try to interpret common columns if present
      const cost = parseNumberish(cells[1]);
      const atk  = parseNumberish(cells[2]);
      const hp   = parseNumberish(cells[3]);
      const spd  = parseNumberish(cells[4]);
      const element = normText(cells[5] ?? "");

      all.push({
        id: name,
        name,
        element,
        cost,
        atk,
        hp,
        spd,
        url: VIEWER_URL,
        _raw: cells, // keep raw row to debug mapping later
      });
    }

    console.log(`Parsed page ${p}: total unique=${all.length}`);

    const moved = await clickNextIfPossible();
    if (!moved) {
      console.log("No Next button found. Stopping pagination.");
      break;
    }
  }

  // If we got almost nothing, save debug and fail
  if (all.length < 50) {
    console.log("Extraction too small; saving debug artifacts...");
    await saveDebug(page);
    await browser.close();
    throw new Error(`Viewer extraction too small (${all.length}). Refusing to write output.`);
  }

  await browser.close();

  const outPath = path.join(outDir, "characters.viewer.full.json");
  await writeJson(outPath, {
    source: VIEWER_URL,
    scrapedAt: new Date().toISOString(),
    characters: all,
  });

  console.log(`Wrote ${all.length} items -> ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});