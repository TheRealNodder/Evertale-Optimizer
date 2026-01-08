// scraper/build_catalog_from_items.mjs
// Build data/catalog.toolbox.json from data/toolbox.items.json (the WS extractor output)

import fs from "fs/promises";
import path from "path";

const IN_FILE = path.resolve(process.cwd(), "data/toolbox.items.json");
const OUT_FILE = path.resolve(process.cwd(), "data/catalog.toolbox.json");

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function fixCategory(cat) {
  const c = (cat || "").toLowerCase().trim();
  if (!c) return "characters";
  if (c === "character" || c === "characters") return "characters";
  if (c === "weapon" || c === "weapons") return "weapons";
  if (c === "accessory" || c === "accessories") return "accessories";
  if (c === "enemy" || c === "enemies" || c === "monster" || c === "monsters") return "enemies";
  if (c === "boss" || c === "bosses") return "bosses";
  return c;
}

async function run() {
  // Read toolbox.items.json
  let raw;
  try {
    raw = await fs.readFile(IN_FILE, "utf8");
  } catch {
    throw new Error(`Missing ${IN_FILE}. Run the WS extractor scraper first.`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${IN_FILE}`);
  }

  const itemsArr = parsed?.items;
  if (!Array.isArray(itemsArr) || itemsArr.length < 10) {
    throw new Error(
      `toolbox.items.json doesn't contain a usable items[] list (got ${Array.isArray(itemsArr) ? itemsArr.length : "none"}).`
    );
  }

  // Normalize, dedupe, and count
  const dedup = new Map();

  for (const it of itemsArr) {
    const id = norm(it?.id || it?.name);
    const name = norm(it?.name);
    const category = fixCategory(it?.category);
    const image = it?.image ? String(it.image) : null;

    // Skip junk rows like headers
    if (!name) continue;
    if (name.toLowerCase().includes("rarity element cost atk hp spd")) continue;

    const key = `${category}::${name}`;
    if (!dedup.has(key)) {
      dedup.set(key, {
        id: id || name,
        name,
        category,
        image,
        url: "https://evertaletoolbox2.runasp.net/Viewer",
      });
    }
  }

  const cleanItems = Array.from(dedup.values());

  const counts = {};
  for (const it of cleanItems) counts[it.category] = (counts[it.category] || 0) + 1;

  // Write catalog.toolbox.json
  const out = {
    generatedFrom: "data/toolbox.items.json",
    generatedAt: new Date().toISOString(),
    counts,
    items: cleanItems,
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${OUT_FILE} items=${cleanItems.length}`);
}

run().catch((err) => {
  console.error(err);
  // Fail the job if we can't build catalog from items
  process.exit(1);
});
