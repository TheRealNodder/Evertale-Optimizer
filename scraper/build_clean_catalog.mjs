// scraper/build_clean_catalog.mjs
// Builds data/catalog.clean.json from whatever input exists.
// Also writes data/catalog.toolbox.json as a compatibility copy.

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");

const CANDIDATE_INPUTS = [
  path.join(DATA_DIR, "catalog.toolbox.json"),   // old/mixed
  path.join(DATA_DIR, "catalog.dom.raw.json"),   // DOM scrape output
  path.join(DATA_DIR, "catalog.json"),           // fallback mixed
  path.join(DATA_DIR, "catalog.clean.json"),     // already clean
];

const OUT_CLEAN = path.join(DATA_DIR, "catalog.clean.json");
const OUT_COMPAT = path.join(DATA_DIR, "catalog.toolbox.json");

function existsNonEmpty(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).size > 5;
  } catch {
    return false;
  }
}

function readJsonSafe(file) {
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw);
}

function normCat(x) {
  const v = (x ?? "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(v)) return "character";
  if (["weapon", "weapons"].includes(v)) return "weapon";
  if (["accessory", "accessories"].includes(v)) return "accessory";
  if (["enemy", "enemies", "monster", "monsters"].includes(v)) return "enemy";
  if (["boss", "bosses"].includes(v)) return "boss";
  return v || "unknown";
}

function safeNum(n) {
  if (n === null || n === undefined) return null;
  const v = Number(String(n).replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : null;
}

function slugId(s) {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

// Tries to parse packed “341,7198,105409Light ...” into cost/atk/hp/spd/element.
// This is a best-effort parser for your “mixed rows” format.
function parseMixedStatsRow(text) {
  const s = (text ?? "").toString().trim();
  if (!s) return null;

  // drop obvious header rows
  if (s.toLowerCase().startsWith("name rarity element cost")) return null;

  const elements = ["Fire", "Water", "Earth", "Storm", "Dark", "Light"];
  let element = null;

  // Find element word (first match)
  for (const el of elements) {
    const idx = s.indexOf(el);
    if (idx !== -1) {
      element = el;
      break;
    }
  }

  // name is everything up to the first digit (best effort)
  const firstDigit = s.search(/\d/);
  const name = (firstDigit > 0 ? s.slice(0, firstDigit).trim() : s).trim();

  // Stats blob = from first digit up to the element word (if present)
  let statsBlob = "";
  if (firstDigit !== -1) {
    if (element) {
      const idx = s.indexOf(element);
      statsBlob = idx > firstDigit ? s.slice(firstDigit, idx).trim() : s.slice(firstDigit).trim();
    } else {
      statsBlob = s.slice(firstDigit).trim();
    }
  }

  // Clean and parse the “packed” numbers:
  // Example: "341,7198,105409" -> cost=34, atk=1,719 hp=8,105 spd=409
  let cost = null, atk = null, hp = null, spd = null;

  const compact = statsBlob.replace(/\s+/g, "");
  if (compact) {
    // take first 2 digits as cost if it looks like a cost
    const mCost2 = compact.match(/^(\d{2})(.*)$/);
    const mCost1 = compact.match(/^(\d{1})(.*)$/);

    let rest = "";
    if (mCost2) {
      cost = safeNum(mCost2[1]);
      rest = mCost2[2] || "";
    } else if (mCost1) {
      cost = safeNum(mCost1[1]);
      rest = mCost1[2] || "";
    }

    rest = rest.replace(/^,/, "");
    const parts = rest.split(",").filter(Boolean);

    // heuristics to rebuild thousands-separated numbers
    if (parts.length === 5) {
      atk = safeNum(parts[0] + "," + parts[1]);
      hp  = safeNum(parts[2] + "," + parts[3]);
      spd = safeNum(parts[4]);
    } else if (parts.length === 4) {
      atk = safeNum(parts[0] + "," + parts[1]);
      hp  = safeNum(parts[2]);
      spd = safeNum(parts[3]);
    } else if (parts.length === 3) {
      atk = safeNum(parts[0]);
      hp  = safeNum(parts[1]);
      spd = safeNum(parts[2]);
    }
  }

  return {
    name: name || s.slice(0, 60),
    element: element,
    cost, atk, hp, spd,
  };
}

function getItemsFromAnyShape(json) {
  // Accept: {items:[]}, [] , {characters:[], weapons:[]...}, etc.
  if (Array.isArray(json)) return json;

  if (Array.isArray(json.items)) return json.items;

  // if already split
  const blocks = [];
  if (Array.isArray(json.characters)) blocks.push(...json.characters.map(x => ({...x, category:"character"})));
  if (Array.isArray(json.weapons)) blocks.push(...json.weapons.map(x => ({...x, category:"weapon"})));
  if (Array.isArray(json.accessories)) blocks.push(...json.accessories.map(x => ({...x, category:"accessory"})));
  if (Array.isArray(json.enemies)) blocks.push(...json.enemies.map(x => ({...x, category:"enemy"})));
  if (Array.isArray(json.bosses)) blocks.push(...json.bosses.map(x => ({...x, category:"boss"})));
  if (blocks.length) return blocks;

  return [];
}

function normalizeItems(rawItems) {
  const out = [];

  for (const it of rawItems) {
    const rawName = (it?.name ?? it?.id ?? "").toString().trim();

    // If the record is a “mixed row” (everything jammed into name/id), try parsing stats.
    const parsed = parseMixedStatsRow(rawName);

    const name = (it?.name ?? parsed?.name ?? it?.id ?? "").toString().trim();
    if (!name) continue;

    const category = normCat(it?.category ?? it?.type);
    const element = (it?.element ?? parsed?.element ?? null);

    const image =
      it?.image ??
      it?.imageUrl ??
      it?.img ??
      it?.icon ??
      null;

    const url = it?.url ?? null;

    // prefer explicit stats, else parsed
    const cost = safeNum(it?.cost ?? parsed?.cost);
    const atk  = safeNum(it?.atk  ?? parsed?.atk);
    const hp   = safeNum(it?.hp   ?? parsed?.hp);
    const spd  = safeNum(it?.spd  ?? parsed?.spd);

    const id =
      (it?.id && it.id.toString().trim()) ||
      slugId(name + "-" + (image || ""));

    out.push({
      id,
      name,
      category,
      element,
      image,
      url,
      cost,
      atk,
      hp,
      spd,
    });
  }

  return out;
}

function splitByCategory(items) {
  const buckets = {
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
    unknown: [],
  };

  for (const x of items) {
    const c = normCat(x.category);
    if (c === "character") buckets.characters.push(x);
    else if (c === "weapon") buckets.weapons.push(x);
    else if (c === "accessory") buckets.accessories.push(x);
    else if (c === "enemy") buckets.enemies.push(x);
    else if (c === "boss") buckets.bosses.push(x);
    else buckets.unknown.push(x);
  }

  return buckets;
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const input = CANDIDATE_INPUTS.find(existsNonEmpty);
  if (!input) {
    console.error("build_clean_catalog failed: No input catalog found.");
    console.error("Looked for:");
    for (const p of CANDIDATE_INPUTS) console.error(" - " + p);
    process.exit(1);
  }

  let json;
  try {
    json = readJsonSafe(input);
  } catch (e) {
    console.error(`build_clean_catalog failed: Could not parse JSON: ${input}`);
    console.error(String(e?.message ?? e));
    process.exit(1);
  }

  const rawItems = getItemsFromAnyShape(json);

  // If dom/raw file is shaped like { items: [...] }, you’re fine.
  // If it’s “already clean split”, also fine.
  if (!rawItems.length) {
    console.error(`build_clean_catalog failed: No items array found in ${path.basename(input)}`);
    process.exit(1);
  }

  const normalized = normalizeItems(rawItems);
  const buckets = splitByCategory(normalized);

  const clean = {
    generatedAt: new Date().toISOString(),
    sourceFiles: [path.relative(process.cwd(), input)],
    counts: {
      total: normalized.length,
      characters: buckets.characters.length,
      weapons: buckets.weapons.length,
      accessories: buckets.accessories.length,
      enemies: buckets.enemies.length,
      bosses: buckets.bosses.length,
      unknown: buckets.unknown.length,
    },
    ...buckets,
  };

  fs.writeFileSync(OUT_CLEAN, JSON.stringify(clean, null, 2), "utf8");
  fs.writeFileSync(OUT_COMPAT, JSON.stringify(clean, null, 2), "utf8");

  console.log(`✅ Input: ${path.relative(process.cwd(), input)}`);
  console.log(`✅ Wrote: ${path.relative(process.cwd(), OUT_CLEAN)}`);
  console.log(`✅ Wrote: ${path.relative(process.cwd(), OUT_COMPAT)} (compat)`);
  console.log(`Counts: total=${clean.counts.total}, chars=${clean.counts.characters}, weapons=${clean.counts.weapons}`);
}

main();