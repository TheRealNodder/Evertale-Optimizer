// scraper/build_clean_catalog.mjs
// Normalizes mixed catalog.json into a clean structured catalog
// This is SAFE, deterministic, and automation-friendly

import fs from "fs";
import path from "path";

const DATA_DIR = "data";
const INPUT = path.join(DATA_DIR, "catalog.json");
const OUTPUT = path.join(DATA_DIR, "catalog.json");

if (!fs.existsSync(INPUT)) {
  console.error("❌ catalog.json not found in data/");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(INPUT, "utf8"));

function normalizeCategory(item) {
  const v = (item.category || item.type || "").toLowerCase();
  if (v.includes("char")) return "character";
  if (v.includes("weapon")) return "weapon";
  if (v.includes("access")) return "accessory";
  if (v.includes("boss")) return "boss";
  if (v.includes("enemy") || v.includes("monster")) return "enemy";
  return "unknown";
}

function cleanName(name) {
  if (!name) return "";
  // Remove stat dumps accidentally appended to names
  return name.split(/\b\d{2,}\b/)[0].trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const clean = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: "normalized catalog.json",
  },
  characters: [],
  weapons: [],
  accessories: [],
  enemies: [],
  bosses: [],
};

for (const item of raw.items || raw.catalog || []) {
  const category = normalizeCategory(item);
  const entry = {
    id: item.id || cryptoRandomId(),
    name: cleanName(item.name),
    element: item.element || null,
    cost: num(item.cost),
    atk: num(item.atk),
    hp: num(item.hp),
    spd: num(item.spd),
    image: item.image || item.imageUrl || null,
    sourceUrl: item.url || null,
  };

  switch (category) {
    case "character":
      clean.characters.push(entry);
      break;
    case "weapon":
      clean.weapons.push(entry);
      break;
    case "accessory":
      clean.accessories.push(entry);
      break;
    case "boss":
      clean.bosses.push(entry);
      break;
    case "enemy":
      clean.enemies.push(entry);
      break;
  }
}

fs.writeFileSync(OUTPUT, JSON.stringify(clean, null, 2));
console.log(`✅ Clean catalog written to ${OUTPUT}`);

function cryptoRandomId() {
  return Math.random().toString(36).slice(2, 10);
}