// scraper/scrape_toolbox_units.mjs
// Node 18+ (uses built-in fetch)
// Output: ../data/units.json

import fs from "node:fs";
import path from "node:path";

const TOOLBOX_EXPLORER = "https://evertaletoolbox.runasp.net/Explorer";
const TOOLBOX_VIEWER = "https://evertaletoolbox.runasp.net/Viewer";

const OUT_PATH = path.join(process.cwd(), "..", "data", "units.json");

// --- helpers ---
function stripHtmlToText(html) {
  // Keep line breaks from <br> and block-ish tags, then remove the rest.
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|td|th|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

function uniq(arr) {
  return [...new Set(arr)];
}

function toIntMaybe(s) {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseExplorerIds(explorerText) {
  // Explorer outputs menu items like: "* RizetteBrave (Rizette)"
  // We'll capture the ID before the "("
  const ids = [];
  const re = /^\*\s*([A-Za-z0-9_]+)\s*\(/gm;
  let m;
  while ((m = re.exec(explorerText)) !== null) {
    ids.push(m[1]);
  }
  return uniq(ids);
}

const ELEMENTS = new Set(["Fire", "Earth", "Storm", "Water", "Light", "Dark"]);

function parseUnitBlock(blockText, unitId) {
  // blockText is a slice from Viewer text starting at unitId
  const lines = blockText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Expect at least:
  // [0]=unitId, [1]=Name, [2]=Title, then element, atk, hp, spd, weaponType, etc.
  let idx = 0;

  // Confirm starts with unitId (defensive)
  if (lines[idx] !== unitId) return null;
  idx++;

  const name = lines[idx++] ?? null;
  const title = lines[idx++] ?? null;

  // Find the next element token
  let element = null;
  while (idx < lines.length) {
    if (ELEMENTS.has(lines[idx])) {
      element = lines[idx++];
      break;
    }
    idx++;
  }

  const atk = toIntMaybe(lines[idx++] ?? "");
  const hp = toIntMaybe(lines[idx++] ?? "");
  const spd = toIntMaybe(lines[idx++] ?? "");

  const weaponType = lines[idx++] ?? null;

  // Parse skills: detect “skill header” lines like:
  // "+3 Linked Edge 70 TU"
  // "0 Restore Link 1 TU ALL"
  // "-1 Cerulean Blade 100 TU"
  //
  // We'll store:
  // { levelDelta, name, tu, target, description }
  const activeSkills = [];
  const passiveSkills = [];

  const skillHeaderRe = /^([+-]?\d+)\s+(.+?)\s+(\d+)\s+TU(?:\s+(ALL))?$/i;

  function readSkillList(targetArr) {
    while (idx < lines.length) {
      // Stop if next unit begins (handled by caller slice), but also break if we hit end.
      const headerMatch = lines[idx].match(skillHeaderRe);
      if (!headerMatch) break;

      const levelDelta = Number(headerMatch[1]);
      const skillName = headerMatch[2].trim();
      const tu = Number(headerMatch[3]);
      const target = headerMatch[4] ? "ALL" : "SINGLE";

      idx++;

      const descLines = [];
      while (idx < lines.length) {
        const maybeNext = lines[idx].match(skillHeaderRe);
        if (maybeNext) break;

        // Heuristic: Passive skill sections in Viewer tend to show just a name line then description.
        // We’ll stop reading actives when we hit a line that looks like a passive-name marker:
        // (No TU in it, and it’s not an element/stat/weapon label)
        descLines.push(lines[idx]);
        idx++;
      }

      targetArr.push({
        levelDelta,
        name: skillName,
        tu,
        target,
        description: descLines.join("\n").trim(),
      });
    }
  }

  // Read active skills first
  readSkillList(activeSkills);

  // The remaining section is mostly passives/traits.
  // We’ll parse as:
  // PassiveName
  // description...
  // PassiveName
  // description...
  while (idx < lines.length) {
    const line = lines[idx];

    // If it looks like a new unit id accidentally inside block (rare), stop.
    if (line === unitId) break;

    // Passive name heuristic:
    // - not an element
    // - not a pure number
    // - not a weapon type label we already consumed
    // - and next line exists (so we can attach description)
    const isNumeric = /^[0-9,]+$/.test(line);
    if (ELEMENTS.has(line) || isNumeric) {
      idx++;
      continue;
    }

    const passiveName = line;
    idx++;

    const descLines = [];
    while (idx < lines.length) {
      const next = lines[idx];

      // Start of another passive: usually a short “title-ish” line (no TU),
      // and followed by a description line.
      const looksLikeSkillHeader = skillHeaderRe.test(next);
      const looksLikePassiveName =
        !looksLikeSkillHeader &&
        !ELEMENTS.has(next) &&
        !/^[0-9,]+$/.test(next) &&
        next.length <= 80; // keep it conservative

      if (looksLikeSkillHeader) break;
      if (looksLikePassiveName && descLines.length > 0) break;

      descLines.push(next);
      idx++;
    }

    passiveSkills.push({
      name: passiveName,
      description: descLines.join("\n").trim(),
    });
  }

  return {
    id: unitId,
    name,
    title,
    element,
    stats: { atk, hp, spd },
    weaponType,
    activeSkills,
    passiveSkills,
    source: {
      viewer: TOOLBOX_VIEWER,
      explorer: TOOLBOX_EXPLORER,
    },
  };
}

async function run() {
  console.log(`Fetching Explorer IDs: ${TOOLBOX_EXPLORER}`);
  const explorerRes = await fetch(TOOLBOX_EXPLORER, {
    headers: { "user-agent": "Evertale-Optimizer-Scraper/1.0" },
  });
  if (!explorerRes.ok) throw new Error(`Explorer fetch failed: ${explorerRes.status}`);
  const explorerHtml = await explorerRes.text();
  const explorerText = stripHtmlToText(explorerHtml);
  const allIds = parseExplorerIds(explorerText);

  const characterIds = allIds; // Explorer includes weapons/boss too, but still useful as “next marker”
  console.log(`Found ${characterIds.length} IDs in Explorer`);

  console.log(`Fetching Viewer page: ${TOOLBOX_VIEWER}`);
  const viewerRes = await fetch(TOOLBOX_VIEWER, {
    headers: { "user-agent": "Evertale-Optimizer-Scraper/1.0" },
  });
  if (!viewerRes.ok) throw new Error(`Viewer fetch failed: ${viewerRes.status}`);
  const viewerHtml = await viewerRes.text();
  const viewerText = stripHtmlToText(viewerHtml);

  // Locate each ID position inside Viewer text, then slice between them.
  const positions = [];
  for (const id of characterIds) {
    const needle = `\n${id}\n`;
    const pos = viewerText.indexOf(needle);
    if (pos !== -1) positions.push({ id, pos });
  }

  positions.sort((a, b) => a.pos - b.pos);
  console.log(`IDs found inside Viewer content: ${positions.length}`);

  if (positions.length === 0) {
    throw new Error(
      "No units found in Viewer text. The site might have changed, or requires JS rendering."
    );
  }

  const units = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].pos + 1; // keep leading newline stable
    const end = i + 1 < positions.length ? positions[i + 1].pos + 1 : viewerText.length;
    const block = viewerText.slice(start, end).trim();

    // block should start with id on first line
    const parsed = parseUnitBlock(block, positions[i].id);
    if (parsed) units.push(parsed);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), units }, null, 2));
  console.log(`Wrote ${units.length} units to ${OUT_PATH}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
