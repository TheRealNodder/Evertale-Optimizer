// scraper/scrape_toolbox_units_full.mjs
// Fixes: "passive names becoming unit names"
// Output: ../data/units.toolbox.json

import fs from "node:fs/promises";
import path from "node:path";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_UNITS = path.join(process.cwd(), "..", "data", "units.toolbox.json");

// Any of these strongly indicates it's NOT a unit name/title
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
  if (PASSIVE_LIKE.test(line)) return false; // passives are not "junk", just not unit names
  return false;
}

function isValidUnitNameOrTitle(line) {
  if (!line) return false;
  if (UI_JUNK.has(line)) return false;
  if (line.startsWith("Page ")) return false;
  if (line.endsWith(" items")) return false;
  // Key rule: NEVER allow passives to be name/title
  if (PASSIVE_LIKE.test(line)) return false;
  // Stats aren’t names
  if (asIntMaybe(line) != null) return false;
  // Very short strings are usually noise
  if (line.length < 2) return false;
  return true;
}

function nextNonJunk(lines, startIdx) {
  let i = startIdx;
  while (i < lines.length && isJunk(lines[i])) i++;
  return i;
}

function parseUnits(lines) {
  // Start at the unit table header
  const start = lines.findIndex((l) => l === "Name");
  if (start === -1) throw new Error("Couldn't find 'Name' header (Viewer layout changed).");

  // Stop before weapons section
  const weaponIdx = lines.findIndex((l) => l === "Weapon:");
  const slice = weaponIdx !== -1 ? lines.slice(start, weaponIdx) : lines.slice(start);

  const units = [];
  const seen = new Set();

  // Move index to the first actual unit entry (after header rows)
  let i = start;
  i = slice.findIndex((l) => l === "Rizette") >= 0 ? slice.findIndex((l) => l === "Rizette") - 1 : 0; // best-effort
  if (i < 0) i = 0;

  // Sequential parse: name -> title -> stats -> leader -> 6 actives -> 4 passives
  // This prevents "passives becoming names".
  for (let p = 0; p < 10000; p++) {
    i = nextNonJunk(slice, i);
    if (i >= slice.length) break;

    const name = slice[i];
    const title = slice[i + 1];

    if (!isValidUnitNameOrTitle(name) || !isValidUnitNameOrTitle(title)) {
      i++;
      continue;
    }

    // Find 4 consecutive ints very close to name/title.
    // On the Viewer output, these appear shortly after title.
    let statsPos = -1;
    let cost = null, atk = null, hp = null, spd = null;

    const searchFrom = i + 2;
    const searchTo = Math.min(slice.length - 4, i + 18); // <-- tight window is the fix
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
      // Not actually a unit block
      i++;
      continue;
    }

    let k = statsPos + 4;
    k = nextNonJunk(slice, k);

    // Leader skill name (may be missing sometimes, but usually exists)
    let leaderSkillName = null;
    let leaderSkillText = null;

    if (k < slice.length && isValidUnitNameOrTitle(slice[k])) {
      leaderSkillName = slice[k];
      k++;
    }
    k = nextNonJunk(slice, k);

    // Leader skill text usually begins with "Allied ..."
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

    // Continue scanning from where we ended
    i = k;
  }

  return units;
}

async function run() {
  console.log(`Fetching: ${VIEWER_URL}`);
  const res = await fetch(VIEWER_URL, {
    headers: {
      "user-agent": "Evertale-Optimizer-Scraper/FixedNames",
      "accept": "text/html,*/*"
    }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const lines = htmlToLines(html);

  const units = parseUnits(lines);
  if (!units.length) throw new Error("Parsed 0 units. Viewer layout may have changed.");

  await fs.mkdir(path.dirname(OUT_UNITS), { recursive: true });
  await fs.writeFile(
    OUT_UNITS,
    JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${units.length} units -> data/units.toolbox.json`);
  console.log(`First 5: ${units.slice(0, 5).map(u => u.name).join(", ")}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
