// scraper/scrape_toolbox_catalog.mjs
// Playwright-rendered scrape of /Explorer into categorized catalog + image URLs.
// Output: ../data/catalog.toolbox.json

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "https://evertaletoolbox2.runasp.net";
const EXPLORER_URL = `${BASE}/Explorer`;
const OUT_PATH = path.join(process.cwd(), "..", "data", "catalog.toolbox.json");

function norm(s) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function wrapPayload(catalog) {
  return {
    updatedAt: new Date().toISOString(),
    source: EXPLORER_URL,
    catalog
  };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log(`Opening Explorer: ${EXPLORER_URL}`);
  await page.goto(EXPLORER_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Let Blazor render the lists
  await page.waitForTimeout(2000);

  // Extract data from the LIVE DOM
  const catalog = await page.evaluate(() => {
    const SECTION_KEYS = new Map([
      ["character", "characters"],
      ["characters", "characters"],
      ["weapon", "weapons"],
      ["weapons", "weapons"],
      ["accessory", "accessories"],
      ["accessories", "accessories"],
      ["enemy", "enemies"],
      ["enemies", "enemies"],
      ["boss", "bosses"],
      ["bosses", "bosses"]
    ]);

    const out = {
      characters: [],
      weapons: [],
      accessories: [],
      enemies: [],
      bosses: []
    };

    const seen = {
      characters: new Set(),
      weapons: new Set(),
      accessories: new Set(),
      enemies: new Set(),
      bosses: new Set()
    };

    function normalizeText(s) {
      return String(s || "").replace(/\s+/g, " ").trim();
    }

    function extractIdName(text) {
      // Expected: "RizetteBrave (Rizette)"
      const t = normalizeText(text);
      const idMatch = t.match(/^([A-Za-z0-9_]+)\s*\(/);
      const id = idMatch ? idMatch[1] : null;

      const nameMatch = t.match(/^\S+\s*\((.+)\)\s*$/);
      const name = nameMatch ? nameMatch[1] : (id || t);

      return { id, name };
    }

    // Walk DOM in order. Any element whose text is exactly a section label flips "current".
    // Any <li> after that gets added to current section until the next section label appears.
    let current = null;

    const nodes = Array.from(document.body.querySelectorAll("*"));

    for (const el of nodes) {
      const tag = el.tagName;

      // Section headers can be in lots of tags on Blazor pages, so check many.
      if (["H1","H2","H3","H4","H5","DIV","SPAN","P","STRONG","B","A","LABEL"].includes(tag)) {
        const label = normalizeText(el.textContent).toLowerCase();
        if (SECTION_KEYS.has(label)) {
          current = SECTION_KEYS.get(label);
        }
      }

      if (tag === "LI" && current) {
        const text = normalizeText(el.textContent);
        const { id, name } = extractIdName(text);
        if (!id) continue;

        const img = el.querySelector("img");
        const imageUrl = img ? img.src : null;

        if (!seen[current].has(id)) {
          seen[current].add(id);
          out[current].push({ id, name, imageUrl });
        }
      }
    }

    // Sort each bucket
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
    }

    return out;
  });

  const total =
    catalog.characters.length +
    catalog.weapons.length +
    catalog.accessories.length +
    catalog.enemies.length +
    catalog.bosses.length;

  if (!total) {
    // Helpful debug: save the rendered HTML so you can inspect it in the repo
    const html = await page.content();
    const dbgPath = path.join(process.cwd(), "..", "data", "_debug_explorer_rendered.html");
    await fs.mkdir(path.dirname(dbgPath), { recursive: true });
    await fs.writeFile(dbgPath, html, "utf8");

    await browser.close();
    throw new Error(
      "No items extracted from rendered Explorer DOM. " +
      "Saved data/_debug_explorer_rendered.html for inspection."
    );
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, JSON.stringify(wrapPayload(catalog), null, 2), "utf8");

  console.log(
    `Wrote catalog.toolbox.json: characters=${catalog.characters.length}, ` +
    `weapons=${catalog.weapons.length}, accessories=${catalog.accessories.length}, ` +
    `enemies=${catalog.enemies.length}, bosses=${catalog.bosses.length}`
  );

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});