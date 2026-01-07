// scraper/scrape_toolbox_units_full.mjs
// Scrape Toolbox Explorer and split into Characters / Weapons / Enemies.
// Writes:
//   ../data/characters.toolbox.json
//   ../data/weapons.toolbox.json
//   ../data/enemies.toolbox.json

import fs from "node:fs/promises";
import path from "node:path";
import cheerio from "cheerio";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;

const OUT_DIR = path.join(process.cwd(), "..", "data");
const OUT_CHAR = path.join(OUT_DIR, "characters.toolbox.json");
const OUT_WEAP = path.join(OUT_DIR, "weapons.toolbox.json");
const OUT_ENEM = path.join(OUT_DIR, "enemies.toolbox.json");

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

// Normalize heading text
function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractIdFromLine(t) {
  // "RizetteBrave (Rizette)" -> RizetteBrave
  const m = t.match(/^([A-Za-z0-9_]+)\s*\(/);
  return m ? m[1] : null;
}

/**
 * We walk the DOM in order:
 * - when we hit a heading like "Character", set currentSection
 * - collect <li> text under that heading until next heading
 */
function extractBySections(html) {
  const $ = cheerio.load(html);

  // These are the section names the Toolbox uses in its nav/content.
  // We map them to output keys.
  const sectionMap = new Map([
    ["character", "characters"],
    ["characters", "characters"],
    ["weapon", "weapons"],
    ["weapons", "weapons"],
    ["boss", "enemies"],
    ["bosses", "enemies"],
    ["enemy", "enemies"],
    ["enemies", "enemies"],
    ["accessory", "accessories"],
    ["accessories", "accessories"]
  ]);

  const buckets = {
    characters: new Set(),
    weapons: new Set(),
    enemies: new Set(),
    accessories: new Set()
  };

  // We attempt two strategies:
  // (A) Heading-based DOM walk using h1/h2/h3/h4 text
  // (B) Fallback: look for "Character" / "Weapon" / "Boss" labels near lists

  // Strategy A: DOM walk
  let current = null;

  // Select a broad set of possible heading containers
  const nodes = $("body").find("*").toArray();

  for (const el of nodes) {
    const tag = (el.tagName || "").toLowerCase();

    // Detect headings
    if (["h1", "h2", "h3", "h4", "h5", "strong", "b"].includes(tag)) {
      const label = norm($(el).text());
      if (sectionMap.has(label)) {
        current = sectionMap.get(label);
      }
    }

    // Collect list items if we’re inside a known section
    if (tag === "li" && current) {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const id = extractIdFromLine(text);
      if (id) buckets[current].add(id);
    }
  }

  // Strategy B: If A fails (no headings), collect all <li> and then classify by nearby label
  const totalCollected =
    buckets.characters.size + buckets.weapons.size + buckets.enemies.size + buckets.accessories.size;

  if (totalCollected === 0) {
    // fallback: just collect all li
    const li = $("li")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean);

    for (const t of li) {
      const id = extractIdFromLine(t);
      if (!id) continue;

      // Very rough classification fallback:
      // Weapon IDs often end with numbers or include weapon-like words; enemies often include Boss-like names.
      // If we can’t tell, dump into characters.
      if (/(Sword|Axe|Staff|Spear|Katana|Hammer|Mace)/i.test(id)) buckets.weapons.add(id);
      else buckets.characters.add(id);
    }
  }

  return {
    characters: [...buckets.characters].sort((a, b) => a.localeCompare(b)),
    weapons: [...buckets.weapons].sort((a, b) => a.localeCompare(b)),
    enemies: [...buckets.enemies].sort((a, b) => a.localeCompare(b)),
    accessories: [...buckets.accessories].sort((a, b) => a.localeCompare(b))
  };
}

function wrapList(list, source) {
  return {
    updatedAt: new Date().toISOString(),
    source,
    ids: list
  };
}

async function run() {
  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  const html = await fetchText(EXPLORER_URL);

  const { characters, weapons, enemies, accessories } = extractBySections(html);

  if (!characters.length && !weapons.length && !enemies.length) {
    throw new Error("No IDs extracted. Explorer HTML structure may have changed.");
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  await fs.writeFile(OUT_CHAR, JSON.stringify(wrapList(characters, EXPLORER_URL), null, 2), "utf8");
  await fs.writeFile(OUT_WEAP, JSON.stringify(wrapList(weapons, EXPLORER_URL), null, 2), "utf8");
  await fs.writeFile(OUT_ENEM, JSON.stringify(wrapList(enemies, EXPLORER_URL), null, 2), "utf8");

  // accessories is optional; write only if non-empty
  if (accessories.length) {
    const outAcc = path.join(OUT_DIR, "accessories.toolbox.json");
    await fs.writeFile(outAcc, JSON.stringify(wrapList(accessories, EXPLORER_URL), null, 2), "utf8");
    console.log(`Accessories: ${accessories.length} -> data/accessories.toolbox.json`);
  }

  console.log(`Characters: ${characters.length} -> data/characters.toolbox.json`);
  console.log(`Weapons:    ${weapons.length} -> data/weapons.toolbox.json`);
  console.log(`Enemies:    ${enemies.length} -> data/enemies.toolbox.json`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
