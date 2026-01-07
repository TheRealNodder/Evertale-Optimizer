// scraper/scrape_toolbox_units_full.mjs
// Robust extraction: pulls every Character block from the Toolbox Viewer HTML.
// Outputs: ../data/units.toolbox.json

import fs from "node:fs/promises";
import path from "node:path";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_UNITS = path.join(process.cwd(), "..", "data", "units.toolbox.json");

const ELEMENTS = new Set(["Fire", "Earth", "Storm", "Water", "Light", "Dark"]);

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

// Viewer repeats a lot of UI labels. Filter them out when collecting skills.
const UI_JUNK = new Set([
  "Home", "Viewer", "Explorer", "Calculator", "Simulator",
  "Character", "Weapon", "Accessory", "Boss",
  "Rarity:", "Elements:", "Card View", "Column:",
  "Rarity", "Element", "Cost", "Stats", "Leader Skill",
  "Active Skills", "Passive Skills", "Name", "ATK", "HP", "SPD",
  "ALL"
]);

function isJunk(line) {
  if (!line) return true;
  if (UI_JUNK.has(line)) return true;
  if (line.startsWith("Page ")) return true;
  if (line.endsWith(" items")) return true;
  if (line === "Image") return true;
  // The web tool shows "" tokens; in plain text runs it can show "Image" only.
  if (/^【\d+†Image】$/.test(line)) return true;
  return false;
}

function parseUnits(lines) {
  // Find where the character table header begins
  const start = lines.findIndex((l) => l === "Name");
  if (start === -1) throw new Error("Couldn't find unit table header 'Name'.");

  // Cut off before weapons begin
  const weaponIdx = lines.findIndex((l) => l === "Weapon:");
  const slice = weaponIdx !== -1 ? lines.slice(start, weaponIdx) : lines.slice(start);

  const units = [];
  const seen = new Set();

  // Strategy:
  // Scan for patterns: [Name][Title] then find next 4 ints = cost/atk/hp/spd,
  // then leader skill name + description, then collect 6 actives + 4 passives (best-effort).
  for (let i = 0; i < slice.length - 10; i++) {
    const name = slice[i];
    const title = slice[i + 1];

    if (isJunk(name) || isJunk(title)) continue;
    if (asIntMaybe(name) != null || asIntMaybe(title) != null) continue;
    if (name.length < 2 || title.length < 2) continue;

    // find stats in next ~60 lines: cost, atk, hp, spd
    let statsPos = -1;
    let cost, atk, hp, spd;

    for (let j = i + 2; j < Math.min(slice.length - 4, i + 60); j++) {
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
    if (statsPos === -1) continue;

    let k = statsPos + 4;

    // Move forward to leader skill name (skip junk/images)
    while (k < slice.length && isJunk(slice[k])) k++;

    // Sometimes element icon text is stripped; sometimes leader skill name follows immediately.
    let leaderSkillName = null;
    let leaderSkillText = null;

    // If current line looks like "Light HP Up" etc, accept it.
    if (k < slice.length && !isJunk(slice[k]) && slice[k].length <= 40) {
      leaderSkillName = slice[k];
      k++;
    }

    // Next non-junk line often is leader description ("Allied X element units ...")
    while (k < slice.length && isJunk(slice[k])) k++;
    if (k < slice.length && slice[k].startsWith("Allied ")) {
      leaderSkillText = slice[k];
      k++;
    }

    // Collect skills: we’ll collect a bunch then split best-effort
    const skillBucket = [];
    while (k < slice.length) {
      const line = slice[k];

      // Stop if next unit is starting (name/title + stats pattern ahead)
      // Heuristic: if line is non-junk and the following line is non-junk and within next 30 we see 4 ints
      if (!isJunk(line) && !isJunk(slice[k + 1] ?? "")) {
        let foundStatsAhead = false;
        for (let j = k + 2; j < Math.min(slice.length - 4, k + 35); j++) {
          const c = asIntMaybe(slice[j]);
          const a = asIntMaybe(slice[j + 1]);
          const h = asIntMaybe(slice[j + 2]);
          const s = asIntMaybe(slice[j + 3]);
          if (c != null && a != null && h != null && s != null) { foundStatsAhead = true; break; }
        }
        if (foundStatsAhead) break;
      }

      if (!isJunk(line)) skillBucket.push(line);
      k++;
    }

    // Determine element (best-effort): infer from leader text if possible
    let element = null;
    if (leaderSkillText) {
      for (const el of ELEMENTS) {
        if (leaderSkillText.includes(` ${el} `) || leaderSkillText.includes(`${el} element`)) {
          element = el;
          break;
        }
      }
    }

    // Toolbox viewer tends to show 6 actives then 4 passives. We’ll split by known passive markers.
    const passiveStart = skillBucket.findIndex((x) => x.includes("Up Lv") || x.includes("Resist Lv") || x.includes("Mastery"));
    let activeSkills = [];
    let passiveSkills = [];

    if (passiveStart === -1) {
      activeSkills = skillBucket.slice(0, 6);
      passiveSkills = skillBucket.slice(6, 10);
    } else {
      activeSkills = skillBucket.slice(0, passiveStart).slice(0, 6);
      passiveSkills = skillBucket.slice(passiveStart).slice(0, 10);
    }

    const id = normalizeId(name, title);
    if (seen.has(id)) continue;
    seen.add(id);

    units.push({
      id,
      name,
      title,
      element,
      rarity: null,
      cost,
      stats: { atk, hp, spd },
      leaderSkillName,
      leaderSkillText,
      activeSkills,
      passiveSkills,
      source: { viewer: VIEWER_URL }
    });

    i = statsPos; // jump forward a bit
  }

  return units;
}

async function run() {
  console.log(`Fetching: ${VIEWER_URL}`);
  const res = await fetch(VIEWER_URL, {
    headers: {
      "user-agent": "Evertale-Optimizer-Scraper/Full",
      "accept": "text/html,*/*"
    }
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const lines = htmlToLines(html);

  const units = parseUnits(lines);
  if (!units.length) throw new Error("Parsed 0 units (layout changed or blocked).");

  await fs.mkdir(path.dirname(OUT_UNITS), { recursive: true });
  await fs.writeFile(
    OUT_UNITS,
    JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${units.length} units -> data/units.toolbox.json`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
