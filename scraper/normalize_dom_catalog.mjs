// scraper/normalize_dom_catalog.mjs
import fs from "fs";

const IN = "data/catalog.dom.raw.json";
const OUT = "data/catalog.toolbox.clean.json";

if (!fs.existsSync(IN)) {
  throw new Error(`Missing input: ${IN}`);
}

const raw = JSON.parse(fs.readFileSync(IN, "utf8"));
const items = Array.isArray(raw.items) ? raw.items : [];

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractStats(text) {
  // Matches things like: 34 1719 8105 409
  const nums = text.match(/\b\d{2,5}\b/g)?.map(Number) ?? [];
  return {
    cost: nums[0] ?? 0,
    atk: nums[1] ?? 0,
    hp: nums[2] ?? 0,
    spd: nums[3] ?? 0,
  };
}

function extractElement(text) {
  const els = ["Light", "Dark", "Fire", "Water", "Earth", "Storm"];
  for (const e of els) {
    if (text.includes(e)) return e;
  }
  return null;
}

const cleaned = [];

for (const row of items) {
  const text = row.text?.trim();
  if (!text) continue;

  // Skip header row
  if (text.toLowerCase().startsWith("name rarity")) continue;

  // Name is text up until first number
  const nameMatch = text.match(/^[^\d]+/);
  if (!nameMatch) continue;

  const name = nameMatch[0].trim();
  if (name.length < 3) continue;

  const stats = extractStats(text);

  // Skip garbage rows
  if (stats.atk === 0 && stats.hp === 0) continue;

  cleaned.push({
    id: slugify(name),
    name,
    category: "character",
    element: extractElement(text),
    cost: stats.cost,
    atk: stats.atk,
    hp: stats.hp,
    spd: stats.spd,
    image: row.image || null,
    source: "viewer-dom",
    rawText: text,
  });
}

// Deduplicate by id
const byId = new Map();
for (const c of cleaned) {
  if (!byId.has(c.id)) byId.set(c.id, c);
}

const finalItems = [...byId.values()];

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      count: finalItems.length,
      items: finalItems,
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Normalized ${finalItems.length} items -> ${OUT}`);
