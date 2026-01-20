/* optimizer.js — basic optimizer scaffold (uses characters.json + saved owned set) */

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";

const state = {
  allUnits: [],
  ownedIds: new Set(),
  ownedUnits: [],
  mode: "story",        // story | platoons
  style: "mono",        // mono | rainbow
  monoElement: "Light", // for mono
};

const $ = (s) => document.querySelector(s);

function loadOwned() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;
  throw new Error("characters.json is not an array");
}

function normalizeText(s) {
  return String(s || "").toLowerCase();
}

// Keyword scoring (based on your importance notes)
const KEY_WEIGHTS = {
  sleep: 4,
  burn: 5,
  poison: 5,
  stun: 4,
  heal: 4,
  "atk": 3,       // ATK Buff (loose match)
  "attack": 3,    // ATK Buff
  "hp": 3,        // HP Buff
  "max hp": 3,    // HP Buff
  "tu": 5,        // Turn manipulation (TU)
  "turn": 5,      // Turn manipulation
};

function unitTextBlob(u) {
  const parts = [];
  if (u.leaderSkill?.name) parts.push(u.leaderSkill.name);
  if (u.leaderSkill?.description) parts.push(u.leaderSkill.description);

  // activeSkillDetails / passiveSkillDetails exist in your structure
  const act = Array.isArray(u.activeSkillDetails) ? u.activeSkillDetails : [];
  const pas = Array.isArray(u.passiveSkillDetails) ? u.passiveSkillDetails : [];

  for (const a of act) {
    parts.push(a?.name || "");
    parts.push(a?.description || "");
  }
  for (const p of pas) {
    parts.push(p?.name || "");
    parts.push(p?.description || "");
  }

  return normalizeText(parts.join(" "));
}

function scoreUnit(u, context) {
  // Base score from ATK (primary) + leader skill presence
  const atk = Number(u.atk || 0);
  let score = atk / 10; // scale down
  if (u.leaderSkill?.name && u.leaderSkill.name !== "None") score += 50;

  // Keyword synergy score
  const blob = unitTextBlob(u);
  for (const [k, w] of Object.entries(KEY_WEIGHTS)) {
    if (blob.includes(k)) score += w * 8;
  }

  // Mono preference
  if (context.style === "mono") {
    if (String(u.element || "") === context.monoElement) score += 80;
    else score -= 40;
  }

  // Rarity small bump
  const r = String(u.rarity || "");
  if (r === "SSR") score += 30;
  else if (r === "SR") score += 15;
  else if (r === "R") score += 5;

  return score;
}

function renderSmallCard(u) {
  const leaderName =
    u.leaderSkill?.name && u.leaderSkill.name !== "None"
      ? u.leaderSkill.name
      : "No Leader Skill";

  const leaderDesc =
    u.leaderSkill?.description && u.leaderSkill.description !== "None"
      ? u.leaderSkill.description
      : "";

  const img = u.image || "";

  return `
    <div class="unitCard">
      <div class="unitThumb">
        ${img ? `<img src="${img}" alt="${u.name}">` : `<div class="ph">?</div>`}
      </div>
      <div class="meta">
        <div class="topRow">
          <div>
            <div class="unitName">${u.name || ""}</div>
            <div class="unitTitle">${u.title || ""}</div>
          </div>
          <div class="tags">
            <span class="tag rarity">${u.rarity || ""}</span>
            <span class="tag element">${u.element || ""}</span>
          </div>
        </div>

        <div class="statLine">
          <span class="stat"><strong>ATK</strong> ${u.atk ?? "-"}</span>
          <span class="stat"><strong>HP</strong> ${u.hp ?? "-"}</span>
          <span class="stat"><strong>SPD</strong> ${u.spd ?? "-"}</span>
          <span class="stat"><strong>COST</strong> ${u.cost ?? "-"}</span>
        </div>

        <div class="leaderBlock">
          <div class="leaderText"><strong>${leaderName}</strong></div>
          <div class="leaderText">${leaderDesc}</div>
        </div>
      </div>
    </div>
  `;
}

function renderOwnedGrid() {
  const grid = $("#ownedGrid");
  if (!grid) return;
  grid.innerHTML = state.ownedUnits.map(renderSmallCard).join("");
  $("#ownedCount").textContent = `Owned: ${state.ownedUnits.length}`;
}

function setMode(mode) {
  state.mode = mode;
  $("#modeStory").classList.toggle("active", mode === "story");
  $("#modePlatoons").classList.toggle("active", mode === "platoons");

  const status = $("#optimizerStatus");
  if (mode === "story") {
    status.textContent = "Story mode: selecting 8 units (5 main + 3 backup).";
  } else {
    status.textContent = "Platoons mode: scaffold only (20×5). Team fill logic can be added next.";
  }
}

function setStyle(style) {
  state.style = style;
  $("#monoElement").disabled = style !== "mono";
}

function buildBestTeam() {
  const context = { style: state.style, monoElement: state.monoElement };

  const owned = [...state.ownedUnits];
  if (owned.length === 0) {
    $("#teamView").innerHTML = `<div class="muted">No owned units selected yet. Go to Roster page and check units.</div>`;
    return;
  }

  const scored = owned
    .map(u => ({ u, s: scoreUnit(u, context) }))
    .sort((a, b) => b.s - a.s);

  if (state.mode === "story") {
    const picked = scored.slice(0, 8).map(x => x.u);
    $("#teamView").innerHTML = `
      <div class="muted" style="margin-bottom:10px;">Top 8 by score (basic heuristic):</div>
      <div class="grid">${picked.map(renderSmallCard).join("")}</div>
    `;
  } else {
    // Platoons scaffold: show top 20 as a starting point
    const picked = scored.slice(0, 20).map(x => x.u);
    $("#teamView").innerHTML = `
      <div class="muted" style="margin-bottom:10px;">Platoons scaffold: top 20 shown (next step is distributing into 20×5 slots).</div>
      <div class="grid">${picked.map(renderSmallCard).join("")}</div>
    `;
  }
}

async function init() {
  state.ownedIds = loadOwned();

  $("#teamStyle").addEventListener("change", (e) => {
    setStyle(e.target.value);
  });
  $("#monoElement").addEventListener("change", (e) => {
    state.monoElement = e.target.value;
  });

  $("#modeStory").addEventListener("click", () => setMode("story"));
  $("#modePlatoons").addEventListener("click", () => setMode("platoons"));
  $("#buildBtn").addEventListener("click", buildBestTeam);

  setMode("story");
  setStyle($("#teamStyle").value);

  state.allUnits = await loadCharacters();

  // ownedUnits determined by id match
  state.ownedUnits = state.allUnits.filter(u => state.ownedIds.has(u.id));
  renderOwnedGrid();
  buildBestTeam();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    $("#optimizerStatus").textContent = "Failed to load optimizer data.";
  });
});