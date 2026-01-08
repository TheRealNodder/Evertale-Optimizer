// scraper/scrape_toolbox_catalog.mjs
import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";

const EXPLORER_URL = "https://evertaletoolbox2.runasp.net/Explorer";

function absUrl(base, maybe) {
  try { return new URL(maybe, base).toString(); } catch { return null; }
}
function normText(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}
function inferCategory(sectionTitle, name, href) {
  const t = `${sectionTitle} ${name} ${href}`.toLowerCase();
  if (t.includes("accessor")) return "accessory";
  if (t.includes("weapon")) return "weapon";
  if (t.includes("boss")) return "boss";
  if (t.includes("enemy") || t.includes("enemies") || t.includes("monster")) return "enemy";
  if (t.includes("character") || t.includes("unit") || t.includes("hero")) return "character";
  return "character";
}
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
async function writeJson(filepath, obj) {
  await fs.writeFile(filepath, JSON.stringify(obj, null, 2), "utf8");
}

async function run() {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  page.setDefaultTimeout(90000);

  console.log(`Fetching Explorer: ${EXPLORER_URL}`);

  // Blazor Server sometimes behaves better with "load" than "domcontentloaded"
  await page.goto(EXPLORER_URL, { waitUntil: "load", timeout: 90000 });

  // Give SignalR/Blazor time to hydrate
  await page.waitForTimeout(6000);

  // Try multiple strategies: table, list, many links, or specific route links.
  // We avoid relying on "Viewer" text only.
  const READY_TIMEOUT = 90000;

  try {
    await page.waitForFunction(() => {
      // Any big-ish table?
      const table = document.querySelector("table");
      if (table && table.querySelectorAll("tr").length > 10) return true;

      // Any lists with many items?
      const lis = document.querySelectorAll("ul li, ol li, .list-group-item");
      if (lis.length > 50) return true;

      // Any anchors at all (post-hydration usually increases a lot)
      const a = document.querySelectorAll("a");
      if (a.length > 120) return true;

      // Any anchors that look like internal navigation targets
      const hrefs = Array.from(a).map(x => (x.getAttribute("href") || "").toLowerCase());
      if (hrefs.some(h => h.includes("viewer")) && hrefs.length > 20) return true;

      return false;
    }, { timeout: READY_TIMEOUT });
  } catch (e) {
    // Save what we got for debugging
    const html = await page.content();
    const dbgPath = path.join(outDir, "_debug_explorer_rendered.html");
    await fs.writeFile(dbgPath, html, "utf8");

    console.log(`Wrote debug HTML -> ${dbgPath}`);
    throw new Error(
      `Explorer did not hydrate in time. Saved ${dbgPath}. Original: ${e?.message || e}`
    );
  }

  // Extract anchors + nearest heading context (best-effort)
  const extracted = await page.evaluate(() => {
    const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();
    const isHeading = (el) => /^H[1-6]$/.test(el?.tagName || "");

    function findSectionTitle(el) {
      // Search backwards in DOM for a heading
      let node = el;
      for (let steps = 0; steps < 60 && node; steps++) {
        if (node.previousElementSibling) node = node.previousElementSibling;
        else { node = node.parentElement; continue; }
        if (isHeading(node)) {
          const txt = norm(node.textContent);
          if (txt) return txt;
        }
      }
      return "";
    }

    return Array.from(document.querySelectorAll("a"))
      .map(a => ({
        href: a.getAttribute("href") || "",
        name: norm(a.textContent),
        img: a.querySelector("img")?.getAttribute("src") || "",
        sectionTitle: findSectionTitle(a)
      }))
      .filter(x => x.name && x.href);
  });

  const items = [];
  const seen = new Set();

  for (const a of extracted) {
    const href = normText(a.href);
    const name = normText(a.name);
    if (!href || !name) continue;

    // Keep only internal-ish links (skip external)
    if (/^https?:\/\//i.test(href) && !href.includes("evertaletoolbox2.runasp.net")) continue;

    // Prefer links that look like content pages
    // Keep Viewer links and also any "Explorer/..." sub links
    const h = href.toLowerCase();
    const looksRelevant = h.includes("viewer") || h.includes("explorer") || h.startsWith("/") || h.startsWith("viewer");
    if (!looksRelevant) continue;

    const id = href.startsWith("http") ? href : href; // stable key
    if (seen.has(id)) continue;
    seen.add(id);

    items.push({
      id,
      name,
      category: inferCategory(a.sectionTitle, name, href),
      image: a.img ? absUrl(EXPLORER_URL, a.img) : null,
      url: absUrl(EXPLORER_URL, href),
      section: normText(a.sectionTitle) || null,
    });
  }

  await browser.close();

  // Filter out obvious nav items
  const filtered = items.filter(x => x.name.length > 1);

  // HARD FAIL if too small
  if (filtered.length < 50) {
    throw new Error(`Explorer extraction too small (${filtered.length}). Refusing to write empty catalog.`);
  }

  const outPath = path.join(outDir, "catalog.toolbox.json");
  await writeJson(outPath, {
    source: EXPLORER_URL,
    scrapedAt: new Date().toISOString(),
    items: filtered,
  });

  console.log(`Wrote ${filtered.length} items -> ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});