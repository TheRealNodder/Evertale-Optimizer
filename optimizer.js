/* optimizer.js — WHOLE FILE
   Adds Locked Leader support for the optimizer run.
*/

const DATA_CHARACTERS = "./data/characters.json";
const OWNED_KEY = "evertale_owned_units_v1";
const LAYOUT_KEY = "evertale_team_layout_v1";

const LS_TEAMTYPE_KEY = "evertale_optimizer_teamType_v1";
const LS_PRESET_KEY = "evertale_optimizer_preset_v1";
const LS_LEADERLOCK_KEY = "evertale_optimizer_leaderLock_v1";

const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

const state = {
  all: [],
  ownedIds: new Set(),
  ownedUnits: [],
  layout: null,
  mode: "story",
};

function el(id) { return document.getElementById(id); }
function safeJsonParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function normId(v) { return (v == null || v === "") ? "" : String(v); }

function getTeamTypePref() {
  const v = localStorage.getItem(LS_TEAMTYPE_KEY);
  return (v === "mono" || v === "rainbow" || v === "auto") ? v : "auto";
}
function getPresetPref() {
  const allowed = new Set(["auto","burn","poison","sleep","stun","heal","turn","atkBuff","hpBuff","cleanse"]);
  const v = localStorage.getItem(LS_PRESET_KEY) || "auto";
  return allowed.has(v) ? v : "auto";
}
function setTeamTypePref(v) { localStorage.setItem(LS_TEAMTYPE_KEY, v); }
function setPresetPref(v) { localStorage.setItem(LS_PRESET_KEY, v); }

function getLeaderLockPref() {
  return normId(localStorage.getItem(LS_LEADERLOCK_KEY) || "");
}
function setLeaderLockPref(v) {
  localStorage.setItem(LS_LEADERLOCK_KEY, normId(v));
}

function initSharedOptimizerFiltersUI() {
  const teamSel = el("teamTypeSelect");
  const presetSel = el("presetSelect");

  if (teamSel) teamSel.value = getTeamTypePref();
  if (presetSel) presetSel.value = getPresetPref();

  teamSel?.addEventListener("change", (e) => setTeamTypePref(e.target.value || "auto"));
  presetSel?.addEventListener("change", (e) => setPresetPref(e.target.value || "auto"));
}

function initLeaderLockUI() {
  const lockSel = el("leaderLockSelect");
  if (!lockSel) return;

  // populate from owned units
  const cur = getLeaderLockPref();

  const opts = [`<option value="">Locked Leader: (none)</option>`];
  for (const u of state.ownedUnits) {
    const id = normId(u.id);
    opts.push(`<option value="${id}">${u.name} (${u.element} ${u.rarity})</option>`);
  }
  lockSel.innerHTML = opts.join("");
  lockSel.value = cur;

  lockSel.addEventListener("change", () => {
    setLeaderLockPref(lockSel.value || "");
  });

  el("clearLeaderLock")?.addEventListener("click", () => {
    setLeaderLockPref("");
    lockSel.value = "";
  });
}

function getOwnedIds() {
  const arr = safeJsonParse(localStorage.getItem(OWNED_KEY) || "[]", []);
  const ids = Array.isArray(arr) ? arr : [];
  return new Set(ids.map(normId).filter(Boolean));
}

function loadLayout() {
  const empty = {
    storyMain: Array(STORY_MAIN).fill(""),
    storyBack: Array(STORY_BACK).fill(""),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
  };

  const obj = safeJsonParse(localStorage.getItem(LAYOUT_KEY) || "null", null);
  if (!obj) return empty;

  obj.storyMain = Array.isArray(obj.storyMain) ? obj.storyMain.map(normId) : empty.storyMain;
  obj.storyBack = Array.isArray(obj.storyBack) ? obj.storyBack.map(normId) : empty.storyBack;
  obj.platoons  = Array.isArray(obj.platoons) ? obj.platoons : empty.platoons;

  obj.storyMain = obj.storyMain.slice(0, STORY_MAIN).concat(Array(STORY_MAIN).fill("")).slice(0, STORY_MAIN);
  obj.storyBack = obj.storyBack.slice(0, STORY_BACK).concat(Array(STORY_BACK).fill("")).slice(0, STORY_BACK);

  obj.platoons = obj.platoons.slice(0, PLATOON_COUNT);
  while (obj.platoons.length < PLATOON_COUNT) obj.platoons.push(Array(PLATOON_SIZE).fill(""));

  obj.platoons = obj.platoons.map(row => {
    const r = Array.isArray(row) ? row.map(normId) : [];
    return r.slice(0, PLATOON_SIZE).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE);
  });

  return obj;
}

function saveLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(state.layout));
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_CHARACTERS}: ${res.status}`);
  const json = await res.json();
  const chars = Array.isArray(json) ? json : (json && Array.isArray(json.characters) ? json.characters : []);
  return chars;
}

function optionList(units) {
  const opts = [`<option value="">(empty)</option>`];
  for (const u of units) {
    opts.push(`<option value="${normId(u.id)}">${u.name} (${u.element} ${u.rarity})</option>`);
  }
  return opts.join("");
}

function slotCardHTML(slotKey, idx, currentId, units) {
  const cid = normId(currentId);
  const u = units.find(x => normId(x.id) === cid);

  const img = u?.image ? `<img src="${u.image}" alt="">` : `<div class="ph">?</div>`;
  const title = u ? u.name : "Empty";
  const sub = u ? (u.title || "") : "Select a unit";

  return `
    <div class="slotCard ${u ? "" : "empty"}">
      <div class="slotTop">
        <div class="slotImg">${img}</div>
        <div>
          <div class="slotName">${title}</div>
          <div class="slotSub">${sub}</div>
        </div>
      </div>

      ${u ? `
        <div class="slotMetaRow">
          <span class="slotChip">${u.rarity || ""}</span>
          <span class="slotChip">${u.element || ""}</span>
        </div>
      ` : ""}

      <select class="slotSelect" data-slot="${slotKey}" data-idx="${idx}">
        ${optionList(units)}
      </select>
    </div>
  `;
}

function wireSelects(units) {
  document.querySelectorAll("select.slotSelect").forEach(sel => {
    const slot = sel.getAttribute("data-slot");
    const idx = parseInt(sel.getAttribute("data-idx"), 10);

    let current = "";
    if (slot === "storyMain") current = state.layout.storyMain[idx] || "";
    else if (slot === "storyBack") current = state.layout.storyBack[idx] || "";
    else if (slot.startsWith("platoon_")) {
      const p = parseInt(slot.split("_")[1], 10);
      current = state.layout.platoons[p][idx] || "";
    }

    sel.value = normId(current);

    sel.addEventListener("change", () => {
      const v = normId(sel.value);

      if (slot === "storyMain") state.layout.storyMain[idx] = v;
      else if (slot === "storyBack") state.layout.storyBack[idx] = v;
      else if (slot.startsWith("platoon_")) {
        const p = parseInt(slot.split("_")[1], 10);
        state.layout.platoons[p][idx] = v;
      }

      saveLayout();
      renderAll();
    });
  });
}

function renderStory(payload) {
  if (payload && payload.main && payload.back) {
    state.layout.storyMain = payload.main.map(normId).slice(0, STORY_MAIN).concat(Array(STORY_MAIN).fill("")).slice(0, STORY_MAIN);
    state.layout.storyBack = payload.back.map(normId).slice(0, STORY_BACK).concat(Array(STORY_BACK).fill("")).slice(0, STORY_BACK);
    saveLayout();
  }

  const mainEl = el("storyMain");
  const backEl = el("storyBack");
  if (!mainEl || !backEl) return;

  mainEl.innerHTML = state.layout.storyMain.map((id,i) => slotCardHTML("storyMain", i, id, state.ownedUnits)).join("");
  backEl.innerHTML = state.layout.storyBack.map((id,i) => slotCardHTML("storyBack", i, id, state.ownedUnits)).join("");
}

function renderPlatoons(payload) {
  if (Array.isArray(payload)) {
    state.layout.platoons = payload.slice(0, PLATOON_COUNT).map(p => {
      const units = Array.isArray(p.units) ? p.units.map(normId) : [];
      return units.slice(0, PLATOON_SIZE).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE);
    });
    while (state.layout.platoons.length < PLATOON_COUNT) state.layout.platoons.push(Array(PLATOON_SIZE).fill(""));
    saveLayout();
  }

  const grid = el("platoonsGrid");
  if (!grid) return;

  grid.innerHTML = state.layout.platoons.map((row,p) => {
    const slots = row.map((id,i) => slotCardHTML(`platoon_${p}`, i, id, state.ownedUnits)).join("");
    return `
      <div class="panel platoonPanel">
        <div class="panelTitle">Platoon ${p+1}</div>
        <div class="slotGrid platoonSlots">${slots}</div>
      </div>
    `;
  }).join("");
}

function renderStorage() {
  const grid = el("storageGrid");
  if (!grid) return;

  const used = new Set([
    ...state.layout.storyMain.filter(Boolean),
    ...state.layout.storyBack.filter(Boolean),
    ...state.layout.platoons.flat().filter(Boolean),
  ].map(normId));

  const remaining = state.ownedUnits.filter(u => !used.has(normId(u.id)));

  grid.innerHTML = remaining.map(u => {
    const img = u.image ? `<img src="${u.image}" alt="">` : `<div class="ph">?</div>`;
    return `
      <div class="slotCard">
        <div class="slotTop">
          <div class="slotImg">${img}</div>
          <div>
            <div class="slotName">${u.name}</div>
            <div class="slotSub">${u.title || ""}</div>
          </div>
        </div>
        <div class="slotMetaRow">
          <span class="slotChip">${u.rarity || ""}</span>
          <span class="slotChip">${u.element || ""}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderAll() {
  el("ownedCount") && (el("ownedCount").textContent = `${state.ownedUnits.length} selected`);
  el("ownedPoolText") && (el("ownedPoolText").textContent = `${state.ownedUnits.length} owned units available`);

  const storySection = el("storySection");
  const platoonsSection = el("platoonsSection");
  if (storySection && platoonsSection) {
    if (state.mode === "story") {
      storySection.classList.remove("hidden");
      platoonsSection.classList.add("hidden");
    } else {
      storySection.classList.add("hidden");
      platoonsSection.classList.remove("hidden");
    }
  }

  renderStory();
  renderPlatoons();
  renderStorage();
  wireSelects(state.ownedUnits);

  // expose for hook
  window.renderStory = renderStory;
  window.renderPlatoons = renderPlatoons;
}

function clearTeams() {
  state.layout = {
    storyMain: Array(STORY_MAIN).fill(""),
    storyBack: Array(STORY_BACK).fill(""),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
  };
  saveLayout();
  renderAll();
}

function applyEngineResult(result) {
  if (!result || !result.story) return;

  const main = Array.isArray(result.story.main) ? result.story.main.map(normId).filter(Boolean) : [];
  const back = Array.isArray(result.story.back) ? result.story.back.map(normId).filter(Boolean) : [];

  state.layout.storyMain = main.slice(0, STORY_MAIN).concat(Array(STORY_MAIN).fill("")).slice(0, STORY_MAIN);
  state.layout.storyBack = back.slice(0, STORY_BACK).concat(Array(STORY_BACK).fill("")).slice(0, STORY_BACK);

  if (Array.isArray(result.platoons)) {
    state.layout.platoons = result.platoons.slice(0, PLATOON_COUNT).map(p => {
      const units = Array.isArray(p.units) ? p.units.map(normId).filter(Boolean) : [];
      return units.slice(0, PLATOON_SIZE).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE);
    });
    while (state.layout.platoons.length < PLATOON_COUNT) state.layout.platoons.push(Array(PLATOON_SIZE).fill(""));
  }

  saveLayout();
  renderAll();
}

function buildEngineOptions() {
  const teamType = (el("teamTypeSelect")?.value || getTeamTypePref());
  const preset   = (el("presetSelect")?.value || getPresetPref());
  const lockedLeaderId = (el("leaderLockSelect")?.value || getLeaderLockPref());

  setTeamTypePref(teamType);
  setPresetPref(preset);
  setLeaderLockPref(lockedLeaderId);

  const options = {};
  options.doctrineOverrides = {};

  if (teamType === "mono") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_mono" };
  else if (teamType === "rainbow") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_rainbow" };
  else options.doctrineOverrides.monoVsRainbow = { selectionMode: "auto" };

  options.presetTag = (preset === "auto") ? "" : preset;
  options.presetMode = (preset === "auto") ? "auto" : "hard";

  // Leader lock
  options.lockedLeaderId = normId(lockedLeaderId);

  return options;
}

function runEngine() {
  if (!window.OptimizerEngine || typeof window.OptimizerEngine.run !== "function") {
    console.error("OptimizerEngine not loaded");
    return;
  }

  window.__optimizerOwnedUnits = state.ownedUnits;
  const options = buildEngineOptions();
  window.__optimizerOptions = options;

  const result = window.OptimizerEngine.run(window.__optimizerOwnedUnits || [], options);
  window.__optimizerResult = result;

  applyEngineResult(result);
}

function installModeButtons() {
  const storyBtn = el("modeStory");
  const platoonsBtn = el("modePlatoons");
  if (!storyBtn || !platoonsBtn) return;

  storyBtn.addEventListener("click", () => {
    state.mode = "story";
    storyBtn.classList.add("active");
    platoonsBtn.classList.remove("active");
    renderAll();
  });

  platoonsBtn.addEventListener("click", () => {
    state.mode = "platoons";
    platoonsBtn.classList.add("active");
    storyBtn.classList.remove("active");
    renderAll();
  });
}

window.refreshOptimizerFromOwned = function refreshOptimizerFromOwned() {
  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(normId(u.id)));
  window.__optimizerOwnedUnits = state.ownedUnits;

  // refresh leader lock options whenever owned changes
  initLeaderLockUI();

  renderAll();
};

window.runOptimizer = function runOptimizer() {
  runEngine();
};

async function init() {
  initSharedOptimizerFiltersUI();

  state.all = await loadCharacters();
  state.layout = loadLayout();

  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(normId(u.id)));
  window.__optimizerOwnedUnits = state.ownedUnits;

  // init leader lock dropdown from owned
  initLeaderLockUI();

  el("buildBest")?.addEventListener("click", runEngine);
  el("clearTeams")?.addEventListener("click", clearTeams);

  el("teamTypeSelect")?.addEventListener("change", () => setTeamTypePref(el("teamTypeSelect").value || "auto"));
  el("presetSelect")?.addEventListener("change", () => setPresetPref(el("presetSelect").value || "auto"));

  installModeButtons();
  renderAll();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error(err);
    const owned = el("ownedCount");
    if (owned) owned.textContent = `Error: ${String(err.message || err)}`;
  });
});