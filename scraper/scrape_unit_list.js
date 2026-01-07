import fs from "fs";
import * as cheerio from "cheerio";

const URL = "https://evertale2.fandom.com/wiki/Unit_List";

async function run() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error("Failed to fetch unit list");

  const html = await res.text();
  const $ = cheerio.load(html);

  const units = [];

  $("table.wikitable tbody tr").each((_, row) => {
    const link = $(row).find("td a").first();
    const name = link.text().trim();
    const href = link.attr("href");

    if (!name || !href) return;

    units.push({
      name,
      url: `https://evertale2.fandom.com${href}`
    });
  });

  if (!units.length) throw new Error("No units found");

  fs.writeFileSync("unit_links.json", JSON.stringify(units, null, 2));
  console.log(`✔ Saved ${units.length} unit links`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
