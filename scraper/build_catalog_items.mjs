import fs from "fs";

const load = f => JSON.parse(fs.readFileSync(f, "utf8"));

const chars = load("data/characters.with_leader_skills.json");
const weapons = load("data/weapons.json");
const acc = load("data/accessories.json");
const bosses = load("data/bosses.json");

const catalog = [];

function pushAll(arr, category) {
  arr.forEach(x => {
    catalog.push({
      id: x.id || x.name,
      name: x.name,
      category,
      element: x.element || null,
      cost: x.cost || null,
      atk: x.atk || null,
      hp: x.hp || null,
      spd: x.spd || null,
      image: x.image || null,
      leaderSkill: x.leaderSkill || null
    });
  });
}

pushAll(chars, "character");
pushAll(weapons, "weapon");
pushAll(acc, "accessory");
pushAll(bosses, "boss");

fs.writeFileSync("data/catalog.items.json", JSON.stringify(catalog, null, 2));
console.log(`✔ Catalog items written: ${catalog.length}`);