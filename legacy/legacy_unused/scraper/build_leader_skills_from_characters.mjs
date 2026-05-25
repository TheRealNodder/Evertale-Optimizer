import fs from "fs";
import path from "path";

const IN = path.resolve(process.cwd(), "data", "characters.json");
const OUT = path.resolve(process.cwd(), "data", "leader_skills.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function asArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.characters)) return raw.characters;
  return [];
}

function pickLeaderSkill(obj) {
  // Common key variants
  const name =
    obj.leaderSkillName ??
    obj.leader_skill_name ??
    obj.leaderName ??
    obj.leader ??
    obj.leaderSkill ??
    obj.leader_skill ??
    null;

  const desc =
    obj.leaderSkillDescription ??
    obj.leader_skill_description ??
    obj.leaderDesc ??
    obj.leader_description ??
    obj.leaderSkillText ??
    obj.leader_text ??
    null;

  if (name && desc) return { title: String(name).trim(), description: String(desc).trim() };

  // If the source is messy (some dumps pack text into one field), try regex:
  const hay = JSON.stringify(obj);
  // Looks for: "Leader Skill" ... then captures a short title and a longer sentence
  const m = hay.match(/Leader Skill\\?["']?\\s*[:\\-]?\\s*([A-Za-z0-9 &\\.]{2,60})\\s+([^"]{10,220})/i);
  if (m) {
    return { title: m[1].trim(), description: m[2].trim() };
  }

  return null;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function main() {
  if (!fs.existsSync(IN)) {
    console.warn(`[leader_skills] Missing ${IN}. Writing empty leader_skills.json`);
    fs.writeFileSync(
      OUT,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: "data/characters.json",
          note: "characters.json missing; wrote empty",
          leaderSkills: [],
        },
        null,
        2
      ),
      "utf8"
    );
    process.exit(0);
  }

  const raw = readJson(IN);
  const chars = asArray(raw);

  const map = new Map(); // id -> leader skill
  for (const c of chars) {
    const ls = pickLeaderSkill(c);
    if (!ls) continue;

    const id = c.leaderSkillId ?? c.leader_skill_id ?? slug(ls.title);
    const key = String(id);

    // keep the longest description if duplicates
    const prev = map.get(key);
    if (!prev || (ls.description?.length ?? 0) > (prev.description?.length ?? 0)) {
      map.set(key, {
        id: key,
        title: ls.title,
        description: ls.description,
      });
    }
  }

  const leaderSkills = Array.from(map.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "data/characters.json",
    count: leaderSkills.length,
    leaderSkills,
  };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[leader_skills] Wrote ${leaderSkills.length} leader skills -> ${OUT}`);
}

main();