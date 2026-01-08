// scraper/scrape_viewer_characters_playwright.mjs
// Robust Viewer scraper for Blazor/MudBlazor.
// - Supports MudSelect (non-<select>) type filters
// - Supports table/grid layouts
// - Supports virtualized scrolling (no Next button required)
// Output:
//   data/viewer.toolbox.full.json
// Debug (on failure or small scrape):
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
    viewport: { width: 1500, height: 950 },
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  page.setDefaultTimeout(120000);

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(9000); // Blazor hydration

  // Wait for something interactive to appear
  try {
    await page.waitForFunction(() => {
      const txt = document.body?.innerText || "";
      const rows = document.querySelectorAll("tr,[role='row'],.mud-table-row,.mud-data-grid-row").length;
      const selects =
        document.querySelectorAll("select,.mud-select,[role='combobox'],[aria-haspopup='listbox']").length;
      return rows > 5 || selects > 0 || txt.length > 2500;
    }, { timeout: 120000 });
  } catch (e) {
    await saveDebug(page);
    await browser.close();
    throw new Error(`Viewer did not render: ${e?.message || e}`);
  }

  // ---------- Helpers to extract rows ----------
  async function extractVisibleRows() {
    return await page.evaluate(() => {
      const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

      // TABLE PATH
      const table = document.querySelector("table");
      if (table) {
        const rows = Array.from(table.querySelectorAll("tbody tr"))
          .map(tr => Array.from(tr.querySelectorAll("td,th")).map(td => norm(td.textContent)))
          .filter(cells => cells.length > 0);
        return { mode: "table", rows };
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
        ".mud-data-grid-cell",
        "[role='cell']",
      ];

      let rowEls = [];
      for (const sel of rowSelectors) {
        const found = Array.from(document.querySelectorAll(sel));
        if (found.length > rowEls.length) rowEls = found;
      }

      rowEls = rowEls.filter(r => norm(r.textContent).length > 0);

      const rows = rowEls.map(r => {
        let cells = [];
        for (const csel of cellSelectors) {
          const cs = Array.from(r.querySelectorAll(csel)).map(c => norm(c.textContent)).filter(Boolean);
          if (cs.length > cells.length) cells = cs;
        }
        if (!cells.length) {
          const t = norm(r.textContent);
          // try split on multiple spaces
          const split = t.split("  ").map(x => norm(x)).filter(Boolean);
          cells = split.length ? split : (t ? [t] : []);
        }
        return cells;
      }).filter(cells => cells.length > 0);

      return { mode: "grid", rows };
    });
  }

  // ---------- MudSelect handling ----------
  // We attempt to find a "type" control and select an option by clicking.
  // This supports MudSelect / combobox / listbox patterns.
  async function selectTypeOption(optionText) {
    const wanted = optionText.toLowerCase();

    // Candidates for the "type" opener (MudSelect / combobox)
    const openers = [
      page.locator(".mud-select"), // MudBlazor select root
      page.locator("[role='combobox']"),
      page.locator("[aria-haspopup='listbox']"),
      // Sometimes the label exists, so prefer a select near a label containing "Type"
      page.locator(":has-text('Type') .mud-select"),
      page.locator(":has-text('Category') .mud-select"),
    ];

    // Find the first visible opener
    let opener = null;
    for (const cand of openers) {
      try {
        const el = cand.first();
        if (await el.count() === 0) continue;
        if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
          opener = el;
          break;
        }
      } catch {}
    }

    if (!opener) {
      return false;
    }

    // Click opener to show menu/popover
    await opener.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(700);

    // Options usually appear in a popover: .mud-list-item, [role=option], li, button
    const optionLocators = [
      page.locator(".mud-popover .mud-list-item"),
      page.locator(".mud-popover [role='option']"),
      page.locator("[role='listbox'] [role='option']"),
      page.locator(".mud-overlay + div .mud-list-item"),
      page.locator("li[role='option']"),
      page.locator("div[role='option']"),
    ];

    // Find and click the matching option
    for (const loc of optionLocators) {
      try {
        const count = await loc.count();
        for (let i = 0; i < Math.min(count, 200); i++) {
          const opt = loc.nth(i);
          const txt = (await opt.innerText().catch(() => "")) || "";
          if (txt.toLowerCase().includes(wanted)) {
            await opt.click({ timeout: 5000 });
            await page.waitForTimeout(1800); // rerender
            return true;
          }
        }
      } catch {}
    }

    // Close menu if open
    try { await page.keyboard.press("Escape"); } catch {}
    return false;
  }

  // ---------- Virtualized scrolling ----------
  // Scroll the main list container until no new names are found.
  async function scrapeByScrolling(typeKey) {
    const seen = new Set();
    const results = [];

    // Try to find a scroll container (MudBlazor often uses mud-table-container or mud-virtualize)
    const containerSelectors = [
      ".mud-table-container",
      ".mud-virtualize",
      ".mud-data-grid",
      "main",
      "body",
    ];

    // Pick first existing selector in the page
    let containerSel = "body";
    for (const sel of containerSelectors) {
      if (await page.locator(sel).first().count().catch(() => 0)) {
        containerSel = sel;
        break;
      }
    }

    const MAX_SCROLLS = 220;
    let stagnant = 0;

    for (let s = 1; s <= MAX_SCROLLS; s++) {
      const { rows } = await extractVisibleRows();
      if (rows?.length) {
        for (const cells of rows) {
          const name = normText(cells[0] ?? "");
          if (!name) continue;
          const key = `${typeKey}::${name}`;
          if (seen.has(key)) continue;
          seen.add(key);

          // best-effort mapping
          results.push({
            id: name,
            type: typeKey,
            name,
            element: normText(cells[5] ?? ""),
            cost: parseNumberish(cells[1]),
            atk: parseNumberish(cells[2]),
            hp: parseNumberish(cells[3]),
            spd: parseNumberish(cells[4]),
            url: VIEWER_URL,
            _raw: cells,
          });
        }
      }

      // If we didn’t add anything new for a few scrolls, stop
      const currentCount = results.length;
      if (s > 1 && currentCount === (scrapeByScrolling._lastCount || 0)) stagnant++;
      else stagnant = 0;
      scrapeByScrolling._lastCount = currentCount;

      if (stagnant >= 6) break;

      // Scroll down
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) || document.body;
        // try scrolling the element; fallback to window
        if (el && el.scrollBy) el.scrollBy(0, 1200);
        window.scrollBy(0, 1200);
      }, containerSel);

      await page.waitForTimeout(550);
    }

    return results;
  }

  // ---------- Run by types ----------
  const targets = [
    { key: "character", pick: ["character", "characters", "unit", "units"] },
    { key: "weapon", pick: ["weapon", "weapons"] },
    { key: "accessory", pick: ["accessory", "accessories"] },
    { key: "enemy", pick: ["enemy", "enemies"] },
    { key: "boss", pick: ["boss", "bosses"] },
  ];

  const byType = Object.fromEntries(targets.map(t => [t.key, []]));

  // Try selecting each type via MudSelect
  let anyTypeSelected = false;

  for (const t of targets) {
    let selected = false;
    for (const label of t.pick) {
      selected = await selectTypeOption(label);
      if (selected) break;
    }

    if (!selected) {
      console.log(`Type selector not found or option missing for "${t.key}" (will still scrape current view only if nothing works).`);
    } else {
      anyTypeSelected = true;
      console.log(`Selected type=${t.key}, scraping via scroll...`);
      byType[t.key] = await scrapeByScrolling(t.key);
      console.log(`Scraped type=${t.key} count=${byType[t.key].length}`);
    }
  }

  // If we could not switch types at all, scrape once as "character"
  if (!anyTypeSelected) {
    console.log("WARNING: Could not find a usable type selector. Scraping once as 'character' via scroll.");
    byType.character = await scrapeByScrolling("character");
    console.log(`Scraped type=character count=${byType.character.length}`);
  }

  const total = Object.values(byType).reduce((a, arr) => a + (arr?.length || 0), 0);

  if (total < 50) {
    console.log("Total scrape too small; saving debug for inspection...");
    await saveDebug(page);
    await browser.close();
    throw new Error(`Viewer scrape too small total=${total}.`);
  }

  await browser.close();

  await writeJson(path.resolve(process.cwd(), OUT_FILE), {
    source: VIEWER_URL,
    scrapedAt: new Date().toISOString(),
    byType,
  });

  console.log(`Wrote ${OUT_FILE} total=${total}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});