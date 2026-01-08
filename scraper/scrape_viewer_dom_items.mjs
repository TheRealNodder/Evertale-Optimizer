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

  // Wait for images inside rows (real content)
  await page.waitForSelector("img[src*='/files/']", { timeout: 60000 });

  const items = await page.evaluate(() => {
    const rows = [];
    document.querySelectorAll("tr").forEach(tr => {
      const img = tr.querySelector("img");
      const text = tr.innerText?.trim();
      if (!img || !text) return;

      rows.push({
        text,
        image: img.src
      });
    });
    return rows;
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