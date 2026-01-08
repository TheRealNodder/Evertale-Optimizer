// scraper/scrape_viewer_characters_playwright.mjs
import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

function normText(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function absUrl(base, maybe) {
  try { return new URL(maybe, base).toString(); } catch { return null; }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filepath, obj) {
  const text = JSON.stringify(obj, null, 2);
  await fs.writeFile(filepath, text, "utf8");
}

function parseNumberish(s) {
  const m = String(s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

async function run() {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });
  page.setDefaultTimeout(45000);

  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });

  // Blazor hydration delay
  await page.waitForTimeout(4000);

  // Wait for a table or a list of rows to appear
  await page.waitForFunction(() => {
    const table = document.querySelector("table");
    if (table && table.querySelectorAll("tr").length > 5) return true;

    // fallback: any repeating rows/cards
    const rows = document.querySelectorAll("tr, .row, .list-group-item");
    return rows.length > 20;
  }, { timeout: 45000 });

  // Try to switch filter/type to Characters if there is a select
  // (safe: ignore if not found)
  try {
    const select = page.locator("select");
    if (await select.count()) {
      // Try common options
      const optionsText = await select.first().locator("option").allTextContents();
      const idx = optionsText.findIndex(t => t.toLowerCase().includes("character"));
      if (idx >= 0) {
        await select.first().selectOption({ index: idx });
        await page.waitForTimeout(2000);
      }
    }
  } catch {
    // ignore
  }

  // Helper: extract current page table rows
  async function extractPageRows() {
    return await page.evaluate(() => {
      const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

      const table = document.querySelector("table");
      if (!table) return [];

      const headers = Array.from(table.querySelectorAll("thead th, thead td"))
        .map(th => norm(th.textContent).toLowerCase());

      const bodyRows = Array.from(table.querySelectorAll("tbody tr"))
        .map(tr => {
          const cells = Array.from(tr.querySelectorAll("td, th")).map(td => norm(td.textContent));
          return { headers, cells };
        })
        .filter(r => r.cells.length > 0);

      // If no thead, fallback to first row as headers
      if (!headers.length && bodyRows.length) {
        return bodyRows.map(r => ({ headers: [], cells: r.cells }));
      }
      return bodyRows;
    });
  }

  // Optional: click a row to open a dialog and scrape key/value pairs
  async function scrapeRowDetailsByClick(rowIndex) {
    // This is “best-effort”; it won’t break if UI doesn’t open dialogs.
    try {
      const row = page.locator("table tbody tr").nth(rowIndex);
      if (!(await row.count())) return null;

      await row.click({ timeout: 5000 });
      // wait briefly to see if a modal/dialog appears
      const dialog = page.locator('[role="dialog"], .modal, .mud-dialog, .blazored-modal');
      await dialog.first().waitFor({ timeout: 2500 });

      const details = await dialog.first().evaluate((dlg) => {
        const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

        // Collect dt/dd
        const out = {};
        const dts = dlg.querySelectorAll("dt");
        const dds = dlg.querySelectorAll("dd");
        if (dts.length && dds.length && dts.length === dds.length) {
          for (let i = 0; i < dts.length; i++) {
            out[norm(dts[i].textContent)] = norm(dds[i].textContent);
          }
          return out;
        }

        // Collect 2-column rows
        const rows = Array.from(dlg.querySelectorAll("tr"))
          .map(tr => Array.from(tr.querySelectorAll("td,th")).map(td => norm(td.textContent)))
          .filter(r => r.length >= 2);

        for (const r of rows) {
          const k = r[0];
          const v = r.slice(1).join(" | ");
          if (k) out[k] = v;
        }

        // If still empty, capture raw text
        if (!Object.keys(out).length) {
          out["_text"] = norm(dlg.textContent);
        }
        return out;
      });

      // close dialog (Escape)
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      return details;
    } catch {
      // if no dialog, just ignore
      try { await page.keyboard.press("Escape"); } catch {}
      return null;
    }
  }

  const allUnits = [];
  const seenNames = new Set();

  // Pagination loop: click Next button if present
  const MAX_PAGES = 250;
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const rows = await extractPageRows();

    if (!rows.length) {
      console.log(`No rows on page ${pageNum}, stopping.`);
      break;
    }

    // Convert rows into units
    // We try to map by header name when possible; otherwise use cell positions.
    for (let i = 0; i < rows.length; i++) {
      const { headers, cells } = rows[i];

      const name = normText(cells[0]);
      if (!name) continue;
      if (seenNames.has(name)) continue;
      seenNames.add(name);

      // Best-effort mapping
      const getByHeader = (key, fallbackIdx) => {
        if (headers?.length) {
          const idx = headers.findIndex(h => h.includes(key));
          if (idx >= 0 && idx < cells.length) return cells[idx];
        }
        return cells[fallbackIdx] ?? "";
      };

      const cost = parseNumberish(getByHeader("cost", 1));
      const atk  = parseNumberish(getByHeader("atk", 2));
      const hp   = parseNumberish(getByHeader("hp", 3));
      const spd  = parseNumberish(getByHeader("spd", 4));
      const element = normText(getByHeader("element", 5));

      // optional deep scrape on first ~30 rows per page (keeps runtime sane)
      let details = null;
      if (i < 30) {
        details = await scrapeRowDetailsByClick(i);
      }

      allUnits.push({
        id: name,            // stable id fallback (name); catalog uses href ids, merge uses name fallback
        name,
        element: element || "",
        cost,
        atk,
        hp,
        spd,
        details,
        url: VIEWER_URL,
      });
    }

    console.log(`Parsed page ${pageNum}: total units so far ${allUnits.length}`);

    // Try to find and click a Next button
    const nextCandidates = [
      page.getByRole("button", { name: /next/i }),
      page.locator('button[aria-label*="Next" i]'),
      page.locator('button:has-text("»")'),
      page.locator('a:has-text("Next")'),
      page.locator('a:has-text("»")'),
    ];

    let clicked = false;
    for (const cand of nextCandidates) {
      try {
        if (await cand.first().isVisible({ timeout: 500 })) {
          const disabled = await cand.first().isDisabled().catch(() => false);
          if (disabled) continue;

          await cand.first().click({ timeout: 2000 });
          await page.waitForTimeout(2000); // let Blazor render new page
          clicked = true;
          break;
        }
      } catch {
        // keep trying
      }
    }

    if (!clicked) {
      console.log("No Next button found/clicked. Stopping pagination.");
      break;
    }
  }

  await browser.close();

  // HARD FAIL if extraction is suspiciously small
  if (allUnits.length < 50) {
    throw new Error(
      `Viewer extraction too small (${allUnits.length}). Refusing to write empty character stats JSON.`
    );
  }

  const outPath = path.join(outDir, "characters.viewer.full.json");
  await writeJson(outPath, {
    source: VIEWER_URL,
    scrapedAt: new Date().toISOString(),
    characters: allUnits,
  });

  console.log(`Wrote ${allUnits.length} characters -> ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});