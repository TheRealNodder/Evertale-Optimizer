import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = "https://evertaletoolbox2.runasp.net"; // you can switch back to /runasp.net if needed
const EXPLORER_URL = `${BASE}/Explorer`;

// Where your site reads units from
const OUT_PATH = path.join(__dirname, "..", "data", "units.toolbox.json");

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

/**
 * Explorer page contains a bullet list like:
 *   * [img] RizetteBrave (Rizette)
 *   * [img] ZeusRegular (Zeus)
 * We want the left token (RizetteBrave / ZeusRegular) as the stable ID.
 */
function extractUnitIdsFromExplorer(html) {
  const $ = cheerio.load(html);

  // Try list items first (most robust if HTML has <li>).
  const liTexts = $("li")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const ids = new Set();

  for (const t of liTexts) {
    // Examples:
    // "RizetteBrave (Rizette)"
    // "KongmingRegular (Zhuge Liang)"
    // We take the first token before the first space.
    const m = t.match(/^([A-Za-z0-9_]+)\s+\(/);
    if (m) ids.add(m[1]);
  }

  // Fallback: if list items weren’t found (HTML structure changes),
  // scrape from raw text lines that look like "  * RizetteBrave (Rizette)"
  if (ids.size === 0) {
    const text = $.root().text();
    const lines = text.split("\n").map((l) => l.trim());
    for (const line of lines) {
      const m = line.match(/^\*\s*([A-Za-z0-9_]+)\s+\(/);
      if (m) ids.add(m[1]);
    }
  }

  return [...ids];
}

function buildMinimalUnitRecord(id) {
  // Minimal record so your roster isn’t “3 units only”.
  // You can enrich later if/when you add detail extraction.
  return {
    id,
    name: id, // placeholder until you map display name
    source: "evertaletoolbox_explorer",
  };
}

async function run() {
  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  const html = await fetchText(EXPLORER_URL);

  const ids = extractUnitIdsFromExplorer(html);

  if (!ids.length) {
    throw new Error(
      "No unit IDs found on Explorer. The HTML structure may have changed."
    );
  }

  console.log(`Found ${ids.length} unit IDs (first 25):`);
  console.log(ids.slice(0, 25).join(", "));

  // Write minimal units list (so your site has ALL units immediately).
  // Later you can expand each record with stats/skills if the detail endpoints are discoverable.
  const units = ids.map(buildMinimalUnitRecord);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(units, null, 2), "utf8");

  console.log(`Wrote ${units.length} units -> ${OUT_PATH}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});