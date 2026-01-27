/* app.js — WHOLE FILE
   Features:
   - Dedupes characters.json by id (prevents duplicate roster cards)
   - Tap anywhere on a card toggles Owned (except checkbox/label)
   - Long-press + drag multi-toggle Owned
   - View toggle button (Compact/Detailed) using body classes:
       body.mobile-compact / body.mobile-detailed
   - NEW: Paste list into search:
       - Filters to only pasted units
       - Prompts to auto-select Owned for matched units
*/

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_MOBILE_VIEW_KEY = "evertale_mobile_view_v1"; // "compact" | "detailed"

const state = {
  units: [],
  owned: new Set(),
  filters: {
    q: "",
    element: "all",
    rarity: "all",
    listTokens: null, // array of tokens when user pastes list
  },
};

// Drag-select state
const dragState = {
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

function loadOwned() {
  const arr = safeJsonParse(localStorage.getItem(LS_OWNED_KEY) || "[]", []);
  return new Set(Array.isArray(arr) ? arr.map(String) : []);
}
function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}
function updateOwnedCount() {
  const el = $("ownedCount");
  if (el) el.textContent = String(state.owned.size);
}

function getMobileViewPref() {
  const v = localStorage.getItem(LS_MOBILE_VIEW_KEY);
  return (v === "detailed" || v === "compact") ? v : "compact";
}
function setMobileViewPref(v) {
  localStorage.setItem(LS_MOBILE_VIEW_KEY, v);
}
function applyMobileViewClass(view) {
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

// Normalize to match pasted names reliably
function normKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")          // apostrophes
    .replace(/[^a-z0-9]+/g, " ")        // punctuation -> spaces
    .trim()
    .replace(/\s+/g, " ");             // collapse spaces
}

function parseListTokens(text) {
  // Split on newlines / commas / tabs / semicolons
  const raw = String(text ?? "");
  const parts = raw
    .split(/[\n\r,;\t]+/g)
    .map(s => s.trim())
    .filter(Boolean);

  // If it looks like a single normal search, don't treat as list mode
  if (parts.length <= 1) return null;

  // Normalize tokens, keep originals for exact compare too
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

function unitMatchesTokenList(u, tokens) {
  const id = normKey(u?.id);
  const name = normKey(u?.name);
  const title = normKey(u?.title);

  for (const t of tokens) {
    if (!t) continue;
    // exact match on id/name/title
    if (t === id || t === name || t === title) return true;

    // allow contains match for longer tokens (more forgiving)
    if (t.length >= 4) {
      if (name.includes(t) || title.includes(t)) return true;
    }
  }
  return false;
}

function renderUnitCard(unit) {
  const leaderName =
    unit.leaderSkill?.name && unit.leaderSkill.name !== "None"
      ? unit.leaderSkill.name
      : "No Leader Skill";

  const leaderDesc =
    unit.leaderSkill?.description && unit.leaderSkill.description !== "None"
      ? unit.leaderSkill.description
      : "This unit does not provide a leader skill.";

  const atk = unit.atk ?? unit.stats?.atk ?? "";
  const hp = unit.hp ?? unit.stats?.hp ?? "";
  const spd = unit.spd ?? unit.stats?.spd ?? "";
  const cost = unit.cost ?? unit.stats?.cost ?? "";

  const activeSkills = Array.isArray(unit.activeSkills) ? unit.activeSkills : [];
  const passiveDetails = Array.isArray(unit.passiveSkillDetails) ? unit.passiveSkillDetails : [];

  const img = unit.image
    ? `<img src="${unit.image}" alt="${safeText(unit.name)}">`
    : `<div class="ph">?</div>`;

  return `
    <div class="unitCard" data-unit-id="${safeText(unit.id)}">
      <div class="unitThumb">${img}</div>

      <div class="meta">
        <div class="topRow">
          <div>
            <div class="unitName">${safeText(unit.name)}</div>
            <div class="unitTitle">${safeText(unit.title)}</div>
          </div>

          <div class="tags">
            <span class="tag rarity">${safeText(unit.rarity)}</span>
            <span class="tag element">${safeText(unit.element)}</span>
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

          ${
            activeSkills.length
              ? `<div class="panel">
                   <div class="panelTitle">Active Skills</div>
                   <div class="muted" style="white-space:pre-wrap; line-height:1.25">
                     ${activeSkills.slice(0,4).map(s=>{
                       const nm=safeText(s.name);
                       const tu=s.tu!=null?` • ${s.tu}TU`:"";
                       const sp=s.spirit!=null?` • ${s.spirit}SP`:"";
                       const desc=safeText(s.description||"");
                       return `<strong>${nm}</strong>${tu}${sp}\n${desc}\n`;
                     }).join("\n")}
                   </div>
                 </div>`
              : ``
          }

          ${
            passiveDetails.length
              ? `<div class="panel">
                   <div class="panelTitle">Passives</div>
                   <div class="muted" style="white-space:pre-wrap; line-height:1.25">
                     ${passiveDetails.slice(0,6).map(p=>{
                       const nm=safeText(p.name);
                       const desc=safeText(p.description);
                       return `<strong>${nm}</strong>\n${desc}\n`;
                     }).join("\n")}
                   </div>
                 </div>`
              : ``
          }
        </div>

        <label class="ownedRow">
          <input class="ownedCheck" type="checkbox" data-owned-id="${safeText(unit.id)}">
          <span>Owned</span>
        </label>
      </div>
    </div>
  `;
}

function toggleOwnedForCard(cardEl) {
  const cb = cardEl?.querySelector?.("input[data-owned-id]");
  if (!cb) return;

  const id = cb.getAttribute("data-owned-id");
  cb.checked = !cb.checked;

  if (cb.checked) state.owned.add(id);
  else state.owned.delete(id);

  saveOwned();
  updateOwnedCount();
}

function cardFromPoint(x, y) {
  const elAt = document.elementFromPoint(x, y);
  if (!elAt) return null;
  return elAt.closest?.(".unitCard") || null;
}

function beginDragSelect() {
  dragState.active = true;
  dragState.toggledIds.clear();
  dragState.suppressNextClick = true;
}

function endDragSelect() {
  dragState.armed = false;
  dragState.active = false;
  dragState.pointerId = null;
  dragState.toggledIds.clear();
  if (dragState.timer) {
    clearTimeout(dragState.timer);
    dragState.timer = null;
  }
  setTimeout(() => { dragState.suppressNextClick = false; }, 0);
}

function armLongPress(startX, startY) {
  dragState.armed = true;
  dragState.startX = startX;
  dragState.startY = startY;

  if (dragState.timer) clearTimeout(dragState.timer);

  dragState.timer = setTimeout(() => {
    if (!dragState.armed || dragState.active) return;
    beginDragSelect();
    const c = cardFromPoint(dragState.lastX, dragState.lastY);
    if (c) dragToggleCardOnce(c);
  }, 280);
}

function cancelLongPress() {
  dragState.armed = false;
  if (dragState.timer) {
    clearTimeout(dragState.timer);
    dragState.timer = null;
  }
}

function dragToggleCardOnce(cardEl) {
  const id = cardEl.getAttribute("data-unit-id");
  if (!id) return;
  if (dragState.toggledIds.has(id)) return;
  dragState.toggledIds.add(id);
  toggleOwnedForCard(cardEl);
}

function wireDragSelect(gridEl) {
  if (gridEl.__dragWired) return;
  gridEl.__dragWired = true;

  gridEl.addEventListener("pointerdown", (e) => {
    const card = e.target?.closest?.(".unitCard");
    if (!card) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.closest("label"))) return;

    dragState.pointerId = e.pointerId;
    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;
    armLongPress(e.clientX, e.clientY);
  }, { passive: true });

  gridEl.addEventListener("pointermove", (e) => {
    if (dragState.pointerId != null && e.pointerId !== dragState.pointerId) return;

    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;

    if (!dragState.active && dragState.armed) {
      const dx = Math.abs(e.clientX - dragState.startX);
      const dy = Math.abs(e.clientY - dragState.startY);
      if (dx + dy > 10) cancelLongPress();
      return;
    }

    if (dragState.active) {
      const card = cardFromPoint(e.clientX, e.clientY);
      if (card) dragToggleCardOnce(card);
      e.preventDefault?.();
    }
  }, { passive: false });

  gridEl.addEventListener("pointerup", (e) => {
    if (dragState.pointerId != null && e.pointerId !== dragState.pointerId) return;
    cancelLongPress();
    if (dragState.active) endDragSelect();
    else dragState.pointerId = null;
  }, { passive: true });

  gridEl.addEventListener("pointercancel", (e) => {
    if (dragState.pointerId != null && e.pointerId !== dragState.pointerId) return;
    cancelLongPress();
    if (dragState.active) endDragSelect();
    else dragState.pointerId = null;
  }, { passive: true });
}

function renderRoster() {
  const grid = $("unitGrid");
  if (!grid) return;

  const q = (state.filters.q || "").toLowerCase();
  const elFilter = state.filters.element;
  const rFilter = state.filters.rarity;
  const tokens = state.filters.listTokens;

  const filtered = state.units.filter((u) => {
    // List mode (paste): only show matches
    if (tokens && tokens.length) {
      return unitMatchesTokenList(u, tokens);
    }

    // Normal mode
    if (elFilter !== "all" && String(u.element || "") !== elFilter) return false;
    if (rFilter !== "all" && String(u.rarity || "") !== rFilter) return false;

    if (q) {
      const hay = `${u.name || ""} ${u.title || ""} ${u.element || ""} ${u.rarity || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const status = $("statusText");
  if (status) {
    status.textContent = tokens?.length
      ? `${filtered.length} matched from pasted list`
      : `${filtered.length} units shown`;
  }

  grid.innerHTML = filtered.map(renderUnitCard).join("");

  grid.querySelectorAll("input[data-owned-id]").forEach((cb) => {
    const id = cb.getAttribute("data-owned-id");
    cb.checked = state.owned.has(id);

    cb.addEventListener("change", () => {
      if (cb.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();
      updateOwnedCount();
    });
  });

  grid.querySelectorAll(".unitCard").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (dragState.suppressNextClick) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.closest("label"))) return;
      toggleOwnedForCard(card);
    });
  });

  wireDragSelect(grid);
}

/* NEW: paste list handler (filters + optional auto-owned) */
function handleSearchPaste(e) {
  const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const tokens = parseListTokens(pasted);

  if (!tokens) return; // normal paste

  // Let the paste happen, then apply list mode
  setTimeout(() => {
    state.filters.listTokens = tokens;
    state.filters.q = ""; // list mode overrides normal q
    const inp = $("searchInput");
    if (inp) inp.value = pasted;
    renderRoster();

    const matches = state.units.filter(u => unitMatchesTokenList(u, tokens));
    if (!matches.length) return;

    const ok = window.confirm(`Found ${matches.length} matching units.\nApply these to Owned?`);
    if (!ok) return;

    for (const u of matches) state.owned.add(String(u.id));
    saveOwned();
    updateOwnedCount();
    renderRoster();

    // If optimizer page is open elsewhere, allow it to refresh
    if (typeof window.refreshOptimizerFromOwned === "function") {
      try { window.refreshOptimizerFromOwned(); } catch {}
    }
  }, 0);
}

function wireControls() {
  const search = $("searchInput");
  const elSel = $("elementSelect");
  const rSel = $("raritySelect");
  const viewBtn = $("viewToggle");

  search?.addEventListener("input", () => {
    // If user types (not pastes list), disable list mode unless the text still looks like a list
    const v = search.value || "";
    const maybeList = parseListTokens(v);
    state.filters.listTokens = maybeList;
    state.filters.q = maybeList ? "" : v;
    renderRoster();
  });

  search?.addEventListener("paste", handleSearchPaste);

  elSel?.addEventListener("change", () => {
    state.filters.element = String(elSel.value || "all");
    renderRoster();
  });

  rSel?.addEventListener("change", () => {
    state.filters.rarity = String(rSel.value || "all");
    renderRoster();
  });

  viewBtn?.addEventListener("click", () => {
    const cur = getMobileViewPref();
    const next = (cur === "compact") ? "detailed" : "compact";
    setMobileViewPref(next);
    applyMobileViewClass(next);
    syncViewToggleText();
  });

  window.addEventListener("resize", () => {
    // re-apply classes (helps with orientation changes)
    applyMobileViewClass(getMobileViewPref());
  });
}

async function init() {
  state.owned = loadOwned();
  updateOwnedCount();

  applyMobileViewClass(getMobileViewPref());
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