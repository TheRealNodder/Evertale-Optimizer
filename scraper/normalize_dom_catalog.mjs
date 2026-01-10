import fs from "fs";

const IN = "data/catalog.dom.raw.json";
const OUT = "data/catalog.json";

const raw = JSON.parse(fs.readFileSync(IN, "utf8"));

const clean = {
  characters: [],
  weapons: [],
  accessories: [],
  enemies: [],
  bosses: []
};

for (const r of raw) {
  if (!r.name || r.name.startsWith("Name")) continue;

  const item = {
    id: r.name.toLowerCase().replace(/\s+/g, "-"),
    name: r.name,
    element: r.element,
    atk: Number(r.atk) || null,
    hp: Number(r.hp) || null,
    spd: Number(r.spd) || null,
    cost: Number(r.cost) || null,
    image: r.image
  };

  if (r.rarity?.includes("SSR") || r.cost) {
    clean.characters.push(item);
  } else {
    clean.weapons.push(item);
  }
}

fs.writeFileSync(OUT, JSON.stringify(clean, null, 2));
console.log("Catalog built");