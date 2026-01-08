// scraper/scrape_viewer_dom_items.mjs
// DOM table extractor: pulls headers + table rows into structured objects
// Output: data/catalog.dom.raw.json  { url, generatedAt, headers, items }

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DATA_DIR = path.resolve("data");
const OUT_FILE = path.join(DATA_DIR, "catalog.dom.raw.json");

const DEBUG_HTML = path.join(DATA_DIR, "_debug_viewer_rendered.html");
const DEBUG_PNG = path.join(DATA_DIR, "_debug_viewer_screenshot.png");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function normCat(x) {
  const v = (x || "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(v)) return "character";
  if (["weapon", "weapons"].includes(v)) return "weapon";
  if (["accessory", "accessories"].includes(v)) return "accessory";
  if (["enemy", "enemies", "monster", "monsters"].includes(v)) return "enemy";
  if (["boss", "bosses"].includes(v)) return "boss";
  return v || "unknown";
}

function pickCategoryFromRow(row) {
  const img = (row.image ?? "").toLowerCase();
  if (img.includes("/files/images/weapons/")) return "weapon";
  if (img.includes("/files/images/accessories/")) return "accessory";
  if (img.includes("/files/images/monsters/")) return "enemy";
  if (img.includes("/files/images/units/") || img.includes("/files/images/characters/")) return "character";
  return "unknown";
}

function toNum(x) {
  const n = Number(String(x ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

async function run() {
  ensureDir(DATA_DIR);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log(`Loading Viewer: ${VIEWER_URL}`);
  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });

  // Give Blazor a chance to hydrate
  await page.waitForTimeout(4000);

  // Try to wait for *any* table OR grid-like row container.
  // If table never appears, we still save debug.
  const tableAppeared = await page
    .waitForSelector("table", { timeout: 45_000 })
    .then(() => true)
    .catch(() => false);

  // Scroll to force lazy rendering
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);

  // Save debug always (helps you inspect on phone)
  await page.content().then((html) => fs.writeFileSync(DEBUG_HTML, html, "utf8")).catch(() => {});
  await page.screenshot({ path: DEBUG_PNG, fullPage: true }).catch(() => {});

  const extracted = await page.evaluate(() => {
    const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();

    // If there is a table, parse it.
    const table = document.querySelector("table");
    if (table) {
      const headers = Array.from(table.querySelectorAll("thead th")).map((th) => norm(th.textContent));
      const rows = [];

      const trs = Array.from(table.querySelectorAll("tbody tr"));
      for (const tr of trs) {
        const tds = Array.from(tr.querySelectorAll("td"));
        const cells = tds.map((td) => norm(td.textContent));

        // image (if present in row)
        const img = tr.querySelector("img");
        const image = img?.getAttribute("src") || null;

        rows.push({ cells, image });
      }

      return { mode: "table", headers, rows };
    }

    // Fallback: attempt grid cards (if site uses cards, not table)
    const cards = Array.from(document.querySelectorAll("img"))
      .map((img) => img.getAttribute("src"))
      .filter((src) => src && src.includes("/files/images/"))
      .slice(0, 5000);

    return { mode: "images", headers: [], rows: cards.map((src) => ({ cells: [], image: src })) };
  });

  await browser.close();

  let items = [];
  let headers = extracted.headers ?? [];

  if (extracted.mode === "table") {
    // Build objects by header names
    const idx = (name) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

    const iName = idx("Name");
    const iElement = idx("Element");
    const iCost = idx("Cost");
    const iAtk = idx("ATK");
    const iHp = idx("HP");
    const iSpd = idx("SPD");
    const iWeapon = idx("Weapon");
    const iRarity = idx("Rarity");
    const iType = idx("Type");

    for (const r of extracted.rows) {
      const cells = r.cells || [];
      const name = norm(cells[iName] ?? "");
      if (!name) continue;

      // Skip the header row that sometimes gets scraped as data
      if (name.toLowerCase().includes("name rarity element cost atk hp spd")) continue;

      const element = norm(cells[iElement] ?? "") || null;
      const cost = toNum(cells[iCost]);
      const atk = toNum(cells[iAtk]);
      const hp = toNum(cells[iHp]);
      const spd = toNum(cells[iSpd]);

      const typeCell = norm(cells[iType] ?? "");
      let category = normCat(typeCell);
      if (category === "unknown") category = pickCategoryFromRow({ image: r.image });

      items.push({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        name,
        category,
        element,
        cost,
        atk,
        hp,
        spd,
        rarity: norm(cells[iRarity] ?? "") || null,
        weaponType: norm(cells[iWeapon] ?? "") || null,
        image: r.image || null,
        url: VIEWER_URL,
      });
    }
  } else {
    // image-only fallback (no stats)
    for (const r of extracted.rows) {
      const src = r.image;
      if (!src) continue;
      items.push({
        id: src.toLowerCase().split("/").pop().replace(/[^a-z0-9]+/g, "-"),
        name: src.split("/").pop(),
        category: pickCategoryFromRow({ image: src }),
        element: null,
        cost: null,
        atk: null,
        hp: null,
        spd: null,
        image: src,
        url: VIEWER_URL,
      });
    }
  }

  const payload = {
    url: VIEWER_URL,
    generatedAt: new Date().toISOString(),
    mode: extracted.mode,
    headers,
    items,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} items=${items.length} mode=${extracted.mode}`);

  // Fail if we didn’t get any rows at all
  if (!items.length) {
    throw new Error("No DOM items extracted (0). Check data/_debug_viewer_rendered.html and screenshot.");
  }
}

run().catch((e) => {
  console.error("scrape_viewer_dom_items failed:", e.message);
  process.exit(1);
});