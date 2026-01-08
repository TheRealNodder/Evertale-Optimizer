// scraper/build_clean_catalog.mjs
// Smart cleaner:
// - If input is already CLEAN (has characters/weapons/etc), pass through
// - If input is MESSY (has items[]), clean it
// - Never fail just because items[] is missing

import fs from "fs/promises";
import crypto from "crypto";

const OUT_FILE = "data/catalog.json";

// Priority: toolbox → existing catalog
const INPUTS = [
  "data/catalog.toolbox.json",
  "data/catalog.json",
];

const ELEMENTS = ["Fire", "Water", "Storm", "Earth", "Light", "Dark"];

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function makeId(name) {
  return (
    norm(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) ||
    crypto.randomBytes(6).toString("hex")
  );
}

function detectElement(text) {
  const s = norm(text);
  for (const el of ELEMENTS) {
    if (s.includes(el)) return el;
  }
  return null;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function guessCategory(item) {
  const c = (item.category ?? item.type ?? "").toLowerCase();
  if (c.includes("char")) return "character";
  if (c.includes("weapon")) return "weapon";
  if (c.includes("access")) return "accessory";
  if (c.includes("boss")) return "boss";
  if (c.includes("enemy") || c.includes("monster")) return "enemy";

  const img = (item.image ?? item.imageUrl ?? "").toLowerCase();
  if (img.includes("/weapons/")) return "weapon";
  if (img.includes("/accessories/")) return "accessory";
  if (img.includes("/monsters/")) return "character";

  return "unknown";
}

function parseMixedRow(text) {
  const s = norm(text);
  if (!s) return null;

  const element = detectElement(s);
  const head = element ? s.split(element)[0] : s;

  const nameMatch = head.match(/^(.+?)(\d)/);
  const name = nameMatch ? norm(nameMatch[1]) : s;

  const nums = s.match(/\d+/g)?.map(Number) ?? [];

  return {
    name,
    element,
    cost: nums[0] ?? null,
    atk: nums[1] ?? null,
    hp: nums[2] ?? null,
    spd: nums[3] ?? null,
  };
}

function isAlreadyClean(json) {
  return (
    json &&
    typeof json === "object" &&
    Array.isArray(json.characters)
  );
}

async function main() {
  let inputPath = null;
  let raw = null;

  for (const p of INPUTS) {
    try {
      raw = JSON.parse(await fs.readFile(p, "utf8"));
      inputPath = p;
      break;
    } catch {}
  }

  if (!raw) {
    throw new Error("No input catalog found.");
  }

  // -----------------------------
  // CASE 1: ALREADY CLEAN → PASS
  // -----------------------------
  if (isAlreadyClean(raw)) {
    console.log("ℹ️ Catalog already clean — passing through");
    await fs.writeFile(
      OUT_FILE,
      JSON.stringify(raw, null, 2),
      "utf8"
    );
    return;
  }

  // -----------------------------
  // CASE 2: MESSY → CLEAN IT
  // -----------------------------
  const items =
    raw.items ??
    raw.catalog?.items ??
    [];

  if (!Array.isArray(items) || !items.length) {
    throw new Error(`No items array found in ${inputPath}`);
  }

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedFrom: inputPath,
    },
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
    unknown: [],
  };

  const seen = new Set();

  for (const it of items) {
    let name = norm(it.name ?? it.id ?? "");
    if (!name) continue;

    let element = it.element ?? null;
    let cost = safeNum(it.cost);
    let atk = safeNum(it.atk);
    let hp = safeNum(it.hp);
    let spd = safeNum(it.spd);

    if (name.split(" ").length > 6 && /\d/.test(name)) {
      const p = parseMixedRow(name);
      if (p) {
        name = p.name ?? name;
        element ??= p.element;
        cost ??= p.cost;
        atk ??= p.atk;
        hp ??= p.hp;
        spd ??= p.spd;
      }
    }

    const id = makeId(name);
    if (seen.has(id)) continue;
    seen.add(id);

    const category = guessCategory(it);

    const entry = {
      id,
      name,
      category,
      element,
      cost,
      atk,
      hp,
      spd,
      image: it.image ?? it.imageUrl ?? null,
      url: it.url ?? "https://evertaletoolbox2.runasp.net/Explorer",
    };

    out[`${category}s`]?.push(entry) ?? out.unknown.push(entry);
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log("✅ Clean catalog built:", OUT_FILE);
}

main().catch((err) => {
  console.error("❌ build_clean_catalog failed:", err.message);
  process.exit(1);
});