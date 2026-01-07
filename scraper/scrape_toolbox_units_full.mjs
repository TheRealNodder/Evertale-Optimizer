// scraper/scrape_toolbox_units_full.mjs
// Multi-page Toolbox Viewer scraper (no "Page X of Y" dependency)
// Output: ../data/units.toolbox.json  => { updatedAt, units: [...] }

import fs from "node:fs/promises";
import path from "node:path";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_UNITS = path.join(process.cwd(), "..", "data", "units.toolbox.json");

// Strong indicator that a line is NOT a unit name/title
const PASSIVE_LIKE = /(Up Lv\d+|Resist Lv\d+|Mastery\b)/i;

const UI_JUNK = new Set([
  "Home", "Viewer", "Explorer", "Calculator", "Simulator", "Story Scripts", "Tools",
  "Character", "Weapon", "Accessory", "Boss",
  "Rarity:", "Elements:", "Card View", "Column:",
  "Rarity", "Element", "Cost", "Stats", "Leader Skill",
  "Active Skills", "Passive Skills", "Name", "ATK", "HP", "SPD",
  "ALL", "Image"
]);

function decodeHtmlEntities(str) {
  return String(str ?? "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function htmlToLines(html) {
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]*>/g, "\n");
  const decoded = decodeHtmlEntities(noTags);
  return decoded
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function asIntMaybe(s) {
  const t = String(s ?? "").replaceAll(",", "");
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

function normalizeId(name, title) {
  return `${name}__${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function isJunk(line) {
  if (!line) return true;
  if (UI_JUNK.has(line)) return true;
  if (line.startsWith("Page ")) return true;       // harmless if present
  if (line.endsWith(" items")) return true;        // harmless if present
  if (/^【\d+†Image】$/.test(line)) return true;
  return false;
}

function isValidUnitNameOrTitle(line) {
  if (!line) return false;
  if (UI_JUNK.has(line)) return false;
  if (line.startsWith("Page ")) return false;
  if (line.endsWith(" items")) return false;
  if (/^【\d+†Image】$/.test(line)) return false;
  if (PASSIVE_LIKE.test(line)) return false; // critical fix
  if (asIntMaybe(line) != null) return false;
  return line.length >= 2;
}

function nextNonJunk(lines, startIdx) {
  let i = startIdx;
  while (i < lines.length && isJunk(lines[i])) i++;
  return i;
}

/**
 * Parse only the Character section (stops before "Weapon:")
 * Returns unit objects for ONE page.
 */
function parseUnitsFromHtml(html) {
  const lines = htmlToLines(html);

  const start = lines.findIndex((l) => l === "Name");
  if (start === -1) throw new Error("Couldn't find 'Name' header (Viewer layout changed).");

  const weaponIdx = lines.findIndex((l) => l === "Weapon:");
  const slice = weaponIdx !== -1 ? lines.slice(start, weaponIdx) : lines.slice(start);

  const units = [];
  const seen = new Set();

  let i = 0;
  for (let guard = 0; guard < 20000; guard++) {
    i = nextNonJunk(slice, i);
    if (i >= slice.length) break;

    const name = slice[i];
    const title = slice[i + 1];

    if (!isValidUnitNameOrTitle(name) || !isValidUnitNameOrTitle(title)) {
      i++;
      continue;
    }

    // Find cost/atk/hp/spd very close after title
    let statsPos = -1;
    let cost = null, atk = null, hp = null, spd = null;

    const searchFrom = i + 2;
    const searchTo = Math.min(slice.length - 4, i + 18); // tight window prevents drift
    for (let j = searchFrom; j <= searchTo; j++) {
      const c = asIntMaybe(slice[j]);
      const a = asIntMaybe(slice[j + 1]);
      const h = asIntMaybe(slice[j + 2]);
      const s = asIntMaybe(slice[j + 3]);
      if (c != null && a != null && h != null && s != null) {
        cost = c; atk = a; hp = h; spd = s;
        statsPos = j;
        break;
      }
    }
    if (statsPos === -1) {
      i++;
      continue;
    }

    let k = nextNonJunk(slice, statsPos + 4);

    // leader skill name + text
    let leaderSkillName = null;
    let leaderSkillText = null;

    if (k < slice.length && isValidUnitNameOrTitle(slice[k])) {
      leaderSkillName = slice[k];
      k++;
    }
    k = nextNonJunk(slice, k);

    if (k < slice.length && slice[k].startsWith("Allied ")) {
      leaderSkillText = slice[k];
      k++;
    }
    k = nextNonJunk(slice, k);

    // 6 actives
    const activeSkills = [];
    while (k < slice.length && activeSkills.length < 6) {
      if (!isJunk(slice[k])) activeSkills.push(slice[k]);
      k++;
    }

    // 4 passives
    const passiveSkills = [];
    while (k < slice.length && passiveSkills.length < 4) {
      if (!isJunk(slice[k])) passiveSkills.push(slice[k]);
      k++;
    }

    const id = normalizeId(name, title);
    if (!seen.has(id)) {
      seen.add(id);
      units.push({
        id,
        name,
        title,
        element: null,
        rarity: null,
        cost,
        stats: { atk, hp, spd },
        leaderSkillName,
        leaderSkillText,
        activeSkills,
        passiveSkills,
        source: { viewer: VIEWER_URL }
      });
    }

    i = k;
  }

  return units;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Evertale-Optimizer-Scraper/MultiPage-NoPageText",
      "accept": "text/html,*/*"
    }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} (${url})`);
  return await res.text();
}

/**
 * Discover which GET param changes the Viewer page by:
 * - Fetching candidate page 2
 * - Parsing units
 * - Ensuring it's not identical to page 1
 */
async function discoverPager(unitsPage1) {
  const candidates = [
    (p) => `${VIEWER_URL}?page=${p}`,
    (p) => `${VIEWER_URL}?Page=${p}`,
    (p) => `${VIEWER_URL}?p=${p}`,
    (p) => `${VIEWER_URL}?pg=${p}`,
    (p) => `${VIEWER_URL}?pageIndex=${p}`,
    (p) => `${VIEWER_URL}?PageIndex=${p}`,
    (p) => `${VIEWER_URL}?currentPage=${p}`,
    (p) => `${VIEWER_URL}?CurrentPage=${p}`,
  ];

  const page1Sig = unitsPage1.slice(0, 5).map(u => u.id).join("|");

  for (const build of candidates) {
    try {
      const html2 = await fetchHtml(build(2));
      const units2 = parseUnitsFromHtml(html2);
      if (!units2.length) continue;

      const page2Sig = units2.slice(0, 5).map(u => u.id).join("|");
      if (page2Sig && page2Sig !== page1Sig) {
        return build;
      }
    } catch {
      // ignore and try next
    }
  }

  throw new Error(
    "Could not discover a GET paging parameter. " +
    "This likely means paging uses JS/XHR (POST). " +
    "If that happens, we’ll switch to an API/XHR-based scraper."
  );
}

function mergeDedupe(units) {
  const map = new Map();
  for (const u of units) {
    if (!u?.id) continue;
    if (!map.has(u.id)) map.set(u.id, u);
  }
  return [...map.values()];
}

async function run() {
  console.log(`Fetching page 1: ${VIEWER_URL}`);
  const html1 = await fetchHtml(VIEWER_URL);
  const units1 = parseUnitsFromHtml(html1);

  if (!units1.length) throw new Error("Parsed 0 units on page 1.");
  console.log(`Parsed page 1: ${units1.length}`);
  console.log(`Page 1 first 5: ${units1.slice(0, 5).map(u => u.name).join(", ")}`);

  const buildUrl = await discoverPager(units1);
  console.log("Pagination: OK (GET param discovered)");

  const allUnits = [];
  allUnits.push(...units1);

  // Loop until we stop seeing new units
  let page = 2;
  let stagnantPages = 0;
  let lastCount = 0;

  while (page <= 200) { // safety cap
    const url = buildUrl(page);
    const html = await fetchHtml(url);
    const units = parseUnitsFromHtml(html);

    if (!units.length) {
      console.log(`Page ${page}: 0 units -> stopping`);
      break;
    }

    allUnits.push(...units);
    const mergedNow = mergeDedupe(allUnits);

    console.log(`Parsed page ${page}: ${units.length} (unique so far: ${mergedNow.length})`);

    // stop if no growth for 3 pages (means we looped past the end or paging failed)
    if (mergedNow.length === lastCount) stagnantPages++;
    else stagnantPages = 0;

    lastCount = mergedNow.length;

    if (stagnantPages >= 3) {
      console.log("No new units for 3 pages -> stopping");
      break;
    }

    page++;
    await new Promise((r) => setTimeout(r, 150));
  }

  const merged = mergeDedupe(allUnits);
  console.log(`Merged unique units: ${merged.length}`);

  await fs.mkdir(path.dirname(OUT_UNITS), { recursive: true });
  await fs.writeFile(
    OUT_UNITS,
    JSON.stringify({ updatedAt: new Date().toISOString(), units: merged }, null, 2),
    "utf8"
  );

  console.log(`Wrote -> data/units.toolbox.json`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});