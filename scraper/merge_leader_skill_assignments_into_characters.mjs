// scraper/merge_leader_skill_assignments_into_characters.mjs
import fs from "fs";
import path from "path";

const CHAR_IN = path.resolve("data/characters.json");
const ASSIGN_IN = path.resolve("data/leader_skill_assignments.json");
const LEADER_TEMPLATES_IN = path.resolve("data/leader_skills.json"); // optional
const CHAR_OUT = path.resolve("data/characters.json"); // in-place update

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function normalizeKey(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/\s+/g, " ");
}

// Optional: map (leaderSkillKey, conditionKey) -> readable text
function buildTemplateMap(maybeTemplates) {
  // Accept either:
  // { leaderSkills: [{ key, conditionKey, text }, ...] }
  // OR { leaderSkills: [{ leaderSkillKey, leaderSkillConditionKey, text }, ...] }
  // OR a plain array
  const arr = Array.isArray(maybeTemplates)
    ? maybeTemplates
    : (maybeTemplates?.leaderSkills || []);

  const map = new Map();
  for (const x of arr) {
    const k = x.key || x.leaderSkillKey || null;
    const c = x.conditionKey || x.leaderSkillConditionKey || null;
    const t = x.text || x.description || x.value || null;
    if (!k || !t) continue;
    map.set(`${k}::${c || ""}`, t);
  }
  return map;
}

function main() {
  if (!fs.existsSync(CHAR_IN)) throw new Error(`Missing ${CHAR_IN}`);
  if (!fs.existsSync(ASSIGN_IN)) throw new Error(`Missing ${ASSIGN_IN}`);

  const charsRaw = loadJson(CHAR_IN);
  const chars = Array.isArray(charsRaw) ? charsRaw : (charsRaw.characters || []);

  const assignRaw = loadJson(ASSIGN_IN);
  const assignments = assignRaw.assignments || [];

  let templateMap = new Map();
  if (fs.existsSync(LEADER_TEMPLATES_IN)) {
    try {
      templateMap = buildTemplateMap(loadJson(LEADER_TEMPLATES_IN));
    } catch {
      // ignore if format differs
    }
  }

  // Build lookup indices from assignments
  const byUnitKey = new Map();
  const byNameSecond = new Map();

  for (const a of assignments) {
    if (a.unitKey) byUnitKey.set(normalizeKey(a.unitKey), a);

    const n = normalizeKey(a.name);
    const s = normalizeKey(a.secondName);
    if (n) byNameSecond.set(`${n}::${s}`, a);
  }

  let merged = 0;
  let filledText = 0;

  for (const ch of chars) {
    // Try keys in order of reliability:
    // 1) unitKey
    // 2) (name, title/secondName)
    const unitKey = normalizeKey(ch.unitKey || ch.id || ch.code || "");
    const name = normalizeKey(ch.name);
    const second = normalizeKey(ch.title || ch.secondName || ch.epithet || "");

    let a = null;
    if (unitKey && byUnitKey.has(unitKey)) a = byUnitKey.get(unitKey);
    else if (byNameSecond.has(`${name}::${second}`)) a = byNameSecond.get(`${name}::${second}`);
    else if (byNameSecond.has(`${name}::`)) a = byNameSecond.get(`${name}::`);

    if (!a) continue;

    // Inject fields
    ch.leaderSkillKey = a.leaderSkillKey || ch.leaderSkillKey || null;
    ch.leaderSkillConditionKey = a.leaderSkillConditionKey || ch.leaderSkillConditionKey || null;

    // If you want the readable text too:
    if (ch.leaderSkillKey) {
      const txt = templateMap.get(`${ch.leaderSkillKey}::${ch.leaderSkillConditionKey || ""}`)
        || templateMap.get(`${ch.leaderSkillKey}::`)
        || null;
      if (txt) {
        ch.leaderSkillText = txt;
        filledText++;
      }
    }

    merged++;
  }

  // Write back preserving your existing top-level format
  const out = Array.isArray(charsRaw) ? chars : { ...charsRaw, characters: chars };
  fs.writeFileSync(CHAR_OUT, JSON.stringify(out, null, 2), "utf8");

  console.log(`[merge_leader_assignments] merged into characters: ${merged}`);
  console.log(`[merge_leader_assignments] filled leaderSkillText: ${filledText}`);
}

main();