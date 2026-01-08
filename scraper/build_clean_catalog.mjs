// scraper/build_clean_catalog.mjs
// Builds a CLEAN catalog.json for the website from messy toolbox output.
// Input priority:
//   1) data/catalog.toolbox.json
//   2) data/catalog.json (fallback if toolbox file isn't present)
// Output:
//   data/catalog.json  (clean, split by category)

import fs from "fs/promises";
import crypto from "crypto";

const IN_TOOLBOX = "data/catalog.toolbox.json";
const IN_FALLBACK = "data/catalog.json";
const OUT_FILE = "data/catalog.json";

const ELEMENTS = ["Fire", "Water", "Storm", "Earth", "Light", "Dark"];

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function isHeaderRow(s) {
  const t = norm(s).toLowerCase();
  return (
    t.includes("name rarity element cost") ||
    t.includes("leader skill active skills passive skills") ||
    t === "name"
  );
}

function guessCategory(item) {
  // Trust explicit category/type if present
  const rawCat = (item.category ?? item.type ?? "").toString().toLowerCase().trim();
  if (rawCat) {
    if (rawCat.includes("char") || rawCat.includes("unit")) return "character";
    if (rawCat.includes("weapon")) return "weapon";
    if (rawCat.includes("access")) return "accessory";
    if (rawCat.includes("boss")) return "boss";
    if (rawCat.includes("enemy") || rawCat.includes("monster")) return "enemy";
  }

  // Otherwise infer from image path
  const img = (item.image ?? item.imageUrl ?? item.img ?? item.icon ?? "").toString().toLowerCase();
  if (img.includes("/weapons/")) return "weapon";
  if (img.includes("/accessories/")) return "accessory";
  if (img.includes("/monsters/")) return "character"; // toolbox uses monsters/ for many sprites
  return "unknown";
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function detectElement(text) {
  const s = norm(text);
  let found = null;
  let idx = -1;
  for (const el of ELEMENTS) {
    const i = s.indexOf(el);
    if (i !== -1 && (idx === -1 || i < idx)) {
      found = el;
      idx = i;
    }
  }
  return found;
}

function pickStatsHeuristic(nums) {
  // Find a plausible [cost, atk, hp, spd] sequence within a pile of numbers
  const n = nums.map(x => Number(x)).filter(Number.isFinite);
  if (n.length < 4) return { cost: null, atk: null, hp: null, spd: null };

  let best = null;

  for (let i = 0; i <= n.length - 4; i++) {
    const cost = n[i], atk = n[i+1], hp = n[i+2], spd = n[i+3];

    const costOk = cost >= 1 && cost <= 99;
    const atkOk  = atk >= 100 && atk <= 99999;
    const hpOk   = hp >= 100 && hp <= 999999;
    const spdOk  = spd >= 1 && spd <= 99;

    const score = (costOk?2:0) + (atkOk?2:0) + (hpOk?2:0) + (spdOk?2:0);

    if (!best || score > best.score) best = { score, cost: costOk?cost:null, atk: atkOk?atk:null, hp: hpOk?hp:null, spd: spdOk?spd:null };
  }

  // Fallback: last 4 numbers
  if (!best || best.score < 4) {
    const t = n.slice(-4);
    const [cost, atk, hp, spd] = t;
    return {
      cost: cost >= 1 && cost <= 99 ? cost : null,
      atk: atk >= 100 && atk <= 99999 ? atk : null,
      hp: hp >= 100 && hp <= 999999 ? hp : null,
      spd: spd >= 1 && spd <= 99 ? spd : null,
    };
  }

  return { cost: best.cost, atk: best.atk, hp: best.hp, spd: best.spd };
}

function parseMixedRow(text) {
  // Example:
  // "Rizette Cerulean Valkyrie 341,7198,105409Light HP Up ..."
  const s = norm(text);
  if (!s) return null;

  const element = detectElement(s);
  const head = element ? s.split(element)[0] : s;

  // Name is head until first digit
  const m = head.match(/^(.+?)(\d)/);
  const name = m ? norm(m[1]) : s;

  // Pull all digit runs and guess stats
  const nums = head.match(/\d+/g) ?? [];
  const { cost, atk, hp, spd } = pickStatsHeuristic(nums);

  return { name, element, cost, atk, hp, spd };
}

function makeId(item) {
  const id = (item.id ?? item.key ?? "").toString().trim();
  if (id) return id;
  const base = norm(item.name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return base ? base.slice(0, 80) : crypto.randomBytes(6).toString("hex");
}

function pickImage(item) {
  return item.image ?? item.imageUrl ?? item.img ?? item.icon ?? null;
}

function toArrayMaybe(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (Array.isArray(maybe?.items)) return maybe.items;
  if (Array.isArray(maybe?.catalog?.items)) return maybe.catalog.items;
  return [];
}

async function main() {
  // Choose input file
  let inputPath = null;
  try {
    await fs.access(IN_TOOLBOX);
    inputPath = IN_TOOLBOX;
  } catch {
    try {
      await fs.access(IN_FALLBACK);
      inputPath = IN_FALLBACK;
    } catch {
      throw new Error("No input found. Expected data/catalog.toolbox.json or data/catalog.json");
    }
  }

  const raw = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const rawItems = toArrayMaybe(raw);

  if (!rawItems.length) {
    throw new Error(`No items array found in ${inputPath}`);
  }

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedFrom: inputPath,
      inputCount: rawItems.length,
    },
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
    unknown: [],
  };

  const seen = new Set();

  for (const it of rawItems) {
    // The source may incorrectly set id=name or name=id; handle both
    const mixedText = norm(it.name ?? it.id ?? "");
    if (!mixedText || isHeaderRow(mixedText)) continue;

    let name = norm(it.name ?? "");
    let element = it.element ?? null;
    let cost = safeNum(it.cost);
    let atk = safeNum(it.atk);
    let hp  = safeNum(it.hp);
    let spd = safeNum(it.spd);

    // If it looks like the “everything jammed into name” row, parse it
    const looksMixed = name.split(" ").length > 7 && /\d/.test(name);
    if (looksMixed || !element || cost == null || atk == null || hp == null || spd == null) {
      const parsed = parseMixedRow(name || mixedText);
      if (parsed?.name) name = parsed.name;
      if (!element && parsed?.element) element = parsed.element;
      if (cost == null && parsed?.cost != null) cost = parsed.cost;
      if (atk == null && parsed?.atk != null) atk = parsed.atk;
      if (hp  == null && parsed?.hp  != null) hp  = parsed.hp;
      if (spd == null && parsed?.spd != null) spd = parsed.spd;
    }

    name = norm(name);
    if (!name) continue;

    const id = makeId({ ...it, name });
    if (seen.has(id)) continue;
    seen.add(id);

    const category = guessCategory(it);
    const image = pickImage(it);

    const entry = {
      id,
      name,
      category,
      element: element ?? null,
      cost: cost ?? null,
      atk: atk ?? null,
      hp: hp ?? null,
      spd: spd ?? null,
      image: image ?? null,
      url: it.url ?? "https://evertaletoolbox2.runasp.net/Explorer",
    };

    if (category === "character") out.characters.push(entry);
    else if (category === "weapon") out.weapons.push(entry);
    else if (category === "accessory") out.accessories.push(entry);
    else if (category === "enemy") out.enemies.push(entry);
    else if (category === "boss") out.bosses.push(entry);
    else out.unknown.push(entry);
  }

  // Stable ordering
  const byName = (a, b) => a.name.localeCompare(b.name);
  out.characters.sort(byName);
  out.weapons.sort(byName);
  out.accessories.sort(byName);
  out.enemies.sort(byName);
  out.bosses.sort(byName);
  out.unknown.sort(byName);

  out.meta.outputCounts = {
    characters: out.characters.length,
    weapons: out.weapons.length,
    accessories: out.accessories.length,
    enemies: out.enemies.length,
    bosses: out.bosses.length,
    unknown: out.unknown.length,
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`✅ Wrote clean ${OUT_FILE}`);
  console.log(out.meta.outputCounts);
}

main().catch((e) => {
  console.error("❌ build_clean_catalog failed:", e.message);
  process.exit(1);
});