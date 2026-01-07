// scraper/scrape_toolbox_viewer.mjs
// Output files (repo root):
//   data/units.toolbox.json    -> { updatedAt, units: [...] }
//   data/weapons.toolbox.json  -> { updatedAt, weapons: [...] }

import fs from "node:fs/promises";
import path from "node:path";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

const OUT_UNITS = path.join(process.cwd(), "..", "data", "units.toolbox.json");
const OUT_WEAPONS = path.join(process.cwd(), "..", "data", "weapons.toolbox.json");

const ELEMENTS = new Set(["Fire", "Earth", "Storm", "Water", "Light", "Dark"]);
const WEAPON_TYPES = new Set([
  "Sword", "Axe", "Staff", "Mace", "GreatSword", "GreatAxe", "Spear", "Hammer", "Katana",
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

function isLinkImageToken(s) {
  return /^【\d+†Image】$/.test(s) || s === "Image";
}

function isHeaderWord(s) {
  return (
    s === "Name" ||
    s === "Rarity" ||
    s === "Element" ||
    s === "Cost" ||
    s === "ATK" ||
    s === "HP" ||
    s === "SPD" ||
    s === "Weapon" ||
    s === "Leader Skill" ||
    s === "Active Skills" ||
    s === "Passive Skills" ||
    s === "Card View" ||
    s === "Column:" ||
    s === "Character" ||
    s === "Weapon:" ||
    s === "Elements:" ||
    s === "Rarity:" ||
    s === "ALL"
  );
}

function isLikelyName(s) {
  if (!s) return false;
  if (isHeaderWord(s)) return false;
  if (isLinkImageToken(s)) return false;
  if (s === "ALL") return false;
  if (/^\d+\s+items$/.test(s)) return false;
  if (s.startsWith("Page ")) return false;
  if (/^\d+$/.test(s.replaceAll(",", ""))) return false;
  return s.length >= 2;
}

function takeWhile(lines, startIdx, stopPred) {
  const out = [];
  let i = startIdx;
  for (; i < lines.length; i++) {
    if (stopPred(lines[i], i)) break;
    const v = lines[i];
    if (!isHeaderWord(v) && !isLinkImageToken(v)) out.push(v);
  }
  return { out, next: i };
}

function parseCharacters(lines) {
  const units = [];

  // stop before weapon section
  const weaponStart = lines.findIndex((l) => l === "Weapon:");
  const trimmed = weaponStart !== -1 ? lines.slice(0, weaponStart) : lines;

  // find start header
  const start = trimmed.findIndex((l) => l === "Name");
  if (start === -1) throw new Error("Could not find 'Name' header (Viewer layout changed).");

  const slice = trimmed.slice(start);

  for (let i = 0; i < slice.length - 12; i++) {
    const name = slice[i];
    const title = slice[i + 1];

    if (!isLikelyName(name) || !isLikelyName(title)) continue;

    // Find 4 consecutive ints within next ~45 lines: cost, atk, hp, spd
    let j = i + 2;
    let statsPos = -1;
    let cost = null, atk = null, hp = null, spd = null;

    const limit = Math.min(slice.length, i + 45);
    while (j < limit) {
      const c = asIntMaybe(slice[j]);
      const a = asIntMaybe(slice[j + 1]);
      const h = asIntMaybe(slice[j + 2]);
      const s = asIntMaybe(slice[j + 3]);
      if (c != null && a != null && h != null && s != null) {
        cost = c; atk = a; hp = h; spd = s;
        statsPos = j;
        break;
      }
      j++;
    }
    if (statsPos === -1) continue;

    let k = statsPos + 4;

    // skip noise
    while (
      k < slice.length &&
      (slice[k] === "ALL" || isLinkImageToken(slice[k]) || isHeaderWord(slice[k]))
    ) k++;

    // element + leader short label (best effort)
    let element = null;
    let leaderSkillName = null;
    let leaderSkillText = null;

    if (k < slice.length) {
      const parts = slice[k].split(/\s+/);
      if (parts.length >= 2 && ELEMENTS.has(parts[0])) {
        element = parts[0];
        leaderSkillName = slice[k].slice(element.length).trim();
        k++;
      }
    }

    // leader skill desc line (best effort)
    if (
      k < slice.length &&
      (slice[k].startsWith("Allied ") || slice[k].includes("increased by"))
    ) {
      leaderSkillText = slice[k];
      k++;
    }

    // active skills until passives start (heuristic)
    const { out: activeSkills, next: afterActives } = takeWhile(slice, k, (l) =>
      l.includes("Up Lv") ||
      l.includes("Resist") ||
      l.includes("Mastery") ||
      l === "Weapon:" ||
      /^\d+\s+items$/.test(l) ||
      l.startsWith("Page ")
    );
    k = afterActives;

    // passive skills until next unit block
    const { out: passiveSkills, next: afterPassives } = takeWhile(slice, k, (l, idx) => {
      if (l === "Weapon:" || /^\d+\s+items$/.test(l) || l.startsWith("Page ")) return true;

      const n = l;
      const t = slice[idx + 1];
      const c = asIntMaybe(slice[idx + 2] ?? "");
      const a = asIntMaybe(slice[idx + 3] ?? "");
      const h = asIntMaybe(slice[idx + 4] ?? "");
      const s = asIntMaybe(slice[idx + 5] ?? "");

      return isLikelyName(n) && isLikelyName(t) && c != null && a != null && h != null && s != null;
    });

    const id = `${name}__${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    units.push({
      id,
      name,
      title,
      element,     // may be null depending on parsing
      rarity: null, // Viewer text often doesn't provide rarity cleanly
      cost,
      stats: { atk, hp, spd },
      leaderSkillName,
      leaderSkillText,
      activeSkills,
      passiveSkills,
      source: { viewer: VIEWER_URL },
    });

    i = Math.max(i, statsPos);
  }

  // de-dupe
  const seen = new Set();
  const unique = [];
  for (const u of units) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    unique.push(u);
  }
  return unique;
}

function parseWeapons(lines) {
  let i = lines.findIndex((l) => l === "Weapon:");
  if (i === -1) i = lines.findIndex((l) => l === "Weapon");
  if (i === -1) return [];
  i++;

  const weapons = [];
  while (i < lines.length) {
    const wid = lines[i];
    const type = lines[i + 1];
    const rarity = asIntMaybe(lines[i + 2]);
    const stat1 = asIntMaybe(lines[i + 3]);
    const stat2 = asIntMaybe(lines[i + 4]);

    if (!wid || !WEAPON_TYPES.has(type) || rarity == null || stat1 == null || stat2 == null) {
      i++;
      continue;
    }

    weapons.push({
      id: wid,
      type,
      rarity,
      stats: { atk: stat1, hp: stat2 },
      source: { viewer: VIEWER_URL },
    });

    i += 5;
  }
  return weapons;
}

async function run() {
  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  const res = await fetch(VIEWER_URL, {
    headers: {
      "user-agent": "Evertale-Optimizer-Scraper/Viewer",
      "accept": "text/html,*/*",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const lines = htmlToLines(html);

  const units = parseCharacters(lines);
  const weapons = parseWeapons(lines);

  if (!units.length) throw new Error("Parsed 0 units (Viewer layout changed or blocked).");

  await fs.mkdir(path.dirname(OUT_UNITS), { recursive: true });

  await fs.writeFile(
    OUT_UNITS,
    JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2),
    "utf8"
  );

  await fs.writeFile(
    OUT_WEAPONS,
    JSON.stringify({ updatedAt: new Date().toISOString(), weapons }, null, 2),
    "utf8"
  );

  console.log(`OK: units=${units.length}, weapons=${weapons.length}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});