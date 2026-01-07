// scraper/scrape_toolbox_catalog.mjs
// Builds a categorized catalog from Toolbox Explorer, including image URLs.
// Outputs: ../data/catalog.toolbox.json

import fs from "node:fs/promises";
import path from "node:path";
import cheerio from "cheerio";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;
const OUT_PATH = path.join(process.cwd(), "..", "data", "catalog.toolbox.json");

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

function absUrl(u) {
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${BASE}${u}`;
  return `${BASE}/${u}`;
}

function norm(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function pickSectionKey(headingText) {
  const t = norm(headingText).toLowerCase();

  if (t === "character" || t === "characters") return "characters";
  if (t === "weapon" || t === "weapons") return "weapons";
  if (t === "accessory" || t === "accessories") return "accessories";
  if (t === "enemy" || t === "enemies") return "enemies";
  if (t === "boss" || t === "bosses") return "bosses";

  return null;
}

function parseLiItem($, li) {
  const text = norm($(li).text());
  // common format: "RizetteBrave (Rizette)"
  const idMatch = text.match(/^([A-Za-z0-9_]+)\s*\(/);
  const id = idMatch ? idMatch[1] : null;

  // try to pull display name inside parentheses
  const nameMatch = text.match(/^\S+\s*\((.+)\)\s*$/);
  const displayName = nameMatch ? nameMatch[1] : null;

  const img = $(li).find("img").first();
  const imgSrc = img.attr("src");
  const imageUrl = absUrl(imgSrc);

  return {
    id,
    name: displayName ?? id ?? text,
    imageUrl,
  };
}

function extractCatalog(html) {
  const $ = cheerio.load(html);

  const catalog = {
    characters: [],
    weapons: [],
    accessories: [],
    enemies: [],
    bosses: [],
  };

  // We walk through headings and collect subsequent <li> until next heading.
  let current = null;

  // A broad selector for likely heading elements
  const nodes = $("body")
    .find("h1,h2,h3,h4,h5,strong,b,li")
    .toArray();

  for (const el of nodes) {
    const tag = (el.tagName || "").toLowerCase();

    if (tag !== "li") {
      const key = pickSectionKey($(el).text());
      if (key) current = key;
      continue;
    }

    // li
    if (!current) continue;

    const item = parseLiItem($, el);
    if (!item.id) continue;

    catalog[current].push(item);
  }

  // De-dupe per category
  for (const k of Object.keys(catalog)) {
    const map = new Map();
    for (const it of catalog[k]) {
      if (!map.has(it.id)) map.set(it.id, it);
    }
    catalog[k] = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  return catalog;
}

async function run() {
  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  const html = await fetchText(EXPLORER_URL);

  const catalog = extractCatalog(html);

  const total =
    catalog.characters.length +
    catalog.weapons.length +
    catalog.accessories.length +
    catalog.enemies.length +
    catalog.bosses.length;

  if (!total) {
    throw new Error(
      "No items extracted. Explorer HTML structure may have changed (headings/li not found)."
    );
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });

  const payload = {
    updatedAt: new Date().toISOString(),
    source: EXPLORER_URL,
    catalog,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    `Wrote catalog.toolbox.json: ` +
      `characters=${catalog.characters.length}, ` +
      `weapons=${catalog.weapons.length}, ` +
      `accessories=${catalog.accessories.length}, ` +
      `enemies=${catalog.enemies.length}, ` +
      `bosses=${catalog.bosses.length}`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
