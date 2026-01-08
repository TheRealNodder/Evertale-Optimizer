// scraper/build_catalog_from_viewer.mjs
// Builds data/catalog.toolbox.json from data/viewer.toolbox.full.json

import fs from "fs/promises";
import path from "path";

const IN_FILE = path.resolve(process.cwd(), "data/viewer.toolbox.full.json");
const OUT_FILE = path.resolve(process.cwd(), "data/catalog.toolbox.json");

function normText(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

async function run() {
  const raw = await fs.readFile(IN_FILE, "utf8");
  const viewer = JSON.parse(raw);

  const byType = viewer.byType || {};
  const types = Object.keys(byType);
  const total = types.reduce((a, t) => a + (byType[t]?.length || 0), 0);

  if (total < 50) {
    throw new Error(`Viewer input too small total=${total}. Refusing to build catalog.`);
  }

  const items = [];
  for (const t of types) {
    for (const u of (byType[t] || [])) {
      items.push({
        id: u.id || u.name,
        name: u.name,
        category: t,              // <-- THIS is the separation you want
        element: u.element || null,
        image: null,
        url: u.url || null,
      });
    }
  }

  await fs.writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        generatedFrom: "data/viewer.toolbox.full.json",
        generatedAt: new Date().toISOString(),
        counts: Object.fromEntries(types.map(t => [t, (byType[t] || []).length])),
        items
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Built catalog items=${items.length} -> ${OUT_FILE}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});