// scraper/scrape_leader_skills_playwright.mjs
// Scrapes Leader Skill name + tooltip/description from Toolbox Viewer using Playwright.
// Input:  data/catalog.items.json  (must contain character items with name + id)
// Output: data/leaderSkills.toolbox.json  ({ generatedAt, count, skills: { [id]: {name, description} } })

import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const ROOT = process.cwd();
const IN_ITEMS = path.join(ROOT, "data", "catalog.items.json");
const OUT = path.join(ROOT, "data", "leaderSkills.toolbox.json");

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

// Adjust if your file uses a different structure
function loadItems() {
  const raw = JSON.parse(fs.readFileSync(IN_ITEMS, "utf8"));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanText(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

async function run() {
  if (!fs.existsSync(IN_ITEMS)) {
    throw new Error(`Missing ${IN_ITEMS}. Put your refined items file there first.`);
  }

  const items = loadItems().filter((x) => (x.category || "").toLowerCase() === "character");
  if (items.length < 50) {
    throw new Error(`Too few characters in ${IN_ITEMS}: ${items.length}`);
  }

  console.log(`[leaderSkills] characters to process: ${items.length}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const skills = {};
  let ok = 0;
  let miss = 0;

  // Try to reduce resource load
  await page.route("**/*", (route) => {
    const url = route.request().url();
    const type = route.request().resourceType();
    if (type === "image" || url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".webp")) {
      return route.abort();
    }
    return route.continue();
  });

  await page.goto(VIEWER_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Heuristics: find a search box (Viewer has one). If not found, we still attempt table reading.
  const searchSelCandidates = [
    'input[placeholder*="Search" i]',
    'input[aria-label*="Search" i]',
    'input[type="search"]',
    "input.rz-textbox",
    "input"
  ];

  async function getSearchBox() {
    for (const sel of searchSelCandidates) {
      const el = await page.$(sel);
      if (!el) continue;
      const box = page.locator(sel).first();
      const isVisible = await box.isVisible().catch(() => false);
      if (isVisible) return box;
    }
    return null;
  }

  // Find the table
  const table = page.locator("table").first();
  await table.waitFor({ state: "visible", timeout: 120000 });

  // Determine column indexes by header text
  const headerCells = table.locator("thead tr th");
  const headerCount = await headerCells.count();

  let colName = -1;
  let colLeader = -1;

  for (let i = 0; i < headerCount; i++) {
    const text = cleanText(await headerCells.nth(i).innerText().catch(() => ""));
    const t = text.toLowerCase();
    if (t === "name" || t.includes("name")) colName = i;
    if (t.includes("leader")) colLeader = i;
  }

  if (colName === -1) {
    console.warn("[leaderSkills] Could not detect Name column; continuing with fallback matching by row text.");
  }
  if (colLeader === -1) {
    console.warn("[leaderSkills] Could not detect Leader Skill column. It may be hidden in column toggles.");
  }

  const searchBox = await getSearchBox();
  if (!searchBox) console.warn("[leaderSkills] Search box not found; this will be slower/less reliable.");

  // Tooltip locator candidates
  const tooltipCandidates = [
    ".rz-tooltip",                 // Radzen tooltip
    ".rz-tooltip-content",
    ".tooltip-inner",
    '[role="tooltip"]'
  ];

  async function readTooltipText() {
    for (const sel of tooltipCandidates) {
      const loc = page.locator(sel).first();
      const visible = await loc.isVisible().catch(() => false);
      if (visible) {
        const tx = cleanText(await loc.innerText().catch(() => ""));
        if (tx) return tx;
      }
    }
    return "";
  }

  // Main loop
  for (let idx = 0; idx < items.length; idx++) {
    const ch = items[idx];
    const name = ch.name;
    const id = ch.id;

    // Search/filter
    if (searchBox) {
      await searchBox.fill("");
      await searchBox.type(name, { delay: 10 });
      await page.waitForTimeout(300);
    }

    // Get first matching row
    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();

    if (rowCount === 0) {
      miss++;
      continue;
    }

    let row = rows.nth(0);

    // If we have a Name column, try to find an exact-ish match among first few rows
    if (colName !== -1) {
      const scan = Math.min(rowCount, 10);
      let bestRow = null;
      for (let r = 0; r < scan; r++) {
        const cell = rows.nth(r).locator("td").nth(colName);
        const cellText = cleanText(await cell.innerText().catch(() => ""));
        if (!cellText) continue;
        // exact or starts-with match
        if (cellText.toLowerCase() === name.toLowerCase() || cellText.toLowerCase().includes(name.toLowerCase())) {
          bestRow = rows.nth(r);
          break;
        }
      }
      if (bestRow) row = bestRow;
    }

    // Read leader skill cell
    let leaderName = "";
    let leaderDesc = "";

    if (colLeader !== -1) {
      const leaderCell = row.locator("td").nth(colLeader);

      leaderName = cleanText(await leaderCell.innerText().catch(() => ""));

      // If tooltip provides description, hover cell and read tooltip
      await leaderCell.hover({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(100);
      leaderDesc = cleanText(await readTooltipText());
    } else {
      // Fallback: try to find a cell that contains "Up" etc. (very weak fallback)
      const tds = row.locator("td");
      const tdCount = await tds.count();
      for (let t = 0; t < tdCount; t++) {
        const tx = cleanText(await tds.nth(t).innerText().catch(() => ""));
        if (!tx) continue;
        if (tx.toLowerCase().includes("up") && tx.length < 40) {
          leaderName = tx;
          await tds.nth(t).hover().catch(() => {});
          await page.waitForTimeout(100);
          leaderDesc = cleanText(await readTooltipText());
          break;
        }
      }
    }

    // Save if we got something useful
    if (leaderName) {
      skills[id] = { name: leaderName, description: leaderDesc || null };
      ok++;
    } else {
      miss++;
    }

    // Be gentle
    if (idx % 25 === 0) {
      console.log(`[leaderSkills] ${idx}/${items.length} ok=${ok} miss=${miss}`);
      await sleep(150);
    }
  }

  await browser.close();

  const out = {
    generatedAt: new Date().toISOString(),
    source: VIEWER_URL,
    count: Object.keys(skills).length,
    skills
  };

  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`[leaderSkills] wrote ${OUT} count=${out.count} (ok=${ok}, miss=${miss})`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});