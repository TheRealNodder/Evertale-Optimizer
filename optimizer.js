/* optimizer.js — WHOLE FILE
   Adds slot-locks for Story + Platoons and passes to engine.
*/

const DATA_CHARACTERS = "./data/characters.json";
const OWNED_KEY = "evertale_owned_units_v1";
const LAYOUT_KEY = "evertale_team_layout_v1";

const LS_TEAMTYPE_KEY = "evertale_optimizer_teamType_v1";
const LS_PRESET_KEY = "evertale_optimizer_preset_v1";
const LS_LOCKS_KEY = "evertale_optimizer_slotLocks_v1";

const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

const state = {
  all: [],
  ownedIds: new Set(),
  ownedUnits: [],
  layout: null,
  locks: null, // { storyMain:bool[5], storyBack:bool[3], platoons:bool[20][5] }
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

function defaultLocks() {
  return {
    storyMain: Array(STORY_MAIN).fill(false),
    storyBack: Array(STORY_BACK).fill(false),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill(false)),
  };
}

function loadLocks() {
  const obj = safeJsonParse(localStorage.getItem(LS_LOCKS_KEY) || "null", null);
  const base = defaultLocks();
  if (!obj) return base;

  if (Array.isArray(obj.storyMain)) base.storyMain = obj.storyMain.slice(0,STORY_MAIN).map(Boolean);
  if (Array.isArray(obj.storyBack)) base.storyBack = obj.storyBack.slice(0,STORY_BACK).map(Boolean);
  if (Array.isArray(obj.platoons)) {
    base.platoons = obj.platoons.slice(0,PLATOON_COUNT).map(row => {
      const r = Array.isArray(row) ? row.slice(0,PLATOON_SIZE).map(Boolean) : [];
      return r.concat(Array(PLATOON_SIZE).fill(false)).slice(0,PLATOON_SIZE);
    });
    while (base.platoons.length < PLATOON_COUNT) base.platoons.push(Array(PLATOON_SIZE).fill(false));
  }
  return base;
}

function saveLocks() {
  localStorage.setItem(LS_LOCKS_KEY, JSON.stringify(state.locks));
}

function initSharedOptimizerFiltersUI() {
  const teamSel = el("teamTypeSelect");
  const presetSel = el("presetSelect");
  if (teamSel) teamSel.value = getTeamTypePref();
  if (presetSel) presetSel.value = getPresetPref();
  teamSel?.addEventListener("change", (e) => setTeamTypePref(e.target.value || "auto"));
  presetSel?.addEventListener("change", (e) => setPresetPref(e.target.value || "auto"));
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
  return Array.isArray(json) ? json : (json && Array.isArray(json.characters) ? json.characters : []);
}

function optionList(units) {
  const opts = [`<option value="">(empty)</option>`];
  for (const u of units) {
    opts.push(`<option value="${normId(u.id)}">${u.name} (${u.element} ${u.rarity})</option>`);
  }
  return opts.join("");
}

function slotCardHTML(slotKey, idx, currentId, units, locked) {
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

      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center; margin-top:8px;">
        <label class="muted" style="display:flex; gap:8px; align-items:center; user-select:none;">
          <input type="checkbox" class="slotLock" data-slot="${slotKey}" data-idx="${idx}" ${locked ? "checked" : ""}/>
          Lock
        </label>
        ${u ? `
          <div class="slotMetaRow" style="margin:0;">
            <span class="slotChip">${u.rarity || ""}</span>
            <span class="slotChip">${u.element || ""}</span>
          </div>
        ` : `<div></div>`}
      </div>

      <select class="slotSelect" data-slot="${slotKey}" data-idx="${idx}" ${locked ? "disabled" : ""}>
        ${optionList(units)}
      </select>
    </div>
  `;
}

function getLockFor(slotKey, idx) {
  if (slotKey === "storyMain") return !!state.locks.storyMain[idx];
  if (slotKey === "storyBack") return !!state.locks.storyBack[idx];
  if (slotKey.startsWith("platoon_")) {
    const p = parseInt(slotKey.split("_")[1], 10);
    return !!state.locks.platoons[p][idx];
  }
  return false;
}

function setLockFor(slotKey, idx, val) {
  if (slotKey === "storyMain") state.locks.storyMain[idx] = !!val;
  else if (slotKey === "storyBack") state.locks.storyBack[idx] = !!val;
  else if (slotKey.startsWith("platoon_")) {
    const p = parseInt(slotKey.split("_")[1], 10);
    state.locks.platoons[p][idx] = !!val;
  }
  saveLocks();
}

function wireSelects() {
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

  document.querySelectorAll("input.slotLock").forEach(cb => {
    const slot = cb.getAttribute("data-slot");
    const idx = parseInt(cb.getAttribute("data-idx"), 10);
    cb.addEventListener("change", () => {
      setLockFor(slot, idx, cb.checked);
      renderAll();
    });
  });
}

function renderStory() {
  const mainEl = el("storyMain");
  const backEl = el("storyBack");
  if (!mainEl || !backEl) return;

  mainEl.innerHTML = state.layout.storyMain.map((id,i) =>
    slotCardHTML("storyMain", i, id, state.ownedUnits, getLockFor("storyMain", i))
  ).join("");

  backEl.innerHTML = state.layout.storyBack.map((id,i) =>
    slotCardHTML("storyBack", i, id, state.ownedUnits, getLockFor("storyBack", i))
  ).join("");
}

function renderPlatoons() {
  const grid = el("platoonsGrid");
  if (!grid) return;

  grid.innerHTML = state.layout.platoons.map((row,p) => {
    const slots = row.map((id,i) =>
      slotCardHTML(`platoon_${p}`, i, id, state.ownedUnits, getLockFor(`platoon_${p}`, i))
    ).join("");

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
  wireSelects();
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

  // Apply only into unlocked slots. Locked slots keep what user has.
  const main = Array.isArray(result.story.main) ? result.story.main.map(normId) : [];
  const back = Array.isArray(result.story.back) ? result.story.back.map(normId) : [];

  for (let i=0;i<STORY_MAIN;i++) {
    if (!state.locks.storyMain[i]) state.layout.storyMain[i] = main[i] || "";
  }
  for (let i=0;i<STORY_BACK;i++) {
    if (!state.locks.storyBack[i]) state.layout.storyBack[i] = back[i] || "";
  }

  if (Array.isArray(result.platoons)) {
    for (let p=0;p<PLATOON_COUNT;p++) {
      const row = (result.platoons[p]?.units || []).map(normId);
      for (let i=0;i<PLATOON_SIZE;i++) {
        if (!state.locks.platoons[p][i]) state.layout.platoons[p][i] = row[i] || "";
      }
    }
  }

  saveLayout();
  renderAll();
}

function buildEngineOptions() {
  const teamType = (el("teamTypeSelect")?.value || getTeamTypePref());
  const preset   = (el("presetSelect")?.value || getPresetPref());

  setTeamTypePref(teamType);
  setPresetPref(preset);

  const options = {};
  options.doctrineOverrides = {};

  if (teamType === "mono") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_mono" };
  else if (teamType === "rainbow") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_rainbow" };
  else options.doctrineOverrides.monoVsRainbow = { selectionMode: "auto" };

  options.presetTag = (preset === "auto") ? "" : preset;
  options.presetMode = (preset === "auto") ? "auto" : "hard";

  // Pass current layout + locks so engine can treat locked units as forced picks.
  options.currentLayout = structuredCloneSafe(state.layout);
  options.slotLocks = structuredCloneSafe(state.locks);

  return options;
}

function structuredCloneSafe(obj) {
  try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj || {})); }
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

function lockFilledStorySlots() {
  for (let i=0;i<STORY_MAIN;i++) state.locks.storyMain[i] = !!state.layout.storyMain[i];
  for (let i=0;i<STORY_BACK;i++) state.locks.storyBack[i] = !!state.layout.storyBack[i];
  saveLocks();
  renderAll();
}

function lockFilledPlatoons() {
  for (let p=0;p<PLATOON_COUNT;p++) {
    for (let i=0;i<PLATOON_SIZE;i++) {
      state.locks.platoons[p][i] = !!state.layout.platoons[p][i];
    }
  }
  saveLocks();
  renderAll();
}

function unlockAllLocks() {
  state.locks = defaultLocks();
  saveLocks();
  renderAll();
}

// Hook entrypoint
window.refreshOptimizerFromOwned = function refreshOptimizerFromOwned() {
  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(normId(u.id)));
  window.__optimizerOwnedUnits = state.ownedUnits;
  renderAll();
};

window.runOptimizer = function runOptimizer() {
  runEngine();
};

async function init() {
  initSharedOptimizerFiltersUI();

  state.all = await loadCharacters();
  state.layout = loadLayout();
  state.locks = loadLocks();

  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(normId(u.id)));
  window.__optimizerOwnedUnits = state.ownedUnits;

  el("buildBest")?.addEventListener("click", runEngine);
  el("clearTeams")?.addEventListener("click", clearTeams);

  el("lockFilledStory")?.addEventListener("click", lockFilledStorySlots);
  el("lockFilledPlatoons")?.addEventListener("click", lockFilledPlatoons);
  el("unlockAllLocks")?.addEventListener("click", unlockAllLocks);

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