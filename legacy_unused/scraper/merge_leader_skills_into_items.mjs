// scraper/merge_leader_skills_into_items.mjs
// Input:  data/catalog.items.json + data/leaderSkills.toolbox.json
// Output: data/catalog.items.json (updated in-place, also writes data/catalog.items.withleaders.json)

import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const ITEMS = path.join(ROOT, "data", "catalog.items.json");
const LS = path.join(ROOT, "data", "leaderSkills.toolbox.json");
const OUT = path.join(ROOT, "data", "catalog.items.withleaders.json");

function loadItems() {
  const raw = JSON.parse(fs.readFileSync(ITEMS, "utf8"));
  if (Array.isArray(raw)) return { wrapper: null, items: raw };
  if (Array.isArray(raw.items)) return { wrapper: raw, items: raw.items };
  return { wrapper: raw, items: [] };
}

function main() {
  if (!fs.existsSync(ITEMS)) throw new Error(`Missing ${ITEMS}`);
  if (!fs.existsSync(LS)) throw new Error(`Missing ${LS} (run scrape_leader_skills_playwright first)`);

  const { wrapper, items } = loadItems();
  const ls = JSON.parse(fs.readFileSync(LS, "utf8"));
  const map = ls.skills || {};

  let applied = 0;
  for (const it of items) {
    if ((it.category || "").toLowerCase() !== "character") continue;
    const entry = map[it.id];
    if (!entry) continue;
    it.leaderSkill = entry; // {name, description}
    applied++;
  }

  const payload = wrapper ? { ...wrapper, items } : items;

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  fs.writeFileSync(ITEMS, JSON.stringify(payload, null, 2));

  console.log(`[merge_leader_skills] applied=${applied} -> ${ITEMS}`);
  console.log(`[merge_leader_skills] wrote copy -> ${OUT}`);
}

main();