// scraper/build_clean_catalog.mjs
import fs from "fs/promises";

const OUT_FILE = "data/catalog.json";

// Try ALL common inputs we’ve been generating in this repo:
const INPUTS = [
  "data/catalog.toolbox.json",
  "data/catalog.json",
  "data/catalog.toolbox.full.json",
  "data/catalog.toolbox.mixed.json",
];

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function isAlreadyClean(json) {
  return (
    isObject(json) &&
    (Array.isArray(json.characters) ||
      Array.isArray(json.weapons) ||
      Array.isArray(json.accessories) ||
      Array.isArray(json.enemies) ||
      Array.isArray(json.bosses))
  );
}

async function fileExistsNonEmpty(path) {
  try {
    const st = await fs.stat(path);
    return st.size > 2;
  } catch {
    return false;
  }
}

async function tryReadJson(path) {
  const txt = await fs.readFile(path, "utf8");
  return JSON.parse(txt);
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

// Extract items[] from various possible shapes
function getItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  if (raw.catalog && Array.isArray(raw.catalog.items)) return raw.catalog.items;
  return null;
}

function cleanFromItems(items, generatedFrom) {
  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedFrom,
    },
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
    unknown: [],
  };

  const pushByCat = (cat, obj) => {
    if (cat === "character") out.characters.push(obj);
    else if (cat === "weapon") out.weapons.push(obj);
    else if (cat === "accessory") out.accessories.push(obj);
    else if (cat === "enemy") out.enemies.push(obj);
    else if (cat === "boss") out.bosses.push(obj);
    else out.unknown.push(obj);
  };

  for (const it of items) {
    const id = (it.id ?? it.key ?? it.name ?? "").toString().trim();
    const name = (it.name ?? it.id ?? "").toString().trim();
    if (!name) continue;

    const category = normCat(it.category ?? it.type);
    const entry = {
      id: id || name,
      name,
      category,
      element: it.element ?? null,
      image: it.image ?? it.imageUrl ?? it.img ?? null,
      url: it.url ?? "https://evertaletoolbox2.runasp.net/Explorer",
    };
    pushByCat(category, entry);
  }

  return out;
}

async function main() {
  // Helpful debug: show what’s in data/ before we even start
  try {
    const listing = await fs.readdir("data");
    console.log("data/ contains:", listing.join(", "));
  } catch {
    console.log("data/ folder not readable (does it exist?)");
  }

  // Find first usable input
  let chosen = null;
  for (const p of INPUTS) {
    if (await fileExistsNonEmpty(p)) {
      chosen = p;
      break;
    }
  }

  if (!chosen) {
    throw new Error(
      `No input catalog found. Expected one of: ${INPUTS.join(", ")}`
    );
  }

  const raw = await tryReadJson(chosen);

  // If already clean, just normalize and write
  if (isAlreadyClean(raw)) {
    console.log("Catalog already clean — passing through:", chosen);
    const out = {
      meta: {
        generatedAt: new Date().toISOString(),
        generatedFrom: chosen,
      },
      characters: raw.characters ?? [],
      weapons: raw.weapons ?? [],
      accessories: raw.accessories ?? [],
      enemies: raw.enemies ?? [],
      bosses: raw.bosses ?? [],
      unknown: raw.unknown ?? [],
    };
    await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
    console.log("Wrote:", OUT_FILE);
    return;
  }

  // Otherwise, must have items[]
  const items = getItems(raw);
  if (!items || !items.length) {
    throw new Error(`Input exists but has no items[]: ${chosen}`);
  }

  const out = cleanFromItems(items, chosen);
  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log("Wrote:", OUT_FILE);
}

main().catch((err) => {
  console.error("build_clean_catalog failed:", err.message);
  process.exit(1);
});