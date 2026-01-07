import fs from "fs/promises";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";

const ELEMENTS = new Set(["Fire", "Earth", "Storm", "Water", "Light", "Dark"]);
const WEAPON_TYPES = new Set([
  "Sword", "Axe", "Staff", "Mace", "GreatSword", "GreatAxe", "Spear", "Hammer", "Katana",
]);

function decodeHtmlEntities(str) {
  return str
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function htmlToLines(html) {
  // Preserve <br> as newlines, remove tags, decode common entities, normalize whitespace.
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n");
  const noTags = withBreaks.replace(/<[^>]*>/g, "\n");
  const decoded = decodeHtmlEntities(noTags);

  return decoded
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "Image" && l !== "filter_alt" && l !== "Filter" && l !== "Clear" && l !== "Apply");
}

function asIntMaybe(s) {
  // "1,719" -> 1719
  const t = s.replaceAll(",", "");
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

function isLikelyName(s) {
  // Names here are usually words, not numeric, not "ALL", not headers.
  if (!s) return false;
  if (s.length < 2) return false;
  if (s === "ALL") return false;
  if (/^\d+$/.test(s.replaceAll(",", ""))) return false;
  // avoid obvious headers
  const bad = new Set(["Home", "Viewer", "Explorer", "Calculator", "Simulator", "Tools", "Sign In", "en"]);
  if (bad.has(s)) return false;
  return true;
}

function takeWhile(lines, startIdx, stopPred) {
  const out = [];
  let i = startIdx;
  for (; i < lines.length; i++) {
    if (stopPred(lines[i], i)) break;
    out.push(lines[i]);
  }
  return { out, next: i };
}

function parseCharacters(lines) {
  const units = [];

  // Find the first occurrence of the column header area (Name / Rarity / Element / Cost / ATK / HP / SPD...)
  const start = lines.findIndex((l) => l === "Name");
  if (start === -1) throw new Error("Could not find 'Name' header. Viewer layout may have changed.");

  // After headers, character cards/rows start. We’ll scan until we hit the summary like “397 items”.
  let i = start;
  while (i < lines.length && lines[i] !== "Rizette") i++; // first known entry on page 1 often is Rizette
  // If not found, just move forward a bit
  if (i >= lines.length) i = start + 1;

  while (i < lines.length) {
    // Stop when we reach the “items” summary or the Weapon section label.
    if (/^\d+\s+items$/.test(lines[i])) break;
    if (lines[i] === "Weapon:" || lines[i] === "Weapon") break;

    // A unit block in this Viewer tends to look like:
    // Name
    // Title/Epithet
    // Cost
    // ATK
    // HP
    // SPD
    // (Element + leader skill short label is in one line, eg "Light HP Up" OR "Fire ATK & HP Up")
    // Leader skill description
    // Active skills (names only in this view)
    // Passive skills (names only in this view)
    //
    // We’ll detect by: name + title + 4 integers (cost/atk/hp/spd)
    const name = lines[i];
    const title = lines[i + 1];

    if (!isLikelyName(name) || !title || !isLikelyName(title)) {
      i++;
      continue;
    }

    const cost = asIntMaybe(lines[i + 2]);
    const atk = asIntMaybe(lines[i + 3]);
    const hp = asIntMaybe(lines[i + 4]);
    const spd = asIntMaybe(lines[i + 5]);

    if (cost == null || atk == null || hp == null || spd == null) {
      i++;
      continue;
    }

    let j = i + 6;

    // Next useful line often contains element + leader skill short name.
    // Example: "Light HP Up" / "Storm ATK & HP Up"
    let element = null;
    let leaderSkillName = null;

    if (j < lines.length) {
      const parts = lines[j].split(/\s+/);
      if (parts.length >= 2 && ELEMENTS.has(parts[0])) {
        element = parts[0];
        leaderSkillName = lines[j].slice(element.length).trim();
        j++;
      }
    }

    // Leader skill description (one line in this view)
    let leaderSkillDesc = null;
    if (j < lines.length && lines[j].startsWith("Allied ")) {
      leaderSkillDesc = lines[j];
      j++;
    }

    // Active skills: consume until we hit passives that usually include "Up Lv" or "Resist" or "Mastery" etc.
    const activeStop = (l) =>
      l.includes("Up Lv") ||
      l.includes("Resist") ||
      l.includes("Mastery") ||
      l === name || // next entry sometimes
      /^\d+\s+items$/.test(l) ||
      l === "Weapon:";

    const { out: actives, next: afterActives } = takeWhile(lines, j, (l) => activeStop(l));
    j = afterActives;

    // Passive skills: consume until next unit begins (heuristic: next looks like a name + title + integers)
    const { out: passives, next: afterPassives } = takeWhile(lines, j, (l, idx) => {
      if (/^\d+\s+items$/.test(l) || l === "Weapon:" || l === "Weapon") return true;

      // Lookahead for next unit pattern
      const n = l;
      const t = lines[idx + 1];
      const c = asIntMaybe(lines[idx + 2] ?? "");
      const a = asIntMaybe(lines[idx + 3] ?? "");
      const h2 = asIntMaybe(lines[idx + 4] ?? "");
      const s2 = asIntMaybe(lines[idx + 5] ?? "");
      if (isLikelyName(n) && t && isLikelyName(t) && c != null && a != null && h2 != null && s2 != null) return true;

      return false;
    });

    units.push({
      name,
      title,
      cost,
      stats: { atk, hp, spd },
      element,
      weaponPreferredOrEquipped: null, // this view shows weapon category icons; if you want exact weapon IDs, we can link later
      leaderSkill: leaderSkillName
        ? { name: leaderSkillName, description: leaderSkillDesc }
        : null,
      skills: {
        active: actives,
        passive: passives,
      },
      source: VIEWER_URL,
    });

    i = afterPassives;
  }

  return units;
}

function parseWeapons(lines) {
  // Weapons appear after the "Weapon:" label.
  let i = lines.findIndex((l) => l === "Weapon:");
  if (i === -1) i = lines.findIndex((l) => l === "Weapon");
  if (i === -1) return [];

  // Move to first weapon id (often ends with 03 etc)
  i++;

  const weapons = [];
  while (i < lines.length) {
    const id = lines[i];

    // Typical weapon row in this view:
    // WeaponId
    // WeaponType
    // RarityNumber
    // ATKNumber
    // HPNumber (or another stat; toolbox lists 2 numbers here)
    //
    // Example shown on the page includes things like:
    // BlueDragonSword03 / Sword / 6 / 656 / 3720  [oai_citation:3‡evertaletoolbox2.runasp.net](https://evertaletoolbox2.runasp.net/Viewer)
    if (!id || id.length < 4) {
      i++;
      continue;
    }

    const type = lines[i + 1];
    const rarity = asIntMaybe(lines[i + 2]);
    const stat1 = asIntMaybe(lines[i + 3]);
    const stat2 = asIntMaybe(lines[i + 4]);

    if (!WEAPON_TYPES.has(type) || rarity == null || stat1 == null || stat2 == null) {
      i++;
      continue;
    }

    weapons.push({
      id,
      type,
      rarity,
      stats: { atk: stat1, hp: stat2 }, // toolbox shows two numbers; label them how you prefer
      source: VIEWER_URL,
    });

    i += 5;
  }

  return weapons;
}

async function run() {
  const res = await fetch(VIEWER_URL, {
    headers: {
      "user-agent": "Evertale-Optimizer/1.0 (+https://github.com/TheRealNodder/Evertale-Optimizer)",
      "accept": "text/html,*/*",
    },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const html = await res.text();
  const lines = htmlToLines(html);

  const units = parseCharacters(lines);
  const weapons = parseWeapons(lines);

  if (!units.length) throw new Error("Parsed 0 units. Viewer layout likely changed.");
  if (!weapons.length) console.warn("Parsed 0 weapons (units still extracted).");

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/units.toolbox.json", JSON.stringify(units, null, 2), "utf8");
  await fs.writeFile("data/weapons.toolbox.json", JSON.stringify(weapons, null, 2), "utf8");

  console.log(`OK: units=${units.length}, weapons=${weapons.length}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});