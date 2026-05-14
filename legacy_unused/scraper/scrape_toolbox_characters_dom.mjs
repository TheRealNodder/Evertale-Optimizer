// scraper/scrape_toolbox_characters_dom.mjs
// Fallback: scrape the rendered /Viewer table (DOM) to produce character stats JSON.
// Outputs: data/characters.toolbox.json

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const OUT = path.join(process.cwd(), "data", "characters.toolbox.json");
const DEBUG_HTML = path.join(process.cwd(), "data", "_debug_viewer_dom.html");
const DEBUG_PNG = path.join(process.cwd(), "data", "_debug_viewer_dom.png");

const URL = "https://evertaletoolbox2.runasp.net/Viewer";

// normalize numbers like "1,234" -> 1234
function parseNum(s) {
  if (s == null) return null;
  const t = String(s).replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function cleanText(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

// Find a scrollable element on the page (virtualized tables often render inside one)
async function findScrollableHandle(page) {
  // Try common containers first
  const candidates = [
    "main",
    ".table-responsive",
    ".content",
    ".body",
    "body",
  ];

  for (const sel of candidates) {
    const handle = await page.$(sel);
    if (!handle) continue;
    const ok = await handle.evaluate((el) => el.scrollHeight > el.clientHeight + 50);
    if (ok) return handle;
  }

  // Fallback: scan all divs and pick the “most scrollable”
  const best = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll("div"));
    let bestSel = null;
    let bestDelta = 0;

    for (let i = 0; i < divs.length; i++) {
      const el = divs[i];
      const delta = (el.scrollHeight || 0) - (el.clientHeight || 0);
      if (delta > bestDelta + 200) {
        bestDelta = delta;
        // create a temporary attribute to re-select it
        el.setAttribute("data-scroll-best", "1");
        bestSel = "[data-scroll-best='1']";
      }
    }
    return { bestSel, bestDelta };
  });

  if (best?.bestSel) {
    return await page.$(best.bestSel);
  }

  return await page.$("body");
}

async function getHeaderMap(page) {
  // Returns array of header labels in order
  const headers = await page.$$eval("table thead tr th", (ths) =>
    ths.map((th) => th.innerText.trim())
  );

  // If no thead, some tables render headers in first row
  if (!headers || headers.length < 3) {
    const firstRow = await page.$$eval("table tr", (trs) => {
      const tr = trs[0];
      if (!tr) return [];
      const cells = Array.from(tr.querySelectorAll("th,td"));
      return cells.map((c) => c.innerText.trim());
    });
    return firstRow || [];
  }

  return headers;
}

async function extractVisibleRows(page, headerLabels) {
  // Returns array of objects for currently visible table rows
  const rows = await page.$$eval("table tbody tr", (trs) => {
    return trs.map((tr) => {
      const tds = Array.from(tr.querySelectorAll("td"));
      return tds.map((td) => {
        const img = td.querySelector("img");
        return {
          text: td.innerText || "",
          img: img ? img.getAttribute("src") : null,
        };
      });
    });
  });

  const header = (headerLabels || []).map((h) => h.toLowerCase());

  const out = [];
  for (const cells of rows) {
    if (!cells || cells.length < 3) continue;

    // If this looks like a header row mistakenly in tbody, skip it
    const joined = cells.map((c) => cleanText(c.text)).join(" ");
    if (joined.toLowerCase().includes("leader skill") && joined.toLowerCase().includes("passive")) {
      // likely header row
      continue;
    }

    const getByName = (names) => {
      for (const nm of names) {
        const idx = header.findIndex((h) => h === nm);
        if (idx >= 0 && cells[idx]) return cleanText(cells[idx].text);
      }
      return null;
    };

    const getByIndex = (i) => (cells[i] ? cleanText(cells[i].text) : null);
    const img0 = cells[0]?.img || null;

    // Column fallbacks by expected order:
    const name = getByName(["name"]) ?? getByIndex(0);
    const rarity = getByName(["rarity"]) ?? getByIndex(1);
    const element = getByName(["element"]) ?? getByIndex(2);
    const cost = getByName(["cost"]) ?? getByIndex(3);
    const atk = getByName(["atk", "attack"]) ?? getByIndex(4);
    const hp = getByName(["hp"]) ?? getByIndex(5);
    const spd = getByName(["spd", "speed"]) ?? getByIndex(6);
    const weapon = getByName(["weapon"]) ?? getByIndex(7);
    const leaderSkill = getByName(["leader skill", "leaderskill"]) ?? getByIndex(8);
    const activeSkills = getByName(["active skills", "activeskills"]) ?? getByIndex(9);
    const passiveSkills = getByName(["passive skills", "passiveskills"]) ?? getByIndex(10);

    if (!name || name.length < 2) continue;

    out.push({
      name,
      rarity: rarity || null,
      element: element || null,
      cost: parseNum(cost),
      atk: parseNum(atk),
      hp: parseNum(hp),
      spd: parseNum(spd),
      weapon: weapon || null,
      leaderSkill: leaderSkill || null,
      activeSkills: activeSkills || null,
      passiveSkills: passiveSkills || null,
      image: img0 || null,
      sourceUrl: URL,
    });
  }

  return out;
}

async function run() {
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  page.setDefaultTimeout(120000);

  console.log(`Loading Viewer: ${URL}`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });

  // Wait for table to appear
  await page.waitForSelector("table", { timeout: 120000 });

  // Save debug snapshot early (helps if the UI changes)
  await fs.promises.writeFile(DEBUG_HTML, await page.content(), "utf8");
  await page.screenshot({ path: DEBUG_PNG, fullPage: true });

  const headerLabels = await getHeaderMap(page);
  console.log(`Headers found: ${headerLabels.length ? headerLabels.join(" | ") : "(none)"}`);

  const scrollEl = await findScrollableHandle(page);

  // Virtualized list: scroll repeatedly, collecting unique names
  const seen = new Map(); // name -> object

  let stagnant = 0;
  let lastCount = 0;

  for (let i = 0; i < 300; i++) {
    const batch = await extractVisibleRows(page, headerLabels);
    for (const row of batch) {
      if (!seen.has(row.name)) seen.set(row.name, row);
    }

    const count = seen.size;
    if (count === lastCount) stagnant++;
    else stagnant = 0;

    lastCount = count;

    // Stop if we stopped discovering new rows for a while
    if (stagnant >= 10) break;

    // Scroll down
    await scrollEl.evaluate((el) => {
      el.scrollTop = el.scrollTop + Math.max(800, el.clientHeight * 0.9);
    });

    await page.waitForTimeout(250);
  }

  await browser.close();

  const characters = Array.from(seen.values());

  // If the Viewer is currently showing only 11 rows (first page), you’ll see it here.
  console.log(`Scraped characters: ${characters.length}`);

  const out = {
    generatedAt: new Date().toISOString(),
    source: URL,
    headers: headerLabels,
    characters,
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`Wrote: ${OUT}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});