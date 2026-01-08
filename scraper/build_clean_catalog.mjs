// scraper/build_clean_catalog.mjs
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve("data");

// Inputs (best-first)
const INPUTS = [
  path.join(DATA_DIR, "catalog.toolbox.json"),
  path.join(DATA_DIR, "catalog.json"),
  path.join(DATA_DIR, "catalog.dom.raw.json"),
  path.join(DATA_DIR, "catalog.clean.json")
];

const OUT = path.join(DATA_DIR, "catalog.clean.json");

function readJsonIfValid(file) {
  if (!fs.existsSync(file)) return null;
  const txt = fs.readFileSync(file, "utf8").trim();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    console.log(`⚠️ Skipping invalid JSON: ${file}`);
    return null;
  }
}

function normCat(x) {
  const v = (x || "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(v)) return "character";
  if (["weapon", "weapons"].includes(v)) return "weapon";
  if (["enemy", "enemies", "monster", "monsters"].includes(v)) return "enemy";
  if (["boss", "bosses"].includes(v)) return "boss";
  if (["accessory", "accessories"].includes(v)) return "accessory";
  return v || "unknown";
}

function inferCategoryFromText(item) {
  const url = (item.url || item.href || "").toString().toLowerCase();
  const img = (item.image || item.imageUrl || item.img || "").toString().toLowerCase();
  const blob = `${url} ${img}`.toLowerCase();

  if (blob.includes("/files/images/weapons/")) return "weapon";
  if (blob.includes("/files/images/accessories/")) return "accessory";
  if (blob.includes("/files/images/monsters/")) return "enemy";
  if (blob.includes("/files/images/boss")) return "boss";
  if (blob.includes("/files/images/characters/")) return "character";

  // Fallback guess using words
  const name = (item.name || item.id || "").toString().toLowerCase();
  if (name.includes("sword") || name.includes("axe") || name.includes("spear") || name.includes("hammer")) return "weapon";

  return "unknown";
}

function isHeaderRow(s) {
  const t = (s || "").toString().trim().toLowerCase();
  if (!t) return true;
  // This is the exact bad header you showed
  if (t.includes("name rarity element cost atk hp spd")) return true;
  return false;
}

function unwrapToItems(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;

  if (Array.isArray(obj.items)) return obj.items;

  // common “catalog blocks” shapes
  if (obj.catalog) {
    if (Array.isArray(obj.catalog.items)) return obj.catalog.items;

    // already split into blocks
    const out = [];
    for (const k of ["characters", "weapons", "accessories", "enemies", "bosses"]) {
      if (Array.isArray(obj.catalog[k])) out.push(...obj.catalog[k]);
    }
    if (out.length) return out;
  }

  // already clean format (top-level blocks)
  const out2 = [];
  for (const k of ["characters", "weapons", "accessories", "enemies", "bosses"]) {
    if (Array.isArray(obj[k])) out2.push(...obj[k]);
  }
  return out2;
}

function pickNameFromMixedString(mixed) {
  // Heuristic: name is before rarity tokens (SSR/SR/R) or element words
  const s = mixed.replace(/\s+/g, " ").trim();

  // common tokens in your mixed rows
  const rarityRe = /\b(ur|ssr|sr|r)\b/i;
  const elemRe = /\b(fire|water|storm|earth|light|dark)\b/i;

  const r = s.search(rarityRe);
  const e = s.search(elemRe);

  let cut = -1;
  if (r !== -1) cut = r;
  if (e !== -1) cut = cut === -1 ? e : Math.min(cut, e);

  if (cut === -1) return s.slice(0, 60).trim(); // fallback

  return s.slice(0, cut).trim();
}

function cleanOne(raw) {
  // normalize fields
  const idRaw = (raw.id ?? raw.key ?? raw.name ?? "").toString().trim();
  const nameRaw = (raw.name ?? raw.title ?? raw.id ?? "").toString().trim();

  // remove header/junk
  if (isHeaderRow(idRaw) || isHeaderRow(nameRaw)) return null;

  // if the name is a giant mixed blob, attempt to extract name
  let name = nameRaw;
  if (name.length > 80 && /atk|hp|spd|rarity|element/i.test(name)) {
    name = pickNameFromMixedString(nameRaw);
  }

  let id = idRaw;
  if (!id || id.length > 200) id = name; // stable-ish fallback

  const image =
    raw.imageUrl ||
    raw.image ||
    raw.img ||
    raw.icon ||
    null;

  const url = raw.url || raw.href || null;

  let category = normCat(raw.category ?? raw.type);
  if (category === "unknown") category = inferCategoryFromText({ ...raw, image, url, name });

  // element normalization if present
  let element = (raw.element || "").toString().trim();
  if (!element && typeof raw.element === "number") element = String(raw.element);

  return {
    id,
    name,
    category,
    element: element || null,
    image: image || null,
    url: url || null
  };
}

function splitIntoBlocks(cleanItems) {
  const blocks = {
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: []
  };

  for (const it of cleanItems) {
    const c = normCat(it.category);

    if (c === "character") blocks.characters.push(it);
    else if (c === "weapon") blocks.weapons.push(it);
    else if (c === "accessory") blocks.accessories.push(it);
    else if (c === "boss") blocks.bosses.push(it);
    else if (c === "enemy") blocks.enemies.push(it);
    else {
      // keep unknowns out of the final catalog (optional)
      // If you want to keep them, push to enemies or create "misc"
    }
  }

  return blocks;
}

function main() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  let sourceFile = null;
  let sourceJson = null;

  for (const f of INPUTS) {
    const j = readJsonIfValid(f);
    if (!j) continue;
    const items = unwrapToItems(j);
    if (items && items.length) {
      sourceFile = f;
      sourceJson = j;
      break;
    }
  }

  if (!sourceJson) {
    console.log("data/ contains:", fs.readdirSync(DATA_DIR).join(", "));
    throw new Error("build_clean_catalog failed: No valid catalog source found.");
  }

  const rawItems = unwrapToItems(sourceJson);
  const cleaned = rawItems
    .map(cleanOne)
    .filter(Boolean);

  // de-dupe by id
  const byId = new Map();
  for (const it of cleaned) {
    if (!it.id || !it.name) continue;
    if (!byId.has(it.id)) byId.set(it.id, it);
  }
  const uniq = [...byId.values()];

  const blocks = splitIntoBlocks(uniq);

  const out = {
    generatedAt: new Date().toISOString(),
    generatedFrom: path.relative(process.cwd(), sourceFile).replace(/\\/g, "/"),
    characters: blocks.characters,
    weapons: blocks.weapons,
    accessories: blocks.accessories,
    enemies: blocks.enemies,
    bosses: blocks.bosses
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");

  console.log(`✅ Clean catalog written -> ${OUT}`);
  console.log(
    `counts: characters=${out.characters.length}, weapons=${out.weapons.length}, accessories=${out.accessories.length}, enemies=${out.enemies.length}, bosses=${out.bosses.length}`
  );
}

main();