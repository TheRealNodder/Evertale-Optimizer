// scraper/build_clean_catalog.mjs
// Build data/catalog.clean.json from whatever inputs exist.
// This script is intentionally tolerant: it tries multiple sources and keeps going.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const OUT_FILE = path.join(DATA_DIR, "catalog.clean.json");

// Inputs we may have in your repo based on your screenshots/logs:
const INPUTS = [
  path.join(DATA_DIR, "catalog.toolbox.json"),     // old name (often missing)
  path.join(DATA_DIR, "catalog.json"),             // sometimes exists (may be broken)
  path.join(DATA_DIR, "catalog.dom.raw.json"),     // dom scrape fallback
  path.join(DATA_DIR, "catalog.clean.json"),       // if already built, we can re-save normalized
];

function normCat(x) {
  const v = (x || "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(v)) return "character";
  if (["weapon", "weapons"].includes(v)) return "weapon";
  if (["accessory", "accessories"].includes(v)) return "accessory";
  if (["enemy", "enemies", "monster", "monsters"].includes(v)) return "enemy";
  if (["boss", "bosses"].includes(v)) return "boss";
  return v || "unknown";
}

function safeReadJson(file) {
  if (!fs.existsSync(file)) return null;
  const txt = fs.readFileSync(file, "utf8").trim();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function extractItems(json) {
  // Accept lots of shapes:
  // - array
  // - { items: [...] }
  // - { catalog: { items: [...] } }
  // - clean split lists: { characters, weapons, ... }
  if (!json) return [];

  if (Array.isArray(json)) return json;

  if (Array.isArray(json.items)) return json.items;

  if (json.catalog && Array.isArray(json.catalog.items)) return json.catalog.items;

  // split clean catalog shape
  const blocks = [
    ["character", json.characters],
    ["weapon", json.weapons],
    ["accessory", json.accessories],
    ["enemy", json.enemies],
    ["boss", json.bosses],
  ];

  const out = [];
  for (const [cat, arr] of blocks) {
    if (!Array.isArray(arr)) continue;
    for (const it of arr) out.push({ ...it, category: it.category ?? cat });
  }
  return out;
}

function inferCategory(it) {
  const cat = normCat(it.category ?? it.type);
  if (cat !== "unknown") return cat;

  const img = (it.image ?? it.imageUrl ?? it.img ?? it.icon ?? "").toString();
  const url = (it.url ?? "").toString();

  const s = (img + " " + url).toLowerCase();

  if (s.includes("/files/images/weapons/")) return "weapon";
  if (s.includes("/files/images/accessories/")) return "accessory";
  if (s.includes("/files/images/monsters/")) return "enemy";
  if (s.includes("/files/images/boss")) return "boss";
  if (s.includes("/files/images/units/") || s.includes("/files/images/characters/")) return "character";

  return "unknown";
}

function isGarbageRow(name) {
  const n = (name || "").toString().trim();
  if (!n) return true;
  // Your “header row” problem:
  if (n.toLowerCase().includes("name rarity element cost atk hp spd")) return true;
  return false;
}

function makeId(it) {
  const id = (it.id ?? it.key ?? it.unitId ?? "").toString().trim();
  if (id) return id;
  const name = (it.name ?? "").toString().trim();
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeItem(it) {
  const name = (it.name ?? it.title ?? it.label ?? "").toString().trim();
  const id = makeId(it);
  const category = inferCategory(it);
  const element = (it.element ?? "").toString() || null;

  const image =
    it.image ??
    it.imageUrl ??
    it.img ??
    it.icon ??
    null;

  const url = it.url ?? null;

  // keep numeric fields if they exist
  const cost = Number.isFinite(Number(it.cost)) ? Number(it.cost) : null;
  const atk = Number.isFinite(Number(it.atk)) ? Number(it.atk) : null;
  const hp  = Number.isFinite(Number(it.hp))  ? Number(it.hp)  : null;
  const spd = Number.isFinite(Number(it.spd)) ? Number(it.spd) : null;

  return { id, name, category, element, image, url, cost, atk, hp, spd };
}

function splitByCategory(items) {
  const out = {
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
    unknown: [],
  };

  for (const it of items) {
    const c = normCat(it.category);
    if (c === "character") out.characters.push(it);
    else if (c === "weapon") out.weapons.push(it);
    else if (c === "accessory") out.accessories.push(it);
    else if (c === "enemy") out.enemies.push(it);
    else if (c === "boss") out.bosses.push(it);
    else out.unknown.push(it);
  }
  return out;
}

function uniqById(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.id) continue;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function run() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const sourceFiles = [];
  let rawItems = [];

  for (const f of INPUTS) {
    const json = safeReadJson(f);
    if (!json) continue;
    const items = extractItems(json);
    if (items.length) {
      sourceFiles.push(path.relative(process.cwd(), f));
      rawItems = rawItems.concat(items);
    }
  }

  // Normalize
  const normalized = rawItems
    .map(normalizeItem)
    .filter((x) => x.id && !isGarbageRow(x.name));

  const unique = uniqById(normalized);
  const split = splitByCategory(unique);

  const result = {
    generatedAt: new Date().toISOString(),
    sourceFiles,
    counts: {
      total: unique.length,
      characters: split.characters.length,
      weapons: split.weapons.length,
      accessories: split.accessories.length,
      enemies: split.enemies.length,
      bosses: split.bosses.length,
      unknown: split.unknown.length,
    },
    characters: split.characters,
    weapons: split.weapons,
    accessories: split.accessories,
    enemies: split.enemies,
    bosses: split.bosses,
    unknown: split.unknown,
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), "utf8");

  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log("counts:", result.counts);

  if (result.counts.total < 10) {
    // hard fail if output is obviously useless
    throw new Error(`Clean catalog too small (total=${result.counts.total}). Inputs may be empty/broken.`);
  }
}

try {
  run();
} catch (e) {
  console.error("build_clean_catalog failed:", e.message);
  process.exit(1);
}