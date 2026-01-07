// scraper/scrape_toolbox_units_full.mjs
// Multi-page Toolbox Viewer scraper (Characters)
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
  if (line.startsWith("Page ")) return true;
  if (line.endsWith(" items")) return true;
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

function getTotalPagesFromHtml(html) {
  // Normalize HTML so "Page&nbsp;1&nbsp;of&nbsp;40" matches too
  const normalized = decodeHtmlEntities(html).replace(/\s+/g, " ").trim();
  const m = normalized.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
  if (!m) return null;
  return { page: Number(m[1]), total: Number(m[2]) };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Evertale-Optimizer-Scraper/MultiPage",
      "accept": "text/html,*/*"
    }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText} (${url})`);
  return await res.text();
}

/**
 * Auto-discover a GET pagination parameter by trying common patterns.
 * If this throws, the site is likely using a JS/XHR POST for paging.
 */
async function discoverPager(totalPages) {
  if (totalPages < 2) return (p) => VIEWER_URL;

  const candidates = [
    (p) => `${VIEWER_URL}?page=${p}`,
    (p) => `${VIEWER_URL}?Page=${p}`,
    (p) => `${VIEWER_URL}?p=${p}`,
    (p) => `${VIEWER_URL}?pg=${p}`,
    (p) => `${VIEWER_URL}?pageIndex=${p}`,
    (p) => `${VIEWER_URL}?PageIndex=${p}`,
    (p) => `${VIEWER_URL}?currentPage=${p}`,
    (p) => `${VIEWER_URL}?CurrentPage=${p}`
  ];

  for (const build of candidates) {
    try {
      const html2 = await fetchHtml(build(2));
      // Normalize before matching
      const normalized = decodeHtmlEntities(html2).replace(/\s+/g, " ").trim();
      if (new RegExp(`Page\\s+2\\s+of\\s+\\d+`, "i").test(normalized)) {
        return build;
      }
    } catch {
      // try next
    }
  }

  throw new Error(
    "Could not auto-discover GET pagination URL. " +
    "Paging is likely handled by a JS request (XHR/POST). " +
    "If this happens, we’ll switch to scraping the Explorer API instead."
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

  const pageInfo = getTotalPagesFromHtml(html1);
  if (!pageInfo) throw new Error("Could not read 'Page X of Y' from Viewer HTML.");
  console.log(`Viewer pages: ${pageInfo.total}`);

  const buildUrl = await discoverPager(pageInfo.total);
  console.log("Pagination: OK");

  const allUnits = [];

  const units1 = parseUnitsFromHtml(html1);
  console.log(`Parsed page 1: ${units1.length}`);
  allUnits.push(...units1);

  for (let p = 2; p <= pageInfo.total; p++) {
    const url = buildUrl(p);
    const html = await fetchHtml(url);
    const units = parseUnitsFromHtml(html);
    console.log(`Parsed page ${p}: ${units.length}`);
    allUnits.push(...units);
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