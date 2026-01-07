// scraper/scrape_toolbox_units.mjs
// Text-based parser for https://evertaletoolbox2.runasp.net/Viewer
// (Viewer is not a real <table>, so we parse the rendered text blocks)

import fs from "node:fs";
import path from "node:path";

const VIEWER_URL = "https://evertaletoolbox2.runasp.net/Viewer";
const OUT_PATH = path.join(process.cwd(), "..", "data", "units.json");

function decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripToLines(html) {
  // Turn HTML into text lines we can scan
  let t = html;

  // Convert <br> and </p>/<li> etc into line breaks
  t = t.replace(/<br\s*\/?>/gi, "\n");
  t = t.replace(/<\/(p|div|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, "\n");

  // Remove remaining tags
  t = t.replace(/<[^>]*>/g, "\n");

  t = decodeHtmlEntities(t);

  // Normalize and split
  const lines = t
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return lines;
}

function isNumberLike(s) {
  return /^[0-9][0-9,]*$/.test(s);
}

function toInt(s) {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function looksLikeLeaderName(s) {
  // Examples: "Light HP Up", "Storm ATK & HP Up", "Fire Attack Up"
  // Keep it permissive; the next line is usually the description sentence.
  return (
    s.length >= 3 &&
    s.length <= 40 &&
    /Up|ATK|HP|SPD|Speed|Attack|Def|Resist/i.test(s) &&
    !s.endsWith(".")
  );
}

function looksLikeSentence(s) {
  return s.length >= 15 && /[.!?]$/.test(s);
}

function parseUnitsFromViewer(lines) {
  // Find where the CHARACTER list begins (after headers)
  const startIdx = lines.findIndex((x) => x === "Name");
  if (startIdx === -1) throw new Error("Could not find Viewer header 'Name'.");

  // Stop before weapon list begins (Viewer page includes weapons after character section)
  const weaponIdx = lines.findIndex((x) => x === "Weapon:");
  const endIdx = weaponIdx !== -1 ? weaponIdx : lines.length;

  const slice = lines.slice(startIdx, endIdx);

  // The unit blocks start with repeated "Image" tokens.
  // We'll look for a pattern:
  // "Image" then Name then Title then ... then Cost (number) then ATK (number) HP (number) SPD (number) then leader skill name + description then skill lists
  const units = [];
  let i = 0;

  while (i < slice.length) {
    // Seek to the start of a card
    if (slice[i] !== "Image") {
      i++;
      continue;
    }

    // Candidate start
    const name = slice[i + 1];
    const title = slice[i + 2];

    // Basic sanity checks
    if (!name || !title) {
      i++;
      continue;
    }
    if (name === "Name" || title === "Rarity") {
      i++;
      continue;
    }

    // Walk forward and find the first numeric trio: cost, atk, hp, spd
    let j = i + 3;
    while (j < slice.length && !isNumberLike(slice[j])) j++;

    // Need cost+atk+hp+spd = 4 consecutive numeric lines
    const cost = toInt(slice[j]);
    const atk = toInt(slice[j + 1]);
    const hp = toInt(slice[j + 2]);
    const spd = toInt(slice[j + 3]);

    if (cost == null || atk == null || hp == null || spd == null) {
      // Not a valid card, advance
      i++;
      continue;
    }

    // After stats there’s usually "Image" (weapon icon) then leader skill name + description
    let k = j + 4;

    // Skip non-text noise (Images, ALL, etc.)
    while (k < slice.length && (slice[k] === "Image" || slice[k] === "ALL")) k++;

    // Leader skill name + description (best effort)
    let leaderSkillName = null;
    let leaderSkillText = null;

    if (k < slice.length && looksLikeLeaderName(slice[k]) && looksLikeSentence(slice[k + 1] || "")) {
      leaderSkillName = slice[k];
      leaderSkillText = slice[k + 1];
      k += 2;
    } else {
      // Sometimes the leader name exists but description doesn't end with "."
      if (k < slice.length && looksLikeLeaderName(slice[k])) {
        leaderSkillName = slice[k];
        // Grab next line as description if it looks sentence-ish
        if (looksLikeSentence(slice[k + 1] || "") || (slice[k + 1] || "").includes("Allied")) {
          leaderSkillText = slice[k + 1];
          k += 2;
        } else {
          k += 1;
        }
      }
    }

    // Next lines: active skills then passive skills, until the next "Image" that starts next card.
    const skills = [];
    while (k < slice.length && slice[k] !== "Image") {
      const s = slice[k];
      // Remove obvious section labels
      if (
        s !== "Rarity" &&
        s !== "Element" &&
        s !== "Cost" &&
        s !== "ATK" &&
        s !== "HP" &&
        s !== "SPD" &&
        s !== "Leader Skill" &&
        s !== "Active Skills" &&
        s !== "Passive Skills" &&
        s !== "Card View" &&
        s !== "Column:"
      ) {
        skills.push(s);
      }
      k++;
    }

    // Toolbox usually has 6 active skills and 4 passive skills, but we won’t hardcode it.
    // Heuristic: passive skills often include "Up Lv" or "Resist Lv" or "Mastery"
    const passiveSkills = skills.filter((s) => /Up Lv|Resist Lv|Mastery/i.test(s));
    const activeSkills = skills.filter((s) => !/Up Lv|Resist Lv|Mastery/i.test(s));

    const id = `${name}__${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");

    units.push({
      id,
      name,
      title,
      cost,
      stats: { atk, hp, spd },
      leaderSkillName,
      leaderSkillText,
      activeSkills,
      passiveSkills,
      source: { viewer: VIEWER_URL }
    });

    // Continue from next card marker
    i = k;
  }

  return units;
}

async function run() {
  console.log(`Fetching Viewer: ${VIEWER_URL}`);
  const res = await fetch(VIEWER_URL, {
    headers: { "user-agent": "Evertale-Optimizer-Scraper/3.0" }
  });
  if (!res.ok) throw new Error(`Viewer fetch failed: ${res.status}`);

  const html = await res.text();
  const lines = stripToLines(html);

  // Quick sanity check that we actually got real content
  if (!lines.includes("Rizette") && !lines.includes("Zeus")) {
    // If this triggers, it means the runner is getting a blocked/blank response.
    throw new Error("Viewer content looks empty or blocked (did not contain expected unit names).");
  }

  const units = parseUnitsFromViewer(lines);

  if (!units.length) {
    throw new Error("Parsed 0 units from Viewer text. The layout may have changed.");
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2)
  );

  console.log(`Wrote ${units.length} units to ${OUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
