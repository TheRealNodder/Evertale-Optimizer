// scraper/scrape_toolbox_units_full.mjs
// Pulls ALL unit IDs from Toolbox Explorer (no paging, no JS rendering).
// Writes: ../data/units.toolbox.json

import fs from "node:fs/promises";
import path from "node:path";
import cheerio from "cheerio";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;

const OUT_PATH = path.join(process.cwd(), "..", "data", "units.toolbox.json");

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "text/html,application/xhtml+xml"
    }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

/**
 * Explorer contains list items like:
 *   RizetteBrave (Rizette)
 * We want the stable internal key: RizetteBrave
 */
function extractUnitIdsFromExplorer(html) {
  const $ = cheerio.load(html);
  const ids = new Set();

  // Primary: parse <li> elements
  const liTexts = $("li")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  for (const t of liTexts) {
    const m = t.match(/^([A-Za-z0-9_]+)\s*\(/);
    if (m) ids.add(m[1]);
  }

  // Fallback: parse raw text if <li> structure changes
  if (ids.size === 0) {
    const text = $.root().text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Handles lines like: "* RizetteBrave (Rizette)"
      let m = line.match(/^\*\s*([A-Za-z0-9_]+)\s*\(/);
      if (m) ids.add(m[1]);

      // Handles lines like: "RizetteBrave (Rizette)"
      m = line.match(/^([A-Za-z0-9_]+)\s*\(/);
      if (m) ids.add(m[1]);
    }
  }

  return [...ids];
}

function buildMinimalUnitRecord(id) {
  // Minimal schema that won't break your app load.
  // Later we can enrich with stats/skills once we discover the JSON/API endpoints.
  return {
    id,
    name: id,
    title: "",
    element: null,
    rarity: null,
    cost: null,
    stats: { atk: null, hp: null, spd: null },
    leaderSkillName: null,
    leaderSkillText: null,
    activeSkills: [],
    passiveSkills: [],
    source: { explorer: EXPLORER_URL }
  };
}

async function run() {
  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  const html = await fetchText(EXPLORER_URL);

  const ids = extractUnitIdsFromExplorer(html);

  if (!ids.length) {
    throw new Error("No unit IDs found in Explorer HTML. The site structure may have changed.");
  }

  ids.sort((a, b) => a.localeCompare(b));

  console.log(`Found ${ids.length} unit IDs.`);
  console.log(`First 25: ${ids.slice(0, 25).join(", ")}`);

  const units = ids.map(buildMinimalUnitRecord);

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(
    OUT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${units.length} units -> ${OUT_PATH}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});