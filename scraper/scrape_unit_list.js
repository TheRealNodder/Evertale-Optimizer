import fetch from "node-fetch";
import fs from "fs";
import cheerio from "cheerio";

const URL = "https://evertale2.fandom.com/wiki/Unit_List";

async function scrapeUnitList() {
  const res = await fetch(URL);
  const html = await res.text();
  const $ = cheerio.load(html);

  const units = [];

  $("table.sortable tbody tr").each((_, row) => {
    const link = $(row).find("td a").first();
    const name = link.text().trim();
    const href = link.attr("href");

    if (!name || !href) return;

    units.push({
      name,
      url: "https://evertale2.fandom.com" + href
    });
  });

  fs.writeFileSync("unit_links.json", JSON.stringify(units, null, 2));
  console.log(`Scraped ${units.length} unit links.`);
}

scrapeUnitList();
