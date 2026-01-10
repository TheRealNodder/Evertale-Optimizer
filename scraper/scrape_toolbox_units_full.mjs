// scraper/scrape_toolbox_units_full.mjs
// Writes categorized ID lists from Toolbox Explorer into repo-root /data

import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;

// IMPORTANT: workflow runs from repo root, so output must be ./data (NOT ../data)
const OUT_DIR  = path.join(process.cwd(), "data");
const OUT_CHAR = path.join(OUT_DIR, "characters.toolbox.json");
const OUT_WEAP = path.join(OUT_DIR, "weapons.toolbox.json");
const OUT_ENEM = path.join(OUT_DIR, "enemies.toolbox.json");
const OUT_ACC  = path.join(OUT_DIR, "accessories.toolbox.json");

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function normalizeHeading(t) {
  return String(t ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractIdFromLine(t) {
  // "RizetteBrave (Rizette)" -> "RizetteBrave"
  const m = String(t ?? "").match(/^([A-Za-z0-9_]+)\s*\(/);
  return m ? m[1] : null;
}

function extractBySections(html) {
  // FIX: use cheerio.load, not load()
  import * as cheerio from "cheerio";
  const $ = cheerio.load(html);

  // map a section heading -> output bucket key
  const sectionMap = new Map([
    ["character", "characters"],
    ["characters", "characters"],
    ["unit", "characters"],
    ["units", "characters"],

    ["weapon", "weapons"],
    ["weapons", "weapons"],

    ["accessory", "accessories"],
    ["accessories", "accessories"],

    ["enemy", "enemies"],
    ["enemies", "enemies"],
    ["monster", "enemies"],
    ["monsters", "enemies"],
    ["boss", "enemies"],
    ["bosses", "enemies"],
  ]);

  const buckets = {
    characters: new Set(),
    weapons: new Set(),
    enemies: new Set(),
    accessories: new Set(),
  };

  // Toolbox Explorer tends to use headings + UL lists.
  // Strategy:
  // - find headings (h1/h2/h3/h4) and read the next UL/OL
  // - parse list items as "Id (Name)" format
  const headings = $("h1,h2,h3,h4").toArray();

  for (const h of headings) {
    const headText = normalizeHeading($(h).text());
    const bucketKey = sectionMap.get(headText);
    if (!bucketKey) continue;

    // try to find the next list near the heading
    let list = $(h).nextAll("ul,ol").first();
    if (!list || !list.length) {
      // sometimes there is a div wrapper
      list = $(h).parent().find("ul,ol").first();
    }
    if (!list || !list.length) continue;

    list.find("li").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const id = extractIdFromLine(text);
      if (id) buckets[bucketKey].add(id);
    });
  }

  // Fallback: if headings parsing failed, grab all LI and dump into characters
  const total =
    buckets.characters.size +
    buckets.weapons.size +
    buckets.enemies.size +
    buckets.accessories.size;

  if (total === 0) {
    $("li").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const id = extractIdFromLine(text);
      if (id) buckets.characters.add(id);
    });
  }

  const out = {};
  for (const [k, set] of Object.entries(buckets)) {
    out[k] = [...set].sort((a, b) => a.localeCompare(b));
  }
  return out;
}

function wrap(ids, source) {
  return { updatedAt: new Date().toISOString(), source, ids };
}

async function run() {
  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  const html = await fetchText(EXPLORER_URL);

  const { characters, weapons, enemies, accessories } = extractBySections(html);

  if (!characters.length && !weapons.length && !enemies.length && !accessories.length) {
    throw new Error("No IDs extracted. Explorer HTML may have changed.");
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  await fs.writeFile(OUT_CHAR, JSON.stringify(wrap(characters, EXPLORER_URL), null, 2), "utf8");
  await fs.writeFile(OUT_WEAP, JSON.stringify(wrap(weapons, EXPLORER_URL), null, 2), "utf8");
  await fs.writeFile(OUT_ENEM, JSON.stringify(wrap(enemies, EXPLORER_URL), null, 2), "utf8");

  if (accessories.length) {
    await fs.writeFile(OUT_ACC, JSON.stringify(wrap(accessories, EXPLORER_URL), null, 2), "utf8");
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
