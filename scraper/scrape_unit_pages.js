import fs from "fs";
import * as cheerio from "cheerio";

const links = JSON.parse(fs.readFileSync("unit_links.json"));

const sleep = ms => new Promise(r => setTimeout(r, ms));

function normalizeRarity(text = "") {
  if (text.includes("SSR")) return 5;
  if (text.includes("SR")) return 4;
  if (text.includes("R")) return 3;
  return 2;
}

async function scrapeUnit(unit) {
  const res = await fetch(unit.url);
  if (!res.ok) throw new Error(`Fetch failed: ${unit.name}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const box = $(".portable-infobox");

  const get = label =>
    box.find(`h3:contains("${label}")`).next().text().trim();

  return {
    id: unit.name.toLowerCase().replace(/\s+/g, "_"),
    name: unit.name,
    element: get("Element") || null,
    rarity: normalizeRarity(get("Rarity")),
    stats: {
      hp: Number(get("HP")) || 0,
      atk: Number(get("Attack")) || 0,
      spd: Number(get("Speed")) || 0
    },
    weapons: get("Weapon")
      ? get("Weapon").split(",").map(w => w.trim())
      : [],
    leaderSkill: get("Leader Skill") || null
  };
}

async function run() {
  const results = [];

  for (const unit of links) {
    try {
      console.log(`Scraping ${unit.name}`);
      results.push(await scrapeUnit(unit));
      await sleep(800);
    } catch {
      console.warn(`Skipped ${unit.name}`);
    }
  }

  fs.writeFileSync("units.json", JSON.stringify(results, null, 2));
  console.log(`✔ Saved ${results.length} units`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
