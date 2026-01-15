import fs from "fs";

const items = JSON.parse(fs.readFileSync("data/catalog.items.json", "utf8"));

const summary = items.map(i => ({
  id: i.id,
  name: i.name,
  category: i.category,
  element: i.element,
  image: i.image
}));

fs.writeFileSync("data/catalog.summary.json", JSON.stringify(summary, null, 2));
console.log("✔ Catalog summary generated");