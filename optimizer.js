const DATA_CHARACTERS = "./data/characters.json";
const OWNED_KEY = "evertale_owned_units_v1";

const $ = (s) => document.querySelector(s);

let ALL = [];
let OWNED = [];

async function loadData() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  const json = await res.json();
  ALL = Array.isArray(json) ? json : json.characters;

  const ownedIds = JSON.parse(localStorage.getItem(OWNED_KEY) || "[]");
  OWNED = ALL.filter(u => ownedIds.includes(u.id));
}

function scoreUnit(u) {
  let score = 0;

  // rarity weight
  if (u.rarity === "SSR") score += 100;
  if (u.rarity === "SR") score += 60;
  if (u.rarity === "R") score += 30;

  // leader skill bonus
  if (u.leaderSkill && u.leaderSkill.name && u.leaderSkill.name !== "None") {
    score += 25;
  }

  // stats (optional but future-proof)
  score += (u.atk || 0) * 0.1;
  score += (u.hp || 0) * 0.05;
  score += (u.spd || 0) * 0.2;

  return score;
}

function buildTeam() {
  const mode = $("#teamMode").value;
  const strategy = $("#strategy").value;
  const element = $("#elementFocus").value;

  let pool = [...OWNED];

  if (strategy === "mono" && element !== "any") {
    pool = pool.filter(u => u.element === element);
  }

  pool.forEach(u => u.__score = scoreUnit(u));
  pool.sort((a, b) => b.__score - a.__score);

  const teamSize = mode === "story" ? 7 : 5;
  return pool.slice(0, teamSize);
}

function renderTeam(team) {
  const grid = $("#teamGrid");
  grid.innerHTML = "";

  team.forEach((u, i) => {
    grid.insertAdjacentHTML("beforeend", `
      <div class="slot">
        <div class="slotTitle">Slot ${i + 1}</div>

        <div class="unitCard">
          <div class="unitThumb">
            <img src="${u.image}" alt="${u.name}">
          </div>

          <div class="meta">
            <div class="unitName">${u.name}</div>
            <div class="unitSub">${u.secondaryName || ""}</div>

            <div class="tags">
              <span class="tag rarity">${u.rarity}</span>
              <span class="tag element">${u.element}</span>
            </div>

            <div class="leaderBlock">
              <div class="leaderName">${u.leaderSkill?.name || "No Leader Skill"}</div>
              <div class="leaderDesc">${u.leaderSkill?.description || ""}</div>
            </div>
          </div>
        </div>
      </div>
    `);
  });
}

async function init() {
  await loadData();

  $("#runOptimize").addEventListener("click", () => {
    const team = buildTeam();
    renderTeam(team);
  });
}

document.addEventListener("DOMContentLoaded", init);