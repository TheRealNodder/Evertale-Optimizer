const SOURCES = [
  "data/catalog.dom.raw.json",
  "data/catalog.toolbox.json",
  "data/catalog.json"
];

let rawItems = null;

for (const file of SOURCES) {
  if (!fs.existsSync(file)) continue;
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    if (Array.isArray(json.items)) {
      rawItems = json.items;
      console.log("Using catalog source:", file);
      break;
    }
  } catch {
    console.warn("Skipping invalid JSON:", file);
  }
}

if (!rawItems) {
  throw new Error("No valid catalog source found");
}