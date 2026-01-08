// scraper/build_clean_catalog.mjs
// Build a "clean" catalog for the site from whatever partial/mixed sources exist.
// - Works even if you only have image-path items (no stats).
// - Detects categories by image path (weapons/units/characters/accessories/monsters/enemies/bosses).
// - Does NOT require Viewer stats to exist (stats remain null).

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");

const INPUT_CANDIDATES = [
  "data/catalog.toolbox.json",
  "data/catalog.json",
  "data/catalog.clean.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  "data/catalog.dom.raw.json",
  // add more if you generate them:
  "data/catalog.dom.raw.json",
];

function existsNonEmpty(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 2;
  } catch {
    return false;
  }
}

function tryReadJson(p) {
  try {
    const txt = fs.readFileSync(p, "utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function toArray(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.catalog)) return json.catalog;
  if (json.catalog && Array.isArray(json.catalog.items)) return json.catalog.items;

  // split-style catalog
  if (json.catalog && typeof json.catalog === "object") {
    const out = [];
    for (const k of ["characters", "weapons", "accessories", "enemies", "bosses"]) {
      if (Array.isArray(json.catalog[k])) out.push(...json.catalog[k]);
    }
    return out;
  }

  return [];
}

function normCat(x) {
  const v = (x || "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(v)) return "character";
  if (["weapon", "weapons"].includes(v)) return "weapon";
  if (["accessory", "accessories"].includes(v)) return "accessory";
  if (["enemy", "enemies", "monster", "monsters"].includes(v)) return "enemy";
  if (["boss", "bosses"].includes(v)) return "boss";
  return v || "unknown";
}

function catFromImage(img) {
  const s = (img || "").toString().toLowerCase();

  // weapon
  if (s.includes("/weapons/")) return "weapon";

  // accessory
  if (s.includes("/accessories/") || s.includes("/acc/")) return "accessory";

  // characters/units (toolbox uses different folder names depending on page)
  if (
    s.includes("/units/") ||
    s.includes("/unit/") ||
    s.includes("/characters/") ||
    s.includes("/character/") ||
    s.includes("/heroes/") ||
    s.includes("/hero/")
  ) return "character";

  // enemies/monsters
  if (s.includes("/monsters/") || s.includes("/enemies/")) return "enemy";

  // bosses (if they have their own folder)
  if (s.includes("/boss/") || s.includes("/bosses/")) return "boss";

  return "unknown";
}

function slugifyId(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Turns "VenusSeaShellMace01.png" into "Venus Sea Shell Mace 01"
function prettyNameFromFilename(filename) {
  const base = filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
  const spaced = base
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d+)/g, "$1 $2")
    .replace(/(\d+)([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return spaced || base;
}

// Accepts either:
// - {id,name,image,url,category,type,...}
// - raw strings like "/files/images/weapons/small/X.png"
// - DOM scraped objects {image: "..."} etc
function normalizeItem(raw) {
  // If it’s a plain string, treat it as image/path/name
  if (typeof raw === "string") {
    const img = raw;
    const file = path.posix.basename(img);
    const name = prettyNameFromFilename(file);
    const category = catFromImage(img);
    const id = slugifyId(file || img);
    return {
      id,
      name,
      category,
      element: null,
      image: img,
      url: null,
      cost: null,
      atk: null,
      hp: null,
      spd: null,
    };
  }

  const img = raw.imageUrl || raw.image || raw.img || raw.icon || null;

  // Sometimes your broken mixed rows look like:
  // "Name Rarity Element Cost ATK HP ..."
  // Treat those as invalid headers
  const rawName = (raw.name ?? raw.id ?? "").toString();
  const lower = rawName.toLowerCase();
  if (
    lower.includes("name rarity element cost") ||
    lower === "name" ||
    lower.startsWith("name rarity")
  ) {
    return null;
  }

  const category = normCat(raw.category ?? raw.type) || catFromImage(img);
  const name =
    (raw.name && raw.name.toString().trim()) ||
    (img ? prettyNameFromFilename(path.posix.basename(img)) : rawName.trim()) ||
    null;

  const id =
    (raw.id && raw.id.toString().trim()) ||
    (raw.key && raw.key.toString().trim()) ||
    (img ? slugifyId(path.posix.basename(img)) : slugifyId(name)) ||
    null;

  if (!id || !name) return null;

  return {
    id,
    name,
    category: category === "unknown" ? catFromImage(img) : category,
    element: raw.element ?? null,
    image: img,
    url: raw.url ?? null,
    cost: raw.cost ?? null,
    atk: raw.atk ?? null,
    hp: raw.hp ?? null,
    spd: raw.spd ?? null,
  };
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
    const cat = normCat(it.category);
    if (cat === "character") out.characters.push(it);
    else if (cat === "weapon") out.weapons.push(it);
    else if (cat === "accessory") out.accessories.push(it);
    else if (cat === "enemy") out.enemies.push(it);
    else if (cat === "boss") out.bosses.push(it);
    else out.unknown.push(it);
  }
  return out;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = it.id || it.name;
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // Load the first valid JSON source that contains items
  const sourcesTried = [];
  let inputFile = null;
  let inputJson = null;

  // auto-detect: any json in data that looks like catalog
  const dataFiles = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.toLowerCase().endsWith(".json"))
    .map((f) => path.join("data", f));

  const candidates = [
    ...INPUT_CANDIDATES,
    ...dataFiles, // fallback to ANY json present
  ];

  for (const file of candidates) {
    if (!existsNonEmpty(file)) continue;
    sourcesTried.push(file);
    const json = tryReadJson(file);
    if (!json) continue;

    const arr = toArray(json);
    if (arr.length >= 1) {
      inputFile = file;
      inputJson = json;
      break;
    }
  }

  if (!inputJson) {
    console.error("build_clean_catalog failed: No readable catalog source JSON found.");
    console.error("Tried:", sourcesTried);
    process.exit(1);
  }

  const rawArr = toArray(inputJson);

  // Normalize items
  const normalized = dedupe(
    rawArr
      .map(normalizeItem)
      .filter(Boolean)
      .map((x) => ({
        ...x,
        // if category still unknown but we have an image, infer it
        category: x.category === "unknown" ? catFromImage(x.image) : x.category,
      }))
  );

  const split = splitByCategory(normalized);

  const out = {
    generatedAt: new Date().toISOString(),
    sourceFiles: [inputFile],
    counts: {
      total: normalized.length,
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

  const outPath = path.join(DATA_DIR, "catalog.clean.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  console.log(`Wrote clean catalog -> ${outPath}`);
  console.log("Counts:", out.counts);
}

main();