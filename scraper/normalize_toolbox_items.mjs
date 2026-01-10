// scraper/normalize_toolbox_items.mjs
// Normalizes data/toolbox.items.json into a stable, clean catalog file.
// IMPORTANT: This script must NEVER fail the workflow just because Toolbox returned nothing.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");

// Inputs
const IN_ITEMS = path.join(DATA_DIR, "toolbox.items.json");

// Outputs (adjust these names ONLY if your app/workflow expects different ones)
const OUT_NORMALIZED_ITEMS = path.join(DATA_DIR, "toolbox.items.normalized.json");
const OUT_CATALOG = path.join(DATA_DIR, "catalog.toolbox.json");

// Minimum viable size to consider “real data”
const MIN_ITEMS = 50;

function safeJsonParse(text, label) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: `${label} invalid JSON: ${e.message}` };
  }
}

function readItemsArray(raw) {
  // Supports:
  //  - []                                  (array)
  //  - { items: [] }                       (common)
  //  - { items: { items: [] } }            (nested)
  //  - { data: [] } / { result: [] }       (fallback)
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.items?.items)) return raw.items.items;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.result)) return raw.result;
  return [];
}

function normStr(v) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

function normCat(v) {
  const s = (v ?? "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(s)) return "character";
  if (["weapon", "weapons"].includes(s)) return "weapon";
  if (["accessory", "accessories"].includes(s)) return "accessory";
  if (["enemy", "enemies", "monster", "monsters"].includes(s)) return "enemy";
  if (["boss", "bosses"].includes(s)) return "boss";
  return s || "unknown";
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function makeId(it) {
  // Try common id fields, else fallback to a slug of name+image
  const id =
    normStr(it?.id) ??
    normStr(it?.key) ??
    normStr(it?.unitId) ??
    normStr(it?.weaponId) ??
    normStr(it?.accessoryId);

  if (id) return id.toString();

  const name = (it?.name ?? it?.title ?? it?.displayName ?? "").toString().trim();
  const img = (it?.image ?? it?.imageUrl ?? it?.img ?? it?.icon ?? "").toString().trim();
  const base = `${name} ${img}`.trim().toLowerCase();

  if (!base) return null;

  return base
    .replace(/https?:\/\/[^ ]+/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeOne(it) {
  const name = normStr(it?.name ?? it?.title ?? it?.displayName);
  const category = normCat(it?.category ?? it?.type ?? it?.kind);
  const element = normStr(it?.element ?? it?.elem);

  const image =
    normStr(it?.image) ??
    normStr(it?.imageUrl) ??
    normStr(it?.img) ??
    normStr(it?.icon) ??
    null;

  const url = normStr(it?.url ?? it?.href ?? it?.link);

  // Stats (often not present in Toolbox items; keep nullable)
  const cost = safeNum(it?.cost ?? it?.c);
  const atk = safeNum(it?.atk ?? it?.attack ?? it?.stats?.atk);
  const hp = safeNum(it?.hp ?? it?.health ?? it?.stats?.hp);
  const spd = safeNum(it?.spd ?? it?.speed ?? it?.stats?.spd);

  const id = makeId({ ...it, name, image });

  if (!id || !name) return null;

  return {
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
  };
}

function summarizeCounts(items) {
  const counts = {
    total: items.length,
    characters: 0,
    weapons: 0,
    accessories: 0,
    enemies: 0,
    bosses: 0,
    unknown: 0,
  };
  for (const x of items) {
    if (x.category === "character") counts.characters++;
    else if (x.category === "weapon") counts.weapons++;
    else if (x.category === "accessory") counts.accessories++;
    else if (x.category === "enemy") counts.enemies++;
    else if (x.category === "boss") counts.bosses++;
    else counts.unknown++;
  }
  return counts;
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(IN_ITEMS)) {
    console.warn(`[normalize_toolbox_items] Missing ${IN_ITEMS}. Skipping (keeping existing outputs).`);
    process.exit(0);
  }

  const text = fs.readFileSync(IN_ITEMS, "utf8").trim();
  if (!text) {
    console.warn(`[normalize_toolbox_items] ${IN_ITEMS} is empty. Skipping (keeping existing outputs).`);
    process.exit(0);
  }

  const parsed = safeJsonParse(text, "toolbox.items.json");
  if (!parsed.ok) {
    console.warn(`[normalize_toolbox_items] ${parsed.error}. Skipping (keeping existing outputs).`);
    process.exit(0);
  }

  const arr = readItemsArray(parsed.value);
  console.log(`[normalize_toolbox_items] items loaded: ${arr.length}`);

  // IMPORTANT: do NOT fail if Toolbox returned nothing.
  if (arr.length < MIN_ITEMS) {
    console.warn(
      `[normalize_toolbox_items] toolbox.items.json too small (${arr.length} < ${MIN_ITEMS}). ` +
        `Skipping normalize and leaving existing outputs unchanged.`
    );
    process.exit(0);
  }

  // Normalize + de-dupe by id
  const byId = new Map();
  for (const it of arr) {
    const n = normalizeOne(it);
    if (!n) continue;
    if (!byId.has(n.id)) byId.set(n.id, n);
  }

  const normalized = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  const counts = summarizeCounts(normalized);

  // Write normalized items (debuggable)
  writeJson(OUT_NORMALIZED_ITEMS, {
    generatedAt: new Date().toISOString(),
    source: "data/toolbox.items.json",
    counts,
    items: normalized,
  });

  // Write catalog file that your website can load
  writeJson(OUT_CATALOG, {
    generatedAt: new Date().toISOString(),
    source: "data/toolbox.items.json",
    counts,
    items: normalized,
  });

  console.log(`[normalize_toolbox_items] wrote: ${path.relative(ROOT, OUT_NORMALIZED_ITEMS)}`);
  console.log(`[normalize_toolbox_items] wrote: ${path.relative(ROOT, OUT_CATALOG)}`);
  console.log(`[normalize_toolbox_items] counts: ${JSON.stringify(counts)}`);
}

main();