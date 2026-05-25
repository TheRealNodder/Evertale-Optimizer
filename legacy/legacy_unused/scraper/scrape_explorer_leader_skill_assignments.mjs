// scraper/scrape_explorer_leader_skill_assignments.mjs
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const OUT = path.resolve("data/leader_skill_assignments.json");

// IMPORTANT: use the Explorer domain you indicated
const EXPLORER_URL = "https://evertaletoolbox.runasp.net/Explorer";

function textClean(s) {
  return (s || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickAfterLabel(blockText, label) {
  // Matches: "LeaderSkill: AttackAndHPUp6Life"
  // or "LeaderSkill : AttackAndHPUp6Life"
  const re = new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i");
  const m = blockText.match(re);
  return m ? textClean(m[1]) : null;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function extractAssignmentsFromHtml(html) {
  const $ = cheerio.load(html);
  const bodyText = textClean($("body").text());

  // Explorer pages like this often render "records" as repeated blocks.
  // We’ll split into blocks around "Name:" lines (your screenshot shows "Name: Venus")
  const blocks = bodyText.split(/\n(?=Name\s*:)/g).map(textClean).filter(Boolean);

  const out = [];
  for (const b of blocks) {
    const name = pickAfterLabel(b, "Name");
    if (!name) continue;

    const secondName = pickAfterLabel(b, "Second Name");
    const leaderSkillKey = pickAfterLabel(b, "LeaderSkill");
    const leaderSkillConditionKey =
      pickAfterLabel(b, "LeaderSkill Condition") ||
      pickAfterLabel(b, "LeaderSkillCondition");

    // unit key is often shown on the line list (e.g. VenusRegular01)
    // If present in the text, try to capture the first token that looks like a UnitKey:
    // Common pattern: something like "VenusRegular01" / "ZeusRegular" etc.
    let unitKey = null;
    const unitKeyMatch = b.match(/\b[A-Z][A-Za-z0-9]+(Regular|Brave|Modern|Dark|Evil|Girl|School)[A-Za-z0-9]*\b/);
    if (unitKeyMatch) unitKey = unitKeyMatch[0];

    // Some entries may not have leader skill (non-SSR) — keep them but mark null.
    out.push({
      unitKey,
      name,
      secondName: secondName || null,
      leaderSkillKey: leaderSkillKey || null,
      leaderSkillConditionKey: leaderSkillConditionKey || null,
    });
  }

  // Deduplicate by (unitKey,name,secondName)
  const seen = new Set();
  const deduped = [];
  for (const row of out) {
    const key = `${row.unitKey || ""}::${row.name}::${row.secondName || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  return deduped;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const html = await fetchHtml(EXPLORER_URL);

  // Save raw for debugging
  fs.writeFileSync("data/_debug_explorer.html", html, "utf8");

  const assignments = extractAssignmentsFromHtml(html);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: EXPLORER_URL,
    count: assignments.length,
    assignments,
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[explorer_leader_assignments] wrote ${OUT} (${assignments.length} rows)`);

  // Sanity signal for Actions logs
  const withLeader = assignments.filter(a => a.leaderSkillKey).length;
  console.log(`[explorer_leader_assignments] rows with leaderSkillKey: ${withLeader}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});