// scraper/scrape_toolbox_units.mjs
// Node 18+ (built-in fetch). Requires: cheerio (rc.10 works great)
// Output: ../data/units.json

import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_PATH = path.join(process.cwd(), "..", "data", "units.json");

function cleanText(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function toIntMaybe(s) {
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function splitSkillCellText(s) {
  // Viewer often renders skills as separate lines; we normalize to an array of names.
  // Examples seen: "Linked Edge Restore Link Elemental Cure ..."
  // We'll keep them as an array by splitting on common separators.
  const t = String(s ?? "").trim();
  if (!t) return [];

  // Prefer line breaks if present; fallback to multiple spaces with capitalization boundaries is too risky.
  // Cheerio .text() collapses whitespace, so we also try <br>/<li> by reading html and splitting.
  return t
    .split("  ") // double-space often appears between items
    .map(x => cleanText(x))
    .filter(Boolean);
}

function pickIdFromRow($row) {
  // Try to find a link to a Character page
  const a = $row.find('a[href*="/Character/"]').first();
  const href = a.attr("href");
  if (href) {
    const last = href.split("/").filter(Boolean).pop();
    if (last) return last; // e.g. RizetteBrave01
  }
  return null;
}

async function run() {
  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  const res = await fetch(VIEWER_URL, {
    headers: { "user-agent": "Evertale-Optimizer-Scraper/2.0" },
  });
  if (!res.ok) throw new Error(`Viewer fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Find the main data table: it has headers like Name / Rarity / Element / ATK / HP / SPD
  const tables = $("table");
  if (!tables.length) throw new Error("No tables found on Viewer page (HTML structure changed).");

  let targetTable = null;

  tables.each((_, tbl) => {
    const $tbl = $(tbl);
    const headerText = cleanText($tbl.find("thead").text() || $tbl.find("tr").first().text());
    if (
      headerText.includes("Name") &&
      headerText.includes("Rarity") &&
      headerText.includes("Element") &&
      headerText.includes("ATK") &&
      headerText.includes("HP") &&
      headerText.includes("SPD")
    ) {
      targetTable = $tbl;
      return false; // break
    }
  });

  if (!targetTable) {
    throw new Error("Could not locate the unit table (headers not found).");
  }

  // Build column index map from the header row
  const headerCells = targetTable.find("thead th");
  const cols = [];
  headerCells.each((_, th) => cols.push(cleanText($(th).text())));

  // Fallback if no thead
  if (!cols.length) {
    const th2 = targetTable.find("tr").first().find("th,td");
    th2.each((_, c) => cols.push(cleanText($(c).text())));
  }

  const colIndex = (name) => cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());

  const idxName = colIndex("Name");
  const idxRarity = colIndex("Rarity");
  const idxElement = colIndex("Element");
  const idxAtk = colIndex("ATK");
  const idxHp = colIndex("HP");
  const idxSpd = colIndex("SPD");
  const idxWeapon = colIndex("Weapon");
  const idxLeader = colIndex("Leader Skill");
  const idxActive = colIndex("Active Skills");
  const idxPassive = colIndex("Passive Skills");

  if ([idxName, idxRarity, idxElement, idxAtk, idxHp, idxSpd].some((i) => i < 0)) {
    throw new Error(`Missing required columns. Found columns: ${JSON.stringify(cols)}`);
  }

  const units = [];

  // Use tbody rows if present; else all rows after the header
  const rows = targetTable.find("tbody tr").length
    ? targetTable.find("tbody tr")
    : targetTable.find("tr").slice(1);

  rows.each((_, tr) => {
    const $row = $(tr);
    const cells = $row.find("td");
    if (!cells.length) return;

    const getCellText = (i) => (i >= 0 && i < cells.length ? cleanText($(cells[i]).text()) : "");

    const name = getCellText(idxName);
    if (!name) return; // skip blanks

    const id = pickIdFromRow($row) || name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    const rarityText = getCellText(idxRarity);
    // Viewer may show rarity as stars/number; keep numeric if possible
    const rarityNum = toIntMaybe(rarityText) ?? null;

    const element = getCellText(idxElement) || null;

    const atk = toIntMaybe(getCellText(idxAtk));
    const hp = toIntMaybe(getCellText(idxHp));
    const spd = toIntMaybe(getCellText(idxSpd));

    const weaponType = idxWeapon >= 0 ? getCellText(idxWeapon) : null;
    const leaderSkill = idxLeader >= 0 ? getCellText(idxLeader) : null;

    const activeRaw = idxActive >= 0 ? getCellText(idxActive) : "";
    const passiveRaw = idxPassive >= 0 ? getCellText(idxPassive) : "";

    units.push({
      id,
      name,
      rarity: rarityNum,
      element,
      stats: { atk, hp, spd },
      weaponType: weaponType || null,
      leaderSkill: leaderSkill || null,
      activeSkills: splitSkillCellText(activeRaw),
      passiveSkills: splitSkillCellText(passiveRaw),
      source: { viewer: VIEWER_URL },
    });
  });

  if (!units.length) {
    throw new Error("Parsed 0 units from the Viewer table (row parsing failed).");
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2)
  );

  console.log(`Wrote ${units.length} units to ${OUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
