// scraper/build_clean_catalog.mjs
// Build the ONE file the website should load: data/catalog.clean.json
// Merges Toolbox sources (characters + weapons + accessories + enemies/bosses) if present.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const OUT_FILE = path.join(DATA_DIR, "catalog.clean.json");

// Priority inputs (all optional; we merge whatever exists)
const INPUTS = [
  "data/characters.toolbox.json",     // from scrape_toolbox_characters_dom.mjs (has stats)
  "data/characters.toolbox.json",     // duplicate-safe
  "data/weapons.toolbox.json",        // if produced by scrape_toolbox_units_full.mjs
  "data/accessories.toolbox.json",    // if produced by scrape_toolbox_units_full.mjs
  "data/enemies.toolbox.json",        // if produced by scrape_toolbox_units_full.mjs
  "data/bosses.toolbox.json",         // if you ever add this
  "data/catalog.toolbox.json",        // legacy/mixed (optional)
  "data/catalog.dom.raw.json",        // legacy/mixed (optional)
  "data/catalog.json"                 // legacy (optional)
];

function existsNonEmpty(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 2;
  } catch {
    return false;
  }
}

function safeJsonRead(p) {
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  // supports [] or {items: []} or {characters: []} etc.
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.items)) return raw.items;

  // common split shapes
  const merged = [];
  for (const k of ["characters", "weapons", "accessories", "enemies", "bosses", "unknown"]) {
    if (Array.isArray(raw?.[k])) merged.push(...raw[k]);
  }
  return merged.length ? merged : [];
}

function slugifyId(s) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

function catFromImage(img) {
  const x = (img || "").toLowerCase();
  if (x.includes("/weapons/")) return "weapon";
  if (x.includes("/accessories/")) return "accessory";
  if (x.includes("/monsters/") || x.includes("/enemies/")) return "enemy";
  if (x.includes("/boss")) return "boss";
  // Toolbox uses monsters/ for many enemies; characters usually appear as monsters too,
  // so we avoid using image-only to decide character.
  return "unknown";
}

function normCat(v) {
  const s = (v || "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(s)) return "character";
  if (["weapon", "weapons"].includes(s)) return "weapon";
  if (["accessory", "accessories"].includes(s)) return "accessory";
  if (["enemy", "enemies", "monster", "monsters"].includes(s)) return "enemy";
  if (["boss", "bosses"].includes(s)) return "boss";
  return s || "unknown";
}

function num(v) {
  if (v == null) return null;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeItem(raw) {
  // raw can be a string image path
  if (typeof raw === "string") {
    const image = raw;
    const name = path.posix.basename(image);
    const id = slugifyId(name);
    return {
      id,
      name,
      category: catFromImage(image),
      element: null,
      image,
      url: null,
      cost: null,
      atk: null,
      hp: null,
      spd: null
    };
  }

  const name = (raw.name ?? raw.title ?? raw.id ?? "").toString().trim();
  const id = (raw.id ?? raw.key ?? raw.unitId ?? slugifyId(name)).toString().trim() || slugifyId(name);

  const image =
    raw.imageUrl ||
    raw.image ||
    raw.img ||
    raw.icon ||
    null;

  const category =
    normCat(raw.category ?? raw.type) ||
    (image ? catFromImage(image) : "unknown");

  return {
    id,
    name: name || id,
    category,
    element: raw.element ?? null,
    image: image ?? null,
    url: raw.url ?? null,
    cost: num(raw.cost),
    atk: num(raw.atk),
    hp: num(raw.hp),
    spd: num(raw.spd),
    leaderSkill: raw.leaderSkill ?? raw.leader ?? null,
    activeSkills: raw.activeSkills ?? raw.actives ?? null,
    passiveSkills: raw.passiveSkills ?? raw.passives ?? null,
    raw
  };
}

function splitByCategory(items) {
  const out = {
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
    unknown: []
  };

  for (const it of items) {
    if (it.category === "character") out.characters.push(it);
    else if (it.category === "weapon") out.weapons.push(it);
    else if (it.category === "accessory") out.accessories.push(it);
    else if (it.category === "enemy") out.enemies.push(it);
    else if (it.category === "boss") out.bosses.push(it);
    else out.unknown.push(it);
  }
  return out;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = it.id || it.name;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const present = INPUTS.filter(existsNonEmpty);
  console.log(`[build_clean_catalog] inputs present: ${present.length}`);
  for (const p of present) console.log(` - ${p}`);

  const mergedRaw = [];
  for (const p of present) {
    try {
      mergedRaw.push(...safeJsonRead(p));
    } catch (e) {
      console.warn(`[build_clean_catalog] failed reading ${p}: ${e.message}`);
    }
  }

  const normalized = dedupe(mergedRaw.map(normalizeItem)).filter(x => x.name);

  // Promote anything from characters.toolbox.json to category=character (it contains stats)
  // If the source includes atk/hp/spd/cost, it’s definitely a character row from Viewer DOM scrape.
  for (const it of normalized) {
    if (it.category !== "character") {
      const hasStats = it.atk != null || it.hp != null || it.spd != null || it.cost != null;
      if (hasStats) it.category = "character";
    }
  }

  const split = splitByCategory(normalized);

  const out = {
    generatedAt: new Date().toISOString(),
    sourceFiles: present,
    counts: {
      total: normalized.length,
      characters: split.characters.length,
      weapons: split.weapons.length,
      accessories: split.accessories.length,
      enemies: split.enemies.length,
      bosses: split.bosses.length,
      unknown: split.unknown.length
    },
    characters: split.characters,
    weapons: split.weapons,
    accessories: split.accessories,
    enemies: split.enemies,
    bosses: split.bosses,
    unknown: split.unknown
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`[build_clean_catalog] wrote ${OUT_FILE}`);
  console.log(`[build_clean_catalog] counts:`, out.counts);
}

main();