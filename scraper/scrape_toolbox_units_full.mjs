// scraper/scrape_toolbox_units_full.mjs
// Toolbox-only: parse Explorer HTML into categorized ID lists.

import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;

const OUT_DIR = path.join(process.cwd(), "data");
const OUT_CHAR = path.join(OUT_DIR, "characters.toolbox.json");
const OUT_WEAP = path.join(OUT_DIR, "weapons.toolbox.json");
const OUT_ENEM = path.join(OUT_DIR, "enemies.toolbox.json");
const OUT_ACC  = path.join(OUT_DIR, "accessories.toolbox.json");

function normSpace(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function pickCategoryFromText(text) {
  const t = text.toLowerCase();
  if (t.includes("character")) return "characters";
  if (t.includes("weapon")) return "weapons";
  if (t.includes("enemy")) return "enemies";
  if (t.includes("accessor")) return "accessories";
  return null;
}

function extractIdFromHref(href) {
  // Common patterns on toolbox: /Viewer?id=XXX or /Viewer/XXX etc.
  if (!href) return null;
  try {
    const u = new URL(href, BASE);
    const idQ = u.searchParams.get("id") || u.searchParams.get("Id");
    if (idQ) return idQ;

    const parts = u.pathname.split("/").filter(Boolean);
    // last path segment often is ID
    if (parts.length) {
      const last = parts[parts.length - 1];
      if (last && !last.toLowerCase().includes("viewer") && !last.toLowerCase().includes("explorer")) {
        return last;
      }
    }
  } catch {
    // If href is relative without leading slash
    if (href.includes("id=")) {
      const m = href.match(/[?&]id=([^&]+)/i);
      if (m) return m[1];
    }
    const parts = href.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && !last.includes("?")) return last;
  }
  return null;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; Evertale-Optimizer/1.0; +https://github.com/)",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function extractByHeadings($) {
  // Strategy:
  // - Walk headings (h1/h2/h3/h4)
  // - For each heading that looks like a category, scan until next heading for links
  // - Collect items from <a> tags with IDs
  const sections = {
    characters: [],
    weapons: [],
    enemies: [],
    accessories: [],
  };

  const headings = $("h1,h2,h3,h4").toArray();
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const title = normSpace($(h).text());
    const cat = pickCategoryFromText(title);
    if (!cat) continue;

    // Scan siblings until next heading
    let node = h.nextSibling;
    const collected = [];
    while (node) {
      const $node = $(node);
      if ($node.is("h1,h2,h3,h4")) break;

      $node.find("a[href]").each((_, a) => {
        const href = $(a).attr("href");
        const id = extractIdFromHref(href);
        const name = normSpace($(a).text());
        if (!id) return;
        collected.push({ id, name: name || id, href });
      });

      node = node.nextSibling;
    }

    // Dedup
    const seen = new Set(sections[cat].map(x => x.id));
    for (const it of collected) {
      if (!seen.has(it.id)) {
        sections[cat].push(it);
        seen.add(it.id);
      }
    }
  }

  return sections;
}

function extractByLinkHeuristics($) {
  // Fallback if headings parsing fails:
  // scrape ALL links and bucket by text around them
  const all = $("a[href]").toArray().map(a => {
    const href = $(a).attr("href");
    const id = extractIdFromHref(href);
    const name = normSpace($(a).text());
    return { href, id, name: name || id || "" };
  }).filter(x => x.id);

  // If Explorer uses obvious prefixes in href, try that:
  const sections = { characters: [], weapons: [], enemies: [], accessories: [] };

  for (const it of all) {
    const hrefL = (it.href || "").toLowerCase();
    const nameL = (it.name || "").toLowerCase();

    let cat = null;
    if (hrefL.includes("weapon") || nameL.includes("weapon")) cat = "weapons";
    else if (hrefL.includes("enemy") || nameL.includes("enemy")) cat = "enemies";
    else if (hrefL.includes("accessor") || nameL.includes("accessor")) cat = "accessories";
    else cat = "characters";

    sections[cat].push({ id: it.id, name: it.name, href: it.href });
  }

  // Dedup each
  for (const k of Object.keys(sections)) {
    const seen = new Set();
    sections[k] = sections[k].filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  }

  return sections;
}

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  const html = await fetchText(EXPLORER_URL);

  const $ = cheerio.load(html);

  let sections = extractByHeadings($);

  const totalA =
    sections.characters.length +
    sections.weapons.length +
    sections.enemies.length +
    sections.accessories.length;

  if (totalA < 50) {
    console.warn(`[scrape_toolbox_units_full] heading-scan found only ${totalA} items, using heuristic fallback`);
    sections = extractByLinkHeuristics($);
  }

  // Write outputs
  await fs.writeFile(OUT_CHAR, JSON.stringify(sections.characters, null, 2), "utf8");
  await fs.writeFile(OUT_WEAP, JSON.stringify(sections.weapons, null, 2), "utf8");
  await fs.writeFile(OUT_ENEM, JSON.stringify(sections.enemies, null, 2), "utf8");
  await fs.writeFile(OUT_ACC,  JSON.stringify(sections.accessories, null, 2), "utf8");

  console.log(`[scrape_toolbox_units_full] wrote:
  characters:   ${sections.characters.length} -> ${OUT_CHAR}
  weapons:      ${sections.weapons.length} -> ${OUT_WEAP}
  enemies:      ${sections.enemies.length} -> ${OUT_ENEM}
  accessories:  ${sections.accessories.length} -> ${OUT_ACC}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});