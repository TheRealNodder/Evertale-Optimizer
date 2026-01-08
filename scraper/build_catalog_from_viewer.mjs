// scraper/build_catalog_from_viewer.mjs
import fs from "fs/promises";
import path from "path";

const VIEWER_FILE = "data/characters.viewer.full.json";
const OUT_FILE = "data/catalog.toolbox.json";

function inferCategory(u) {
  const name = (u.name || "").toLowerCase();
  const text = JSON.stringify(u).toLowerCase();

  if (text.includes("weapon")) return "weapon";
  if (text.includes("accessory")) return "accessory";
  if (text.includes("boss")) return "boss";
  if (text.includes("enemy") || text.includes("monster")) return "enemy";

  return "character";
}

async function run() {
  const viewerRaw = await fs.readFile(VIEWER_FILE, "utf8");
  const viewer = JSON.parse(viewerRaw);

  if (!viewer.characters || viewer.characters.length < 50) {
    throw new Error("Viewer data too small; refusing to build catalog.");
  }

  const items = viewer.characters.map(u => ({
    id: u.id || u.name,
    name: u.name,
    category: inferCategory(u),
    element: u.element || null,
    image: null, // can be filled later if needed
    source: "viewer"
  }));

  await fs.writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        generatedFrom: VIEWER_FILE,
        generatedAt: new Date().toISOString(),
        items
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Built catalog with ${items.length} items`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
