// scraper/build_catalog_from_viewer.mjs
// Builds data/catalog.toolbox.json from data/characters.viewer.full.json
// This replaces Explorer scraping.

import fs from "fs/promises";
import path from "path";

const IN_FILE = path.resolve(process.cwd(), "data/characters.viewer.full.json");
const OUT_FILE = path.resolve(process.cwd(), "data/catalog.toolbox.json");

function normText(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

// Heuristic category inference (you can improve later once we have explicit type fields)
function inferCategory(u) {
  const name = normText(u.name).toLowerCase();
  const element = normText(u.element).toLowerCase();

  // If later you add a `type` field into Viewer scraper, prefer it:
  if (u.type) return u.type;

  // Toolbox viewer list we scraped is primarily characters; so default to character.
  // Keep hooks for future expansion.
  if (name.includes("weapon")) return "weapon";
  if (name.includes("accessory")) return "accessory";
  if (name.includes("boss")) return "boss";
  if (name.includes("enemy") || name.includes("monster")) return "enemy";

  // If element exists, it's almost certainly a character
  if (element) return "character";

  return "character";
}

async function run() {
  const raw = await fs.readFile(IN_FILE, "utf8");
  const viewer = JSON.parse(raw);

  const list = viewer.characters || [];
  if (list.length < 50) {
    throw new Error(`Viewer input too small (${list.length}). Refusing to build catalog.`);
  }

  const items = list.map(u => ({
    id: u.id || u.name,
    name: u.name,
    category: inferCategory(u),
    element: u.element || null,
    image: null,  // images can be mapped later once we discover stable image URLs
    url: u.url || null
  }));

  await fs.writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        generatedFrom: "data/characters.viewer.full.json",
        generatedAt: new Date().toISOString(),
        items
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Built catalog with ${items.length} items -> ${OUT_FILE}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});