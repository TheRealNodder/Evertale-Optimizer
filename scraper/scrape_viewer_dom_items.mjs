import { chromium } from "playwright";
import fs from "fs";

const URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT = "data/catalog.dom.raw.json";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });

  // Scroll until no more rows load
  let prevHeight = 0;
  while (true) {
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) break;
    prevHeight = height;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
  }

  const rows = await page.evaluate(() => {
    const data = [];
    document.querySelectorAll("table tbody tr").forEach(tr => {
      const cells = [...tr.querySelectorAll("td")].map(td => td.innerText.trim());
      const img = tr.querySelector("img")?.getAttribute("src") || null;
      if (cells.length < 5) return;
      data.push({
        name: cells[0],
        rarity: cells[1],
        element: cells[2],
        cost: cells[3],
        atk: cells[4],
        hp: cells[5],
        spd: cells[6],
        image: img
      });
    });
    return data;
  });

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
  console.log(`Saved ${rows.length} rows`);

  await browser.close();
})();