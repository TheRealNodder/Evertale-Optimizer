// scraper/scrape_toolbox_units_full.mjs
// Recreates ../data/ and writes categorized ID lists from Toolbox Explorer.

import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;

const OUT_DIR = path.join(process.cwd(), "..", "data");
const OUT_CHAR = path.join(OUT_DIR, "characters.toolbox.json");
const OUT_WEAP = path.join(OUT_DIR, "weapons.toolbox.json");
const OUT_ENEM = path.join(OUT_DIR, "enemies.toolbox.json");
const OUT_ACC  = path.join(OUT_DIR, "accessories.toolbox.json");

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

function norm(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function extractIdFromLine(t) {
  // "RizetteBrave (Rizette)" -> "RizetteBrave"
  const m = String(t ?? "").match(/^([A-Za-z0-9_]+)\s*\(/);
  return m ? m[1] : null;
}

function extractBySections(html) {
  const $ = load(html);

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

  let current = null;

  const nodes = $("body").find("*").toArray();
  for (const el of nodes) {
    const tag = (el.tagName || "").toLowerCase();

    // detect headings
    if (["h1", "h2", "h3", "h4", "h5", "strong", "b"].includes(tag)) {
      const label = norm($(el).text());
      if (sectionMap.has(label)) current = sectionMap.get(label);
    }

    // collect items
    if (tag === "li" && current) {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const id = extractIdFromLine(text);
      if (id) buckets[current].add(id);
    }
  }

  const total =
    buckets.characters.size + buckets.weapons.size + buckets.enemies.size + buckets.accessories.size;

  if (total === 0) {
    // fallback: collect all <li> items and dump into characters
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

  // ✅ This recreates the folder every run
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
