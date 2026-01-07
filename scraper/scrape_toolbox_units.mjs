// scraper/scrape_toolbox_units.mjs
// Robust text parser for https://evertaletoolbox2.runasp.net/Viewer
// Does NOT depend on <table> OR "Image" tokens.
// Output: ../data/units.json

import fs from "node:fs";
import path from "node:path";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_PATH = path.join(process.cwd(), "..", "data", "units.json");

function decodeHtmlEntities(str) {
  return String(str ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripToLines(html) {
  let t = html;

  // Preserve separators
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, "\n");

  // Remove remaining tags
  t = t.replace(/<[^>]*>/g, "\n");

  t = decodeHtmlEntities(t);

  // Normalize
  return t
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
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
    s === "Weapon" ||
    s === "Accessory" ||
    s === "Boss" ||
    s === "Elements:" ||
    s === "Rarity:" ||
    s === "ALL"
  );
}

function isLinkImageToken(s) {
  // Matches "" style text shown in the web viewer extraction
  return /^【\d+†Image】$/.test(s) || s === "Image";
}

function isNumberLike(s) {
  return /^[0-9][0-9,]*$/.test(s);
}

function toInt(s) {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function looksLikeLeaderName(s) {
  // Examples from page:
  // "Light HP Up", "Storm ATK & HP Up", "Earth Attack Up"
  return (
    typeof s === "string" &&
    s.length >= 3 &&
    s.length <= 60 &&
    /Up|ATK|HP|SPD|Speed|Attack/i.test(s) &&
    !/[.!?]$/.test(s)
  );
}

function looksLikeLeaderDesc(s) {
  // Example from page:
  // "Allied Light element units have their max HP increased by 10%."
  return typeof s === "string" && (s.includes("Allied") || /increased by/i.test(s));
}

function parseViewer(lines) {
  // Limit to the Character area only, stop before Weapon section.
  const weaponStart = lines.findIndex((x) => x === "Weapon:");
  const trimmed = weaponStart !== -1 ? lines.slice(0, weaponStart) : lines;

  // Find the header "Name" that begins the listing
  const start = trimmed.findIndex((x) => x === "Name");
  if (start === -1) throw new Error("Could not find listing start header 'Name'.");

  const slice = trimmed.slice(start);

  const units = [];

  // Scan for Name + Title + (cost, atk, hp, spd)
  // We do NOT rely on any image tokens.
  for (let i = 0; i < slice.length - 10; i++) {
    const name = slice[i];
    const title = slice[i + 1];

    // Basic filters: skip headers, links, numbers
    if (!name || !title) continue;
    if (isHeaderWord(name) || isHeaderWord(title)) continue;
    if (isLinkImageToken(name) || isLinkImageToken(title)) continue;
    if (isNumberLike(name) || isNumberLike(title)) continue;
    if (name.includes("items") || name.startsWith("Page ")) continue;

    // Find first 4 consecutive numbers within next 35 lines
    let j = i + 2;
    let cost = null, atk = null, hp = null, spd = null;
    let statsPos = -1;

    const searchLimit = Math.min(slice.length, i + 40);
    while (j < searchLimit) {
      if (
        isNumberLike(slice[j]) &&
        isNumberLike(slice[j + 1]) &&
        isNumberLike(slice[j + 2]) &&
        isNumberLike(slice[j + 3])
      ) {
        cost = toInt(slice[j]);
        atk = toInt(slice[j + 1]);
        hp = toInt(slice[j + 2]);
        spd = toInt(slice[j + 3]);
        statsPos = j;
        break;
      }
      j++;
    }

    if (statsPos === -1 || cost == null || atk == null || hp == null || spd == null) continue;

    // Next: leader skill name + desc (best effort)
    let k = statsPos + 4;

    // skip link-image tokens + ALL
    while (k < slice.length && (isLinkImageToken(slice[k]) || slice[k] === "ALL")) k++;

    let leaderSkillName = null;
    let leaderSkillText = null;

    if (looksLikeLeaderName(slice[k]) && looksLikeLeaderDesc(slice[k + 1])) {
      leaderSkillName = slice[k];
      leaderSkillText = slice[k + 1];
      k += 2;
    }

    // Skills until we hit the next unit start (heuristic) or paging/footer
    const skills = [];
    while (k < slice.length) {
      const s = slice[k];

      // break at footer / pagination / next filters
      if (
        s === "397 items" ||
        s.startsWith("Page ") ||
        s === "Rarity:" ||
        s === "Elements:" ||
        s === "Weapon:"
      )
        break;

      // break if we’re clearly at a new unit start:
      // (a non-header, non-number line followed by another non-header line,
      // and within a few lines after that there is a 4-number stat block)
      if (
        k + 1 < slice.length &&
        !isHeaderWord(s) &&
        !isHeaderWord(slice[k + 1]) &&
        !isNumberLike(s) &&
        !isNumberLike(slice[k + 1]) &&
        !isLinkImageToken(s) &&
        !isLinkImageToken(slice[k + 1])
      ) {
        // look ahead a bit for 4 consecutive numbers; if yes, that indicates a new unit
        let look = k + 2;
        const lookLimit = Math.min(slice.length, k + 20);
        let foundNewStats = false;
        while (look < lookLimit) {
          if (
            isNumberLike(slice[look]) &&
            isNumberLike(slice[look + 1]) &&
            isNumberLike(slice[look + 2]) &&
            isNumberLike(slice[look + 3])
          ) {
            foundNewStats = true;
            break;
          }
          look++;
        }
        // but only treat as new unit if the next candidate also has a plausible title-ish line (not too long)
        if (foundNewStats && s.length <= 40 && slice[k + 1].length <= 60) break;
      }

      // Collect skills, skip junk headers/images
      if (!isHeaderWord(s) && !isLinkImageToken(s)) {
        skills.push(s);
      }
      k++;
    }

    // Heuristic split: passives usually contain "Up Lv" / "Resist Lv" / "Mastery"
    const passiveSkills = skills.filter((x) => /Up Lv|Resist Lv|Mastery/i.test(x));
    const activeSkills = skills.filter((x) => !/Up Lv|Resist Lv|Mastery/i.test(x));

    const id = `${name}__${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    units.push({
      id,
      name,
      title,
      cost,
      stats: { atk, hp, spd },
      leaderSkillName,
      leaderSkillText,
      activeSkills,
      passiveSkills,
      source: { viewer: VIEWER_URL },
    });

    // Skip ahead a bit so we don’t re-detect inside same block
    i = Math.max(i, statsPos);
  }

  // Deduplicate (same name/title might appear once per page)
  const seen = new Set();
  const unique = [];
  for (const u of units) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    unique.push(u);
  }

  return unique;
}

async function run() {
  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  const res = await fetch(VIEWER_URL, {
    headers: { "user-agent": "Evertale-Optimizer-Scraper/4.0" },
  });
  if (!res.ok) throw new Error(`Viewer fetch failed: ${res.status}`);

  const html = await res.text();
  const lines = stripToLines(html);

  // Sanity: the viewer should contain at least these labels
  if (!lines.includes("Name") || !lines.includes("ATK") || !lines.includes("HP") || !lines.includes("SPD")) {
    throw new Error("Viewer response does not look like the unit listing (blocked or changed).");
  }

  const units = parseViewer(lines);

  if (!units.length) {
    // Dump a tiny debug sample into logs (first 120 lines) to see what runner received
    console.log("DEBUG first 120 lines:");
    console.log(lines.slice(0, 120).join("\n"));
    throw new Error("Parsed 0 units from Viewer text. Need to adjust parsing markers.");
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2));
  console.log(`Wrote ${units.length} units to ${OUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
