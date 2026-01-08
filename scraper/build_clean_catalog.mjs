// scraper/build_clean_catalog.mjs
import fs from "fs";
import path from "path";

const DATA_DIR = "data";
const OUT_FILE = path.join(DATA_DIR, "catalog.clean.json");

const SOURCES = [
  "data/catalog.dom.raw.json",
  "data/catalog.toolbox.json",
  "data/catalog.json"
];

function loadFirstValidSource() {
  for (const file of SOURCES) {
    if (!fs.existsSync(file)) continue;

    try {
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(json.items) && json.items.length) {
        console.log("Using catalog source:", file);
        return json.items;
      }
    } catch {
      console.warn("Skipping invalid JSON:", file);
    }
  }
  return null;
}

function cleanItems(raw) {
  const cleaned = [];

  for (const item of raw) {
    const text = (item.text || "").replace(/\s+/g, " ").trim();
    if (!text || text.length < 10) continue;

    cleaned.push({
      id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80),
      name: text.split(" ").slice(0, 4).join(" "),
      rawText: text,
      image: item.image || null,
      category: "unknown"
    });
  }

  return cleaned;
}

function run() {
  if (!fs.existsSync(DATA_DIR)) {
    throw new Error("data/ directory missing");
  }

  const rawItems = loadFirstValidSource();
  if (!rawItems) {
    throw new Error("No valid catalog source found");
  }

  const clean = cleanItems(rawItems);
  if (!clean.length) {
    throw new Error("Clean catalog empty after processing");
  }

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: clean.length,
        items: clean
      },
      null,
      2
    )
  );

  console.log(`Clean catalog written: ${OUT_FILE} (${clean.length} items)`);
}

run();