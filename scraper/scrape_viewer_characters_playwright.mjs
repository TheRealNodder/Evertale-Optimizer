// scraper/scrape_viewer_characters_playwright.mjs
// Scrape the rendered Viewer HTML table (DOM) using Playwright.
// This avoids SignalR decoding and fixes "name mixed with stats" by reading each TD separately.
//
// Outputs (repo root /data):
//   data/toolbox.items.json
// Debug:
//   data/_debug_viewer_rendered.html
//   data/_debug_viewer_screenshot.png
//
// NOTE: This scraper writes toolbox.items.json ALWAYS (if table exists).
// It fails only if it cannot find any real rows.

import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const DOMAIN_HINT = "evertaletoolbox2.runasp.net";

const OUT_ITEMS = "data/toolbox.items.json";

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function isHeaderRow(name) {
  const n = (name || "").toLowerCase();
  return (
    n === "name" ||
    n.includes("rarity element cost atk hp spd") ||
    n.includes("leader skill") ||
    n.includes("active skills")
  );
}

function toAbsUrl(src) {
  if (!src) return null;
  const s = String(src);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return `https://${DOMAIN_HINT}${s}`;
  return s;
}

function categorizeFromWeaponCell(weaponText, imageUrl) {
  const img = (imageUrl || "").toLowerCase();
  if (img.includes("/weapons/")) return "weapons";
  if (img.includes("/accessories/")) return "accessories";
  if (img.includes("/monsters/")) return "enemies";
  if (img.includes("boss")) return "bosses";

  // Viewer table you showed is units; default characters
  // If later you run a weapons view, weaponText might be the name itself
  const wt = (weaponText || "").toLowerCase();
  if (wt.includes("sword") || wt.includes("axe") || wt.includes("hammer") || wt.includes("staff") || wt.includes("spear") || wt.includes("bow")) {
    return "characters";
  }

  return "characters";
}

async function ensureDataDir() {
  await fs.mkdir(path.resolve(process.cwd(), "data"), { recursive: true });
}

async function saveDebug(page) {
  const outDir = path.resolve(process.cwd(), "data");
  const htmlPath = path.join(outDir, "_debug_viewer_rendered.html");
  const pngPath = path.join(outDir, "_debug_viewer_screenshot.png");

  try {
    const html = await page.content();
    await fs.writeFile(htmlPath, html, "utf8");
    console.log(`Saved debug HTML: ${htmlPath}`);
  } catch {}

  try {
    await page.screenshot({ path: pngPath, fullPage: true });
    console.log(`Saved debug screenshot: ${pngPath}`);
  } catch {}
}

async function run() {
  await ensureDataDir();

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

  // Wait for any table to appear
  await page.waitForSelector("table", { timeout: 120000 });

  // Some Blazor tables take time to populate
  await page.waitForTimeout(4000);

  // Keep scraping as we scroll, since the table may be virtualized
  // We collect rows by a stable key (Name + Rarity + Element)
  const seen = new Set();
  const items = [];

  let stableRounds = 0;
  let lastCount = 0;

  for (let round = 0; round < 60; round++) {
    // Extract current rows
    const rows = await page.evaluate(() => {
      // Find the first visible table with rows
      const tables = Array.from(document.querySelectorAll("table"));
      let table = null;

      for (const t of tables) {
        const trs = t.querySelectorAll("tbody tr");
        if (trs && trs.length > 0) {
          table = t;
          break;
        }
      }
      if (!table) return [];

      const trs = Array.from(table.querySelectorAll("tbody tr"));

      return trs.map((tr) => {
        const tds = Array.from(tr.querySelectorAll("td"));
        const cols = tds.map((td) => (td.textContent || "").replace(/\s+/g, " ").trim());

        // Try to find an image in the row (often in the first cell)
        const imgEl = tr.querySelector("img");
        const imgSrc = imgEl ? imgEl.getAttribute("src") : null;

        return { cols, imgSrc };
      });
    });

    for (const r of rows) {
      const cols = r.cols || [];
      const name = cols[0] || "";
      if (!name || isHeaderRow(name)) continue;

      // Map columns based on the header you posted:
      // 0 Name
      // 1 Rarity
      // 2 Element
      // 3 Cost
      // 4 ATK
      // 5 HP
      // 6 SPD
      // 7 Weapon
      // 8 Leader Skill
      // 9 Active Skills
      // 10 Passive Skills
      const rarity = cols[1] || null;
      const element = cols[2] || null;
      const cost = cols[3] || null;
      const atk = cols[4] || null;
      const hp = cols[5] || null;
      const spd = cols[6] || null;
      const weapon = cols[7] || null;
      const leaderSkill = cols[8] || null;
      const activeSkills = cols[9] || null;
      const passiveSkills = cols[10] || null;

      const image = toAbsUrl(r.imgSrc);

      const key = `${name}||${rarity}||${element}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const category = categorizeFromWeaponCell(weapon, image);

      items.push({
        id: norm(name),
        name: norm(name),
        category,               // characters for this Viewer
        rarity: norm(rarity),
        element: norm(element),
        cost: norm(cost),
        atk: norm(atk),
        hp: norm(hp),
        spd: norm(spd),
        weapon: norm(weapon),
        leaderSkill: norm(leaderSkill),
        activeSkills: norm(activeSkills),
        passiveSkills: norm(passiveSkills),
        image,
        url: VIEWER_URL,
      });
    }

    // Check if we’re still discovering new rows
    if (items.length === lastCount) stableRounds++;
    else stableRounds = 0;

    lastCount = items.length;

    // If count hasn't changed for a few rounds, assume we've loaded everything available
    if (stableRounds >= 6) break;

    // Scroll down to trigger virtualized loading
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(700);
  }

  await saveDebug(page);
  await browser.close();

  if (items.length < 5) {
    throw new Error(
      `Viewer table scrape produced too few rows (${items.length}). The page might not be rendering table rows for the runner.`
    );
  }

  // Write toolbox.items.json
  const outPath = path.resolve(process.cwd(), OUT_ITEMS);
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        source: VIEWER_URL,
        scrapedAt: new Date().toISOString(),
        count: items.length,
        items,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Wrote ${OUT_ITEMS} items=${items.length}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1); // this one SHOULD fail if it can't produce items
});