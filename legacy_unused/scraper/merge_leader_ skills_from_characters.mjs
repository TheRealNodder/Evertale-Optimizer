import fs from "fs";

const CHAR_FILE = "data/characters.json";
const LEADER_FILE = "data/leader_skills.json";
const OUT_FILE = "data/characters.with_leader_skills.json";

const chars = JSON.parse(fs.readFileSync(CHAR_FILE, "utf8"));
const leaders = JSON.parse(fs.readFileSync(LEADER_FILE, "utf8")).leaderSkills || [];

const normalize = s =>
  s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

const leaderMap = new Map();
leaders.forEach(ls => {
  leaderMap.set(normalize(ls.character), ls);
});

let merged = 0;

const out = chars.map(c => {
  const key = normalize(c.name);
  if (!leaderMap.has(key)) return c;

  merged++;
  const ls = leaderMap.get(key);

  return {
    ...c,
    leaderSkill: {
      name: ls.skillName || "Leader Skill",
      description: ls.description || "",
      element: ls.element || null
    }
  };
});

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`✔ Leader skills merged: ${merged}`);