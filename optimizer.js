/* optimizer.js — layouts + simple heuristics (locked layout generation) */
const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_TEAM_KEY = "evertale_team_layout_v1"; // stores ids

const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

const $ = (s) => document.querySelector(s);

function safeText(v, f="") { return v == null ? f : String(v); }

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;
  throw new Error("characters.json must be an array");
}

function loadOwned() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]")); }
  catch { return new Set(); }
}

function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_TEAM_KEY) || "{}");
    return {
      storyMain: Array.isArray(raw.storyMain) ? raw.storyMain : Array(STORY_MAIN).fill(""),
      storyBack: Array.isArray(raw.storyBack) ? raw.storyBack : Array(STORY_BACK).fill(""),
      platoons: Array.isArray(raw.platoons) ? raw.platoons : Array.from({length:PLATOON_COUNT}, () => Array(PLATOON_SIZE).fill("")),
      mode: raw.mode === "platoons" ? "platoons" : "story",
    };
  } catch {
    return {
      storyMain: Array(STORY_MAIN).fill(""),
      storyBack: Array(STORY_BACK).fill(""),
      platoons: Array.from({length:PLATOON_COUNT}, () => Array(PLATOON_SIZE).fill("")),
      mode: "story",
    };
  }
}
function saveLayout(layout) {
  localStorage.setItem(LS_TEAM_KEY, JSON.stringify(layout));
}

function leaderFrom(unit) {
  const ls = unit.leaderSkill;
  if (!ls) return null;
  if (typeof ls === "string") return ls.trim() || null;
  const name = safeText(ls.name).trim();
  const desc = safeText(ls.description).trim();
  const bad = (s) => !s || s.toLowerCase() === "none" || s.toLowerCase() === "null";
  return (!bad(name) || !bad(desc)) ? { name: bad(name) ? "Leader Skill" : name, description: bad(desc) ? "" : desc } : null;
}

function getImage(unit) {
  const img = unit.image || unit.icon || unit.portrait;
  return img ? String(img) : "";
}

function buildUnitOption(u) {
  const t = safeText(u.title);
  return `${safeText(u.name)}${t ? " — " + t : ""}`;
}

function slotCard(unit) {
  if (!unit) return `<div class="slotCard empty"><div class="muted">Empty</div></div>`;
  const img = getImage(unit);
  const t = safeText(unit.title);
  const ls = leaderFrom(unit);
  return `
    <div class="slotCard">
      <div class="slotThumb">${img ? `<img loading="lazy" src="${img}" alt="${safeText(unit.name)}">` : `<div class="ph">${safeText(unit.name,"?")[0]}</div>`}</div>
      <div class="slotMeta">
        <div class="slotName">${safeText(unit.name)}</div>
        <div class="slotTitle">${t}</div>
        <div class="slotTags">
          ${unit.rarity ? `<span class="tag rarity">${unit.rarity}</span>` : ""}
          ${unit.element ? `<span class="tag element">${unit.element}</span>` : ""}
        </div>
        ${ls ? `<div class="slotLeader"><div class="leaderName">${safeText(ls.name)}</div><div class="leaderDesc">${safeText(ls.description)}</div></div>` : ""}
      </div>
    </div>`;
}

function renderSlots(container, count, labelPrefix, layoutArr, ownedUnits, onChange) {
  container.innerHTML = "";
  for (let i=0;i<count;i++) {
    const curId = safeText(layoutArr[i]);
    const wrap = document.createElement("div");
    wrap.className = "slot";
    wrap.innerHTML = `
      <div class="slotTitle">${labelPrefix} ${i+1}</div>
      <select class="slotPick">
        <option value="">(empty)</option>
        ${ownedUnits.map(u => `<option value="${safeText(u.id)}">${escapeHtml(buildUnitOption(u))}</option>`).join("")}
      </select>
      <div class="slotView"></div>
    `;
    const sel = wrap.querySelector(".slotPick");
    sel.value = curId || "";
    const view = wrap.querySelector(".slotView");
    view.innerHTML = slotCard(ownedUnitsById.get(curId));

    sel.addEventListener("change", () => {
      layoutArr[i] = sel.value || "";
      view.innerHTML = slotCard(ownedUnitsById.get(layoutArr[i]));
      onChange();
    });

    container.appendChild(wrap);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

let allUnits = [];
let ownedUnits = [];
let ownedUnitsById = new Map();
let layout = null;

function setMode(mode) {
  layout.mode = mode === "platoons" ? "platoons" : "story";
  $("#modeSelect").value = layout.mode;
  $("#storySection").classList.toggle("hidden", layout.mode !== "story");
  $("#platoonsSection").classList.toggle("hidden", layout.mode !== "platoons");
  saveLayout(layout);
  renderAll();
}

function computeStorageIds() {
  const used = new Set();
  layout.storyMain.forEach(id => id && used.add(id));
  layout.storyBack.forEach(id => id && used.add(id));
  layout.platoons.forEach(team => team.forEach(id => id && used.add(id)));
  return ownedUnits.filter(u => !used.has(String(u.id))).map(u => String(u.id));
}

function renderStorage() {
  const grid = $("#storageGrid");
  const ids = computeStorageIds();
  const frag = document.createDocumentFragment();
  grid.innerHTML = "";
  for (const id of ids) {
    const u = ownedUnitsById.get(id);
    const card = document.createElement("div");
    card.innerHTML = `
      <div class="miniCard">
        <div class="miniThumb">${getImage(u) ? `<img loading="lazy" src="${getImage(u)}" alt="${safeText(u.name)}">` : `<div class="ph">${safeText(u.name,"?")[0]}</div>`}</div>
        <div class="miniText">
          <div class="unitName">${safeText(u.name)}</div>
          <div class="unitTitle">${safeText(u.title)}</div>
        </div>
      </div>`;
    frag.appendChild(card.firstElementChild);
  }
  grid.appendChild(frag);
}

function renderPlatoons() {
  const root = $("#platoonsGrid");
  root.innerHTML = "";
  for (let p=0;p<PLATOON_COUNT;p++) {
    const block = document.createElement("section");
    block.className = "platoonBlock";
    block.innerHTML = `<div class="teamSubTitle">Platoon ${p+1}</div><div class="slotGrid platoonSlots"></div>`;
    const grid = block.querySelector(".platoonSlots");
    renderSlots(grid, PLATOON_SIZE, "Slot", layout.platoons[p], ownedUnits, () => { saveLayout(layout); renderStorage(); });
    root.appendChild(block);
  }
}

function renderStory() {
  renderSlots($("#storyMain"), STORY_MAIN, "Main", layout.storyMain, ownedUnits, () => { saveLayout(layout); renderStorage(); });
  renderSlots($("#storyBack"), STORY_BACK, "Back", layout.storyBack, ownedUnits, () => { saveLayout(layout); renderStorage(); });
}

function renderAll() {
  renderStory();
  renderPlatoons();
  renderStorage();
}

function scoreUnit(u, prefs) {
  // Very simple scoring baseline (extend later with your Skill Effects sheet).
  // Uses: ATK (weight), leader skill keywords (sleep/burn/poison/stun/heal/buffs/turn)
  const atk = Number(u.atk ?? u.attack ?? 0) || 0;
  let s = atk * 1.0;

  const text = (JSON.stringify(u.activeSkillDetails || u.activeSkills || []) + " " +
                JSON.stringify(u.passiveSkillDetails || u.passiveSkills || []) + " " +
                JSON.stringify(u.leaderSkill || "")).toLowerCase();

  const w = prefs || {
    sleep:4, burn:5, poison:5, stun:4, heal:4, atkBuff:3, hpBuff:3, turn:5,
  };

  const addIf = (kw, val) => { if (text.includes(kw)) s += 1000 * val; };
  addIf("sleep", w.sleep);
  addIf("burn", w.burn);
  addIf("poison", w.poison);
  addIf("stun", w.stun);
  addIf("heal", w.heal);
  addIf("attack increased", w.atkBuff);
  addIf("max hp increased", w.hpBuff);
  addIf("tu", w.turn);

  return s;
}

function buildBestTeams() {
  // Picks top units by score; fills Story main/back, then platoons sequentially.
  const scored = ownedUnits
    .map(u => ({ id: String(u.id), u, score: scoreUnit(u) }))
    .sort((a,b) => b.score - a.score);

  const pick = (n, used) => {
    const out = [];
    for (const it of scored) {
      if (out.length >= n) break;
      if (used.has(it.id)) continue;
      used.add(it.id);
      out.push(it.id);
    }
    while (out.length < n) out.push("");
    return out;
  };

  const used = new Set();
  layout.storyMain = pick(STORY_MAIN, used);
  layout.storyBack = pick(STORY_BACK, used);

  layout.platoons = Array.from({length:PLATOON_COUNT}, () => pick(PLATOON_SIZE, used));
  saveLayout(layout);
  renderAll();
}

function clearAll() {
  layout.storyMain = Array(STORY_MAIN).fill("");
  layout.storyBack = Array(STORY_BACK).fill("");
  layout.platoons = Array.from({length:PLATOON_COUNT}, () => Array(PLATOON_SIZE).fill(""));
  saveLayout(layout);
  renderAll();
}

async function init() {
  allUnits = await loadCharacters();
  const ownedSet = loadOwned();
  ownedUnits = allUnits.filter(u => ownedSet.has(String(u.id)));
  ownedUnitsById = new Map(ownedUnits.map(u => [String(u.id), u]));

  layout = loadLayout();

  $("#ownedCount").textContent = `${ownedUnits.length} owned units loaded from roster`;

  $("#modeSelect").addEventListener("change", (e) => setMode(e.target.value));
  $("#buildBest").addEventListener("click", buildBestTeams);
  $("#clearTeams").addEventListener("click", clearAll);

  setMode(layout.mode); // also renders
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => {
    console.error(e);
    document.body.innerHTML = `<div class="page"><div class="panel"><div class="panelTitle">Optimizer failed to load</div><div class="muted">${escapeHtml(e?.message || String(e))}</div></div></div>`;
  });
});
