// scraper/build_clean_catalog.mjs
import fs from "fs/promises";

const DATA_DIR = "data";
const OUT_FILE = "data/catalog.clean.json";

const CANDIDATES = [
  "data/catalog.toolbox.json",
  "data/catalog.json",
  "data/catalog.toolbox.full.json",
];

async function safeReadJSON(path) {
  try {
    const txt = await fs.readFile(path, "utf8");
    const json = JSON.parse(txt);
    return json;
  } catch (e) {
    console.warn(`⚠️ Skipping invalid JSON: ${path}`);
    return null;
  }
}

function normCat(v) {
  const x = (v || "").toLowerCase();
  if (["character","unit","units"].includes(x)) return "character";
  if (["weapon","weapons"].includes(x)) return "weapon";
  if (["accessory","accessories"].includes(x)) return "accessory";
  if (["enemy","enemies","monster","monsters"].includes(x)) return "enemy";
  if (["boss","bosses"].includes(x)) return "boss";
  return "unknown";
}

function extractItems(json) {
  if (!json) return null;
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (json.catalog && Array.isArray(json.catalog.items)) return json.catalog.items;
  return null;
}

async function main() {
  console.log("📂 data/ contains:");
  const files = await fs.readdir(DATA_DIR);
  console.log(files.join(", "));

  let sourceFile = null;
  let items = null;

  for (const file of CANDIDATES) {
    try {
      const json = await safeReadJSON(file);
      const extracted = extractItems(json);
      if (extracted && extracted.length > 5) {
        sourceFile = file;
        items = extracted;
        break;
      }
    } catch {}
  }

  if (!items) {
    throw new Error("No valid catalog source found (all inputs invalid or empty)");
  }

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: sourceFile,
    },
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
    unknown: [],
  };

  for (const it of items) {
    const name = (it.name || it.id || "").toString().trim();
    if (!name) continue;

    const entry = {
      id: (it.id || name).toString(),
      name,
      category: normCat(it.category || it.type),
      element: it.element || null,
      image: it.image || it.imageUrl || null,
      url: it.url || null,
    };

    out[entry.category + "s"]?.push(entry) || out.unknown.push(entry);
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2), "utf8");
  console.log(`✅ Wrote clean catalog -> ${OUT_FILE}`);
}

main().catch(err => {
  console.error("❌ build_clean_catalog failed:", err.message);
  process.exit(1);
});