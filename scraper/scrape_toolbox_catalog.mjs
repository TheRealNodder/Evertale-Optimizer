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

  // fallback guess
  return "character";
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filepath, obj) {
  const text = JSON.stringify(obj, null, 2);
  await fs.writeFile(filepath, text, "utf8");
}

async function run() {
  const outDir = path.resolve(process.cwd(), "data");
  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  });

  // Helpful for Blazor apps
  page.setDefaultTimeout(45000);

  console.log(`Fetching Explorer: ${EXPLORER_URL}`);
  await page.goto(EXPLORER_URL, { waitUntil: "domcontentloaded" });

  // Blazor Server loads after initial HTML. Give it time + wait for meaningful content.
  await page.waitForTimeout(4000);

  // Wait until we see some kind of “list of items” links show up
  await page.waitForFunction(() => {
    const a = Array.from(document.querySelectorAll("a"));
    // Explorer typically has lots of internal links after hydration
    return a.filter(x => (x.getAttribute("href") || "").includes("Viewer")).length > 20
      || a.length > 80;
  }, { timeout: 45000 });

  // Extract anchors with context
  const extracted = await page.evaluate(() => {
    const norm = (s) => (s ?? "").toString().replace(/\s+/g, " ").trim();
    const abs = (href) => href || "";

    const isHeading = (el) => /^H[1-6]$/.test(el?.tagName || "");

    // Build a “section title” lookup by walking up DOM and finding nearest heading above.
    function findSectionTitle(el) {
      // climb a bit
      let cur = el;
      for (let up = 0; up < 6 && cur; up++) cur = cur.parentElement;
      // now search backwards for headings in the document order
      let node = el;
      for (let steps = 0; steps < 40 && node; steps++) {
        if (node.previousElementSibling) {
          node = node.previousElementSibling;
        } else {
          node = node.parentElement;
          continue;
        }
        if (isHeading(node)) {
          const txt = norm(node.textContent);
          if (txt) return txt;
        }
      }
      return "";
    }

    const anchors = Array.from(document.querySelectorAll("a"))
      .map(a => {
        const href = a.getAttribute("href") || "";
        const name = norm(a.textContent);
        const img = a.querySelector("img")?.getAttribute("src") || "";
        const sectionTitle = findSectionTitle(a);
        return { href, name, img, sectionTitle };
      })
      .filter(x => x.name && x.href);

    return anchors;
  });

  // Filter to internal “item” links (Explorer -> Viewer)
  const items = [];
  const seen = new Set();

  for (const a of extracted) {
    const href = normText(a.href);
    const name = normText(a.name);
    if (!href || !name) continue;

    // Prefer Viewer links; Explorer may also contain nav links
    const isViewerish =
      href.includes("Viewer") ||
      href.toLowerCase().includes("viewer");

    if (!isViewerish) continue;

    // Use href as ID key (stable)
    const id = href.startsWith("http") ? href : href;

    if (seen.has(id)) continue;
    seen.add(id);

    const category = inferCategory(a.sectionTitle, name, href);

    items.push({
      id,
      name,
      category,
      image: a.img ? absUrl(EXPLORER_URL, a.img) : null,
      url: absUrl(EXPLORER_URL, href),
      section: normText(a.sectionTitle) || null,
    });
  }

  await browser.close();

  // HARD FAIL instead of writing empty/1-byte files
  if (items.length < 50) {
    throw new Error(
      `Explorer extraction too small (${items.length}). Refusing to write empty catalog.`
    );
  }

  const outPath = path.join(outDir, "catalog.toolbox.json");
  await writeJson(outPath, {
    source: EXPLORER_URL,
    scrapedAt: new Date().toISOString(),
    items,
  });

  console.log(`Wrote ${items.length} items -> ${outPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});