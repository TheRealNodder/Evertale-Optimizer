import fs from "fs";
import fetch from "node-fetch";
import cheerio from "cheerio";

const raw = fs.readFileSync("unit_links.json");
const unitLinks = JSON.parse(raw);

function normalizeRarity(text) {
  if (!text) return null;
  if (text.includes("SSR")) return 5;
  if (text.includes("SR")) return 4;
  if (text.includes("R")) return 3;
  return 2;
}

async function fetchUnit(link) {
  try {
    const res = await fetch(link.url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const infobox = $(".portable-infobox");
    const getInfo = (label) =>
      infobox.find(`h3:contains("${label}")`).next().text().trim();

    return {
      id: link.name.toLowerCase().replace(/\s+/g, "_"),
      name: link.name,
      element: getInfo("Element"),
      rarity: normalizeRarity(getInfo("Rarity")),
      stats: {
        hp: Number(getInfo("HP")) || 0,
        atk: Number(getInfo("Attack")) || 0,
        spd: Number(getInfo("Speed")) || 0
      },
      weapons: getInfo("Weapon").split(",").map(w => w.trim()),
      leaderSkill: getInfo("Leader Skill") || null
    };
  } catch (err) {
    console.error("Failed:", link.name);
    return null;
  }
}

async function main() {
  const results = [];
  for (const link of unitLinks) {
    const unit = await fetchUnit(link);
    if (unit) results.push(unit);
  }
  fs.writeFileSync("units.json", JSON.stringify(results, null, 2));
  console.log(`Saved ${results.length} units.`);
}

main();
