/* =========================================================
   optimizer.js — UI + storage + owned sync (engine-ready)
   =========================================================
   This file:
   - Loads characters.json (canonical)
   - Reads owned IDs from localStorage["evertale_owned_units_v1"]
   - Renders Story (5+3), Platoons (20x5), and Storage grids
   - Persists layout to localStorage["evertale_team_layout_v1"]
   - Exposes refreshOptimizerFromOwned() for optimizer-hook.js
   - Accepts engine payloads via renderStory(payload) / renderPlatoons(payload)
   ========================================================= */

const DATA_CHARACTERS = "./data/characters.json";
const OWNED_KEY = "evertale_owned_units_v1";
const LAYOUT_KEY = "evertale_team_layout_v1";

const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

const state = {
  all: [],
  ownedIds: new Set(),
  ownedUnits: [],
  layout: null,
  mode: "story", // "story" | "platoons"
};

/* ---------- utils ---------- */
function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}
function el(id) { return document.getElementById(id); }

function getOwnedIds() {
  const arr = safeJsonParse(localStorage.getItem(OWNED_KEY) || "[]", []);
  return new Set(Array.isArray(arr) ? arr : []);
}

function defaultLayout() {
  return {
    storyMain: Array(STORY_MAIN).fill(""),
    storyBack: Array(STORY_BACK).fill(""),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
  };
}

function loadLayout() {
  const obj = safeJsonParse(localStorage.getItem(LAYOUT_KEY) || "null", null);
  const base = defaultLayout();
  if (!obj) return base;

  const out = { ...base, ...obj };

  if (!Array.isArray(out.storyMain)) out.storyMain = base.storyMain;
  if (!Array.isArray(out.storyBack)) out.storyBack = base.storyBack;
  if (!Array.isArray(out.platoons)) out.platoons = base.platoons;

  out.storyMain = out.storyMain.slice(0, STORY_MAIN).concat(Array(STORY_MAIN).fill("")).slice(0, STORY_MAIN);
  out.storyBack = out.storyBack.slice(0, STORY_BACK).concat(Array(STORY_BACK).fill("")).slice(0, STORY_BACK);

  out.platoons = out.platoons.slice(0, PLATOON_COUNT);
  while (out.platoons.length < PLATOON_COUNT) out.platoons.push(Array(PLATOON_SIZE).fill(""));
  out.platoons = out.platoons.map(row => {
    const r = Array.isArray(row) ? row : [];
    return r.slice(0, PLATOON_SIZE).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE);
  });

  return out;
}

function saveLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(state.layout));
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load characters.json (${res.status})`);
  const json = await res.json();
  const chars = Array.isArray(json) ? json : (json && Array.isArray(json.characters) ? json.characters : []);
  return chars;
}

/* ---------- rendering helpers ---------- */
function optionList(units) {
  const opts = [`<option value="">(empty)</option>`];
  for (const u of units) {
    opts.push(`<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.element || "")} ${escapeHtml(u.rarity || "")})</option>`);
  }
  return opts.join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function unitById(id) {
  return state.ownedUnits.find(u => u.id === id) || null;
}

function renderSlotCard(slotKey, idx, currentId) {
  const u = currentId ? unitById(currentId) : null;
  const img = u?.image ? `<img src="${escapeHtml(u.image)}" alt="">` : `<div class="ph">?</div>`;
  const title = u ? escapeHtml(u.name) : "Empty";
  const sub = u ? escapeHtml(u.title || "") : "Select a unit";

  const chips = u ? `
    <div class="slotMetaRow">
      <span class="slotChip">${escapeHtml(u.rarity || "")}</span>
      <span class="slotChip">${escapeHtml(u.element || "")}</span>
    </div>
  ` : "";

  return `
    <div class="slotCard">
      <div class="slotTop">
        <div class="slotImg">${img}</div>
        <div>
          <div class="slotName">${title}</div>
          <div class="slotSub">${sub}</div>
        </div>
      </div>
      ${chips}
      <select class="slotSelect" data-slot="${slotKey}" data-idx="${idx}">
        ${optionList(state.ownedUnits)}
      </select>
    </div>
  `;
}

function renderStoryUI() {
  const storyMain = el("storyMain");
  const storyBack = el("storyBack");
  if (!storyMain || !storyBack) return;

  storyMain.innerHTML = state.layout.storyMain.map((id, i) => renderSlotCard("storyMain", i, id)).join("");
  storyBack.innerHTML = state.layout.storyBack.map((id, i) => renderSlotCard("storyBack", i, id)).join("");
}

function renderPlatoonsUI() {
  const grid = el("platoonsGrid");
  if (!grid) return;

  grid.innerHTML = state.layout.platoons.map((row, p) => {
    const slots = row.map((id, i) => renderSlotCard(`platoon_${p}`, i, id)).join("");
    return `
      <section class="panel platoonPanel">
        <div class="panelTitle">Platoon ${p + 1}</div>
        <div class="slotGrid platoonSlots">${slots}</div>
      </section>
    `;
  }).join("");
}

function renderStorageUI() {
  const grid = el("storageGrid");
  if (!grid) return;

  const used = new Set([
    ...state.layout.storyMain.filter(Boolean),
    ...state.layout.storyBack.filter(Boolean),
    ...state.layout.platoons.flat().filter(Boolean),
  ]);

  const remaining = state.ownedUnits.filter(u => !used.has(u.id));

  grid.innerHTML = remaining.map(u => {
    const img = u.image ? `<img src="${escapeHtml(u.image)}" alt="">` : `<div class="ph">?</div>`;
    return `
      <div class="slotCard">
        <div class="slotTop">
          <div class="slotImg">${img}</div>
          <div>
            <div class="slotName">${escapeHtml(u.name)}</div>
            <div class="slotSub">${escapeHtml(u.title || "")}</div>
          </div>
        </div>
        <div class="slotMetaRow">
          <span class="slotChip">${escapeHtml(u.rarity || "")}</span>
          <span class="slotChip">${escapeHtml(u.element || "")}</span>
        </div>
      </div>
    `;
  }).join("");
}

function wireSelects() {
  document.querySelectorAll("select.slotSelect").forEach(sel => {
    const slot = sel.getAttribute("data-slot");
    const idx = parseInt(sel.getAttribute("data-idx") || "0", 10);

    let current = "";
    if (slot === "storyMain") current = state.layout.storyMain[idx] || "";
    else if (slot === "storyBack") current = state.layout.storyBack[idx] || "";
    else if (slot && slot.startsWith("platoon_")) {
      const p = parseInt(slot.split("_")[1], 10);
      current = state.layout.platoons[p]?.[idx] || "";
    }

    sel.value = current;

    sel.addEventListener("change", () => {
      const v = sel.value || "";
      if (slot === "storyMain") state.layout.storyMain[idx] = v;
      else if (slot === "storyBack") state.layout.storyBack[idx] = v;
      else if (slot && slot.startsWith("platoon_")) {
        const p = parseInt(slot.split("_")[1], 10);
        if (!state.layout.platoons[p]) state.layout.platoons[p] = Array(PLATOON_SIZE).fill("");
        state.layout.platoons[p][idx] = v;
      }
      saveLayout();
      renderAll();
    });
  });
}

function renderModeVisibility() {
  const modeSel = el("modeSelect");
  if (modeSel) state.mode = modeSel.value;

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
}

function renderAll() {
  // Owned count
  const ownedCountEl = el("ownedCount");
  if (ownedCountEl) ownedCountEl.textContent = `${state.ownedUnits.length} selected`;

  renderModeVisibility();
  renderStoryUI();
  renderPlatoonsUI();
  renderStorageUI();
  wireSelects();
}

/* =========================================================
   Engine payload application
   ========================================================= */
function applyEngineResult(result) {
  if (!result || !result.story) return;

  // Story
  const main = Array.isArray(result.story.main) ? result.story.main : [];
  const back = Array.isArray(result.story.back) ? result.story.back : [];

  state.layout.storyMain = main.slice(0, STORY_MAIN).concat(Array(STORY_MAIN).fill("")).slice(0, STORY_MAIN);
  state.layout.storyBack = back.slice(0, STORY_BACK).concat(Array(STORY_BACK).fill("")).slice(0, STORY_BACK);

  // Platoons
  if (Array.isArray(result.platoons)) {
    state.layout.platoons = result.platoons.slice(0, PLATOON_COUNT).map(p => {
      const units = Array.isArray(p.units) ? p.units : [];
      return units.slice(0, PLATOON_SIZE).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE);
    });
    while (state.layout.platoons.length < PLATOON_COUNT) {
      state.layout.platoons.push(Array(PLATOON_SIZE).fill(""));
    }
  }

  saveLayout();
  renderAll();
}

/* These are called by optimizer-hook.js with payloads */
window.renderStory = function (payload) {
  if (payload && Array.isArray(payload.main) && Array.isArray(payload.back)) {
    applyEngineResult({ story: payload, platoons: state.layout.platoons.map(units => ({ units })) });
    return;
  }
  renderAll();
};

window.renderPlatoons = function (payload) {
  if (Array.isArray(payload)) {
    applyEngineResult({ story: { main: state.layout.storyMain, back: state.layout.storyBack }, platoons: payload });
    return;
  }
  renderAll();
};

/* =========================================================
   Owned sync — required by optimizer-hook.js
   ========================================================= */
window.refreshOptimizerFromOwned = function refreshOptimizerFromOwned() {
  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(u.id));

  // Expose for engine hook
  window.__optimizerOwnedUnits = state.ownedUnits;

  renderAll();
};

/* =========================================================
   UI actions
   ========================================================= */
function clearTeams() {
  state.layout = defaultLayout();
  saveLayout();
  renderAll();
}

function buildBestTeams() {
  // Prefer engine hook
  if (typeof window.runOptimizer === "function") {
    window.runOptimizer();
    // runOptimizer will call renderStory/renderPlatoons with payloads
    return;
  }
  // Fallback: direct engine call if hook not present
  if (window.OptimizerEngine && typeof window.OptimizerEngine.run === "function") {
    const owned = window.__optimizerOwnedUnits || state.ownedUnits;
    const result = window.OptimizerEngine.run(owned, window.__optimizerOptions || {});
    window.__optimizerResult = result;
    applyEngineResult(result);
  }
}

/* =========================================================
   init
   ========================================================= */
async function init() {
  state.all = await loadCharacters();
  state.layout = loadLayout();

  // initial owned
  window.refreshOptimizerFromOwned();

  el("modeSelect")?.addEventListener("change", () => renderAll());
  el("clearTeams")?.addEventListener("click", clearTeams);
  el("buildBest")?.addEventListener("click", buildBestTeams);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error("[optimizer] init failed:", err);
    const ownedCountEl = el("ownedCount");
    if (ownedCountEl) ownedCountEl.textContent = `Error: ${String(err.message || err)}`;
  });
});
