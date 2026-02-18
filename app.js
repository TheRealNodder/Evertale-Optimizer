/* app.js — WHOLE FILE
   Roster page behavior:
   - Dedupes characters.json by id (prevents duplicate roster cards)
   - Tap anywhere on a card toggles Owned (except checkbox/label)
   - Long-press + drag across cards toggles many quickly (each card once per drag)
   - View toggle (Compact/Detailed) via body classes:
       body.mobile-compact / body.mobile-detailed
   - Deselect All button clears Owned selection
   - Paste list into search:
       - Filters roster to only pasted names/ids (multi-line or comma-separated)
       - Prompts to auto-select Owned for matched units
*/

const DATA_CHARACTERS = "./data/characters.json";
// Current + legacy keys (older builds used `evertale_owned`).
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_OWNED_KEY_LEGACY = "evertale_owned";
const LS_MOBILE_VIEW_KEY = "evertale_mobile_view_v1"; // "compact" | "detailed"

const state = {
  units: [],
  owned: new Set(),
  q: "",
  element: "all",
  rarity: "all",
  listTokens: null, // array of normalized tokens when user pastes list
};

// Drag-select state
const drag = {
  armed: false,
  active: false,
  timer: null,
  toggledIds: new Set(),
  suppressNextClick: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  pointerId: null,
};

const $ = (id) => document.getElementById(id);

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function normKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function loadOwned() {
  const rawCurrent = localStorage.getItem(LS_OWNED_KEY);
  const rawLegacy = localStorage.getItem(LS_OWNED_KEY_LEGACY);
  const arr = safeJsonParse((rawCurrent && rawCurrent !== "[]") ? rawCurrent : (rawLegacy || "[]"), []);
  const set = new Set();
  if (Array.isArray(arr)) for (const v of arr) set.add(String(v));
  return set;
}

function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
  // Keep legacy key in sync for older pages/builds.
  localStorage.setItem(LS_OWNED_KEY_LEGACY, JSON.stringify([...state.owned]));
}

function getMobileViewPref() {
  const v = localStorage.getItem(LS_MOBILE_VIEW_KEY);
  return (v === "detailed" || v === "compact") ? v : "compact";
}
function setMobileViewPref(v) {
  localStorage.setItem(LS_MOBILE_VIEW_KEY, v);
}
function applyMobileViewClass(view) {
  document.body.classList.add("page-roster");
  document.body.classList.remove("mobile-compact", "mobile-detailed");
  document.body.classList.add(view === "detailed" ? "mobile-detailed" : "mobile-compact");
}
function syncViewToggleText() {
  const btn = $("viewToggle");
  if (!btn) return;
  const v = getMobileViewPref();
  btn.textContent = `View: ${v === "compact" ? "Compact" : "Detailed"}`;
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_CHARACTERS}: ${res.status}`);
  const json = await res.json();
  const raw = Array.isArray(json) ? json : (json && Array.isArray(json.characters) ? json.characters : []);

  // Deduplicate by ID (keep first occurrence)
  const seen = new Set();
  const deduped = [];
  for (const u of raw) {
    const id = String(u?.id ?? "");
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(u);
  }
  state.units = deduped;
}

function safeText(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}


function normalizeElementName(el) {
  return String(el || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function elementClassForUnit(unit) {
  const e = normalizeElementName(unit?.element || unit?.affinity || unit?.type);
  if (e === "fire") return "el-fire";
  if (e === "water") return "el-water";
  if (e === "storm" || e === "lightning" || e === "electric") return "el-storm";
  if (e === "earth") return "el-earth";
  if (e === "light" || e === "holy") return "el-light";
  if (e === "dark" || e === "shadow") return "el-dark";
  return "";
}

function parseListTokens(text) {
  const raw = String(text ?? "");
  const parts = raw
    .split(/[\n\r,;\t]+/g)
    .map(s => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return null;

  const tokens = [];
  const seen = new Set();
  for (const p of parts) {
    const k = normKey(p);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    tokens.push(k);
  }
  return tokens.length ? tokens : null;
}

function unitMatchesTokens(u, tokens) {
  const id = normKey(u?.id);
  const name = normKey(u?.name);
  const title = normKey(u?.title);

  for (const t of tokens) {
    if (!t) continue;
    if (t === id || t === name || t === title) return true;
    if (t.length >= 4) {
      if (name.includes(t) || title.includes(t)) return true;
    }
  }
  return false;
}

function renderUnitCard(u) {
  const leaderName =
    u.leaderSkill?.name && u.leaderSkill.name !== "None"
      ? u.leaderSkill.name
      : "No Leader Skill";

  const leaderDesc =
    u.leaderSkill?.description && u.leaderSkill.description !== "None"
      ? u.leaderSkill.description
      : "This unit does not provide a leader skill.";

  const atk = u.atk ?? u.stats?.atk ?? "";
  const hp  = u.hp  ?? u.stats?.hp  ?? "";
  const spd = u.spd ?? u.stats?.spd ?? "";
  const cost= u.cost?? u.stats?.cost?? "";

  const activeSkills = Array.isArray(u.activeSkills) ? u.activeSkills : [];
  const passiveDetails = Array.isArray(u.passiveSkillDetails) ? u.passiveSkillDetails : [];

  const img = u.image
    ? `<img src="${safeText(u.image)}" alt="${safeText(u.name)}">`
    : `<div class="ph">?</div>`;

  return `
    <div class="unitCard ${elementClassForUnit(u)}" data-unit-id="${safeText(u.id)}">
      <div class="unitThumb">${img}</div>

      <div class="meta">
	        <div class="metaHeader">
	          <div class="nameBlock">
	            <div class="unitName">${safeText(u.name)}</div>
	            <div class="unitTitle">${safeText(u.title)}</div>
	          </div>

	          <div class="chipCol">
	            ${u.element ? `<span class="tag element">${safeText(u.element)}</span>` : ``}
	            ${u.rarity ? `<span class="tag rarity">${safeText(u.rarity)}</span>` : ``}
	          </div>
	        </div>

        <div class="unitDetails">
  <div class="statLine">
    <div class="stat"><strong>ATK</strong> ${atk}</div>
    <div class="stat"><strong>HP</strong> ${hp}</div>
    <div class="stat"><strong>SPD</strong> ${spd}</div>
    <div class="stat"><strong>COST</strong> ${cost}</div>
  </div>

  <div class="leaderBlock">
    <div class="leaderName">${safeText(leaderName)}</div>
    <div class="leaderDesc">${safeText(leaderDesc)}</div>
  </div>
</div>
        </div>

        <label class="ownedRow">
          <input class="ownedCheck" type="checkbox" data-owned-id="${safeText(u.id)}">
          <span>Owned</span>
        </label>
      </div>
    </div>
  `;
}

function setStatus(filteredCount) {
  const status = $("statusText");
  if (!status) return;
  status.textContent = `${filteredCount} shown • ${state.owned.size} owned`;
}

function toggleOwnedForCard(cardEl) {
  const cb = cardEl?.querySelector?.("input[data-owned-id]");
  if (!cb) return;
  const id = cb.getAttribute("data-owned-id");

  cb.checked = !cb.checked;
  if (cb.checked) state.owned.add(id);
  else state.owned.delete(id);

  saveOwned();
}

function cardFromPoint(x, y) {
  const elAt = document.elementFromPoint(x, y);
  if (!elAt) return null;
  return elAt.closest?.(".unitCard") || null;
}

function beginDrag() {
  drag.active = true;
  drag.toggledIds.clear();
  drag.suppressNextClick = true;
}
function endDrag() {
  drag.armed = false;
  drag.active = false;
  drag.pointerId = null;
  drag.toggledIds.clear();
  if (drag.timer) { clearTimeout(drag.timer); drag.timer = null; }
  setTimeout(() => { drag.suppressNextClick = false; }, 0);
}
function armLongPress(x, y) {
  drag.armed = true;
  drag.startX = x;
  drag.startY = y;
  if (drag.timer) clearTimeout(drag.timer);
  drag.timer = setTimeout(() => {
    if (!drag.armed || drag.active) return;
    beginDrag();
    const c = cardFromPoint(drag.lastX, drag.lastY);
    if (c) dragToggleOnce(c);
  }, 280);
}
function cancelLongPress() {
  drag.armed = false;
  if (drag.timer) { clearTimeout(drag.timer); drag.timer = null; }
}
function dragToggleOnce(cardEl) {
  const id = cardEl.getAttribute("data-unit-id");
  if (!id) return;
  if (drag.toggledIds.has(id)) return;
  drag.toggledIds.add(id);
  toggleOwnedForCard(cardEl);
  saveOwned();
  renderRoster(); // keep UI consistent during drag
}

function wireDragSelect(gridEl) {
  if (gridEl.__dragWired) return;
  gridEl.__dragWired = true;

  gridEl.addEventListener("pointerdown", (e) => {
    const card = e.target?.closest?.(".unitCard");
    if (!card) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.closest("label"))) return;

    drag.pointerId = e.pointerId;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    armLongPress(e.clientX, e.clientY);
  }, { passive: true });

  gridEl.addEventListener("pointermove", (e) => {
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;

    if (!drag.active && drag.armed) {
      const dx = Math.abs(e.clientX - drag.startX);
      const dy = Math.abs(e.clientY - drag.startY);
      if (dx + dy > 10) cancelLongPress();
      return;
    }

    if (drag.active) {
      const card = cardFromPoint(e.clientX, e.clientY);
      if (card) dragToggleOnce(card);
      e.preventDefault?.();
    }
  }, { passive: false });

  gridEl.addEventListener("pointerup", (e) => {
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    cancelLongPress();
    if (drag.active) endDrag();
    else drag.pointerId = null;
  }, { passive: true });

  gridEl.addEventListener("pointercancel", (e) => {
    if (drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    cancelLongPress();
    if (drag.active) endDrag();
    else drag.pointerId = null;
  }, { passive: true });
}

function renderRoster() {
  const grid = $("unitGrid");
  if (!grid) return;

  const q = (state.q || "").toLowerCase();
  const elFilter = state.element;
  const rFilter = state.rarity;
  const tokens = state.listTokens;

  const filtered = state.units.filter((u) => {
    // List mode
    if (tokens && tokens.length) return unitMatchesTokens(u, tokens);

    // Normal mode
    if (elFilter !== "all" && String(u.element || "") !== elFilter) return false;
    if (rFilter !== "all" && String(u.rarity || "") !== rFilter) return false;

    if (q) {
      const hay = `${u.name || ""} ${u.title || ""} ${u.element || ""} ${u.rarity || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  setStatus(filtered.length);

  grid.innerHTML = filtered.map(renderUnitCard).join("");

  grid.querySelectorAll('input[data-owned-id]').forEach((cb) => {
    const id = cb.getAttribute("data-owned-id");
    cb.checked = state.owned.has(id);
    cb.addEventListener("change", () => {
      if (cb.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();
      setStatus(filtered.length);
    });
  });

  grid.querySelectorAll(".unitCard").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (drag.suppressNextClick) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.closest("label"))) return;
      toggleOwnedForCard(card);
      saveOwned();
      renderRoster();
    });
  });

  wireDragSelect(grid);
}

function applyListModeFromPaste(text) {
  const tokens = parseListTokens(text);
  if (!tokens) return false;

  state.listTokens = tokens;
  state.q = "";
  const inp = $("searchInput");
  if (inp) inp.value = text;

  renderRoster();

  const matches = state.units.filter(u => unitMatchesTokens(u, tokens));
  if (!matches.length) return true;

  const ok = window.confirm(`Found ${matches.length} matching units.\nAuto-select these as Owned?`);
  if (!ok) return true;

  for (const u of matches) state.owned.add(String(u.id));
  saveOwned();
  renderRoster();

  if (typeof window.refreshOptimizerFromOwned === "function") {
    try { window.refreshOptimizerFromOwned(); } catch {}
  }
  return true;
}

function wireControls() {
  const search = $("searchInput");
  const elSel = $("elementSelect");
  const rSel = $("raritySelect");
  const viewBtn = $("viewToggle");
  const deselectBtn = $("deselectAll");

  search?.addEventListener("input", () => {
    const v = search.value || "";
    const maybeList = parseListTokens(v);
    state.listTokens = maybeList;
    state.q = maybeList ? "" : v;
    renderRoster();
  });

  search?.addEventListener("paste", (e) => {
    const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    // Let paste happen, then interpret
    setTimeout(() => { applyListModeFromPaste(pasted); }, 0);
  });

  elSel?.addEventListener("change", () => {
    state.element = String(elSel.value || "all");
    state.listTokens = null;
    renderRoster();
  });

  rSel?.addEventListener("change", () => {
    state.rarity = String(rSel.value || "all");
    state.listTokens = null;
    renderRoster();
  });

  viewBtn?.addEventListener("click", () => {
    const cur = getMobileViewPref();
    const next = (cur === "compact") ? "detailed" : "compact";
    setMobileViewPref(next);
    applyMobileViewClass(next);
    syncViewToggleText();
  });

  deselectBtn?.addEventListener("click", () => {
    const ok = window.confirm("Deselect ALL owned units?");
    if (!ok) return;
    state.owned.clear();
    saveOwned();
    renderRoster();

    if (typeof window.refreshOptimizerFromOwned === "function") {
      try { window.refreshOptimizerFromOwned(); } catch {}
    }
  });

  window.addEventListener("resize", () => {
    applyMobileViewClass(getMobileViewPref());
  });
}

async function init() {
  state.owned = loadOwned();

  const view = getMobileViewPref();
  applyMobileViewClass(view);
  syncViewToggleText();

  await loadCharacters();
  wireControls();
  renderRoster();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    const status = $("statusText");
    if (status) status.textContent = `Error: ${String(err.message || err)}`;
  });
});

// ---------------------------------------------------------------------------
// Shared image state toggle helpers
//
// Optimizer/Catalog/Roster may render the 1/2/3 state buttons by calling a
// helper named `renderImageStateControls`. iOS Safari throws
// "Can't find variable: renderImageStateControls" if it's missing.
// Define it globally and add a delegated click handler.

function renderImageStateControls(u){
  if(!u || !Array.isArray(u.imagesLarge) || u.imagesLarge.length < 2) return "";
  const btns = u.imagesLarge
    .map((_, i) => `<button type="button" class="stateBtn ${i===0 ? 'active' : ''}" data-idx="${i}">${i+1}</button>`)
    .join("");
  return `<div class="stateRow" data-imgs='${JSON.stringify(u.imagesLarge)}'>${btns}</div>`;
}

// Expose globally
window.renderImageStateControls = renderImageStateControls;

// Delegated handler: swap the card image to the selected state
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".stateBtn");
  if(!btn) return;

  const row = btn.closest(".stateRow");
  if(!row) return;

  let imgs = [];
  try { imgs = JSON.parse(row.getAttribute("data-imgs") || "[]"); } catch(_) { imgs = []; }
  if(!imgs.length) return;

  const idx = Number.parseInt(btn.getAttribute("data-idx") || "0", 10);
  if(!Number.isFinite(idx) || idx < 0 || idx >= imgs.length) return;

  const card = row.closest(".unitCard, .slotCard, .card, .catalogCard, .gridCard") || row.parentElement;
  const img = card ? card.querySelector("img") : null;
  if(img) img.src = imgs[idx];

  row.querySelectorAll(".stateBtn").forEach((b) => b.classList.toggle("active", b===btn));
});
