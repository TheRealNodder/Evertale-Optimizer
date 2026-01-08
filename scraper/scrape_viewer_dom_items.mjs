// scraper/scrape_viewer_dom_items.mjs
import fs from "fs";
import { chromium } from "playwright";

const OUT = "data/catalog.dom.raw.json";
const URL = "https://evertaletoolbox2.runasp.net/Viewer";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Loading Viewer:", URL);
  await page.goto(URL, { waitUntil: "networkidle" });

  // Wait for something meaningful to appear
  await page.waitForSelector("img", { timeout: 60000 });

  // Extract DOM-visible cards / rows
  const items = await page.evaluate(() => {
    const results = [];

    // This is intentionally generic — survives layout changes
    const cards = document.querySelectorAll("tr, .card, .item, .row");

    cards.forEach(el => {
      const text = el.innerText?.trim();
      if (!text || text.length < 10) return;

      const img =
        el.querySelector("img")?.getAttribute("src") ?? null;

      results.push({
        text,
        image: img
      });
    });

    return results;
  });

  await browser.close();

  if (!items.length) {
    throw new Error("No DOM items extracted");
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: URL,
        items
      },
      null,
      2
    )
  );

  console.log(`Wrote ${items.length} DOM items -> ${OUT}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});