/* app.js — WHOLE FILE
   Fixes:
   - Wires to current HTML ids: #viewToggle, #elementSelect, #raritySelect
   - View toggle works (Compact/Detailed)
   - De-dupe characters.json by id (prevents duplicate roster cards)
   - Owned: stored in localStorage (evertale_owned_units_v1)
   - Single tap on a card toggles Owned (except clicking checkbox)
   - Long-press + drag across cards toggles many quickly (each card once per drag)
   - Double-tap toggles "expanded" details in Compact mode (matches CSS expanded behavior)
*/

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_MOBILE_VIEW_KEY = "evertale_mobile_view_v1"; // "compact" | "detailed"

const state = {
  units: [],
  owned: new Set(),
  filters: { q: "", element: "all", rarity: "all" },
  view: "compact",
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

function el(id) { return document.getElementById(id); }

function loadOwned() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}

function getViewPref() {
  try {
    const v = localStorage.getItem(LS_MOBILE_VIEW_KEY);
    return (v === "detailed" || v === "compact") ? v : "compact";
  } catch {
    return "compact";
  }
}
function setViewPref(v) {
  try { localStorage.setItem(LS_MOBILE_VIEW_KEY, v); } catch {}
}

function applyViewClass(view) {
  document.body.classList.remove("mobile-compact", "mobile-detailed");
  document.body.classList.add(view === "detailed" ? "mobile-detailed" : "mobile-compact");
}

function setViewButtonText(view) {
  const btn = el("viewToggle");
  if (btn) btn.textContent = `View: ${view === "detailed" ? "Detailed" : "Compact"}`;
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
                     ${activeSkills
                       .slice(0, 4)
                       .map((s) => {
                         const nm = safeText(s.name);
                         const tu = s.tu != null ? ` • ${s.tu}TU` : "";
                         const sp = s.spirit != null ? ` • ${s.spirit}SP` : "";
                         const desc = safeText(s.description || "");
                         return `<strong>${nm}</strong>${tu}${sp}\n${desc}\n`;
                       })
                       .join("\n")}
                   </div>
                 </div>`
              : ``
          }

          ${
            passiveDetails.length
              ? `<div class="panel">
                   <div class="panelTitle">Passives</div>
                   <div class="muted" style="white-space:pre-wrap; line-height:1.25">
                     ${passiveDetails
                       .slice(0, 6)
                       .map((p) => {
                         const nm = safeText(p.name);
                         const desc = safeText(p.description);
                         return `<strong>${nm}</strong>\n${desc}\n`;
                       })
                       .join("\n")}
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

function cardFromPoint(x, y) {
  const elAt = document.elementFromPoint(x, y);
  if (!elAt) return null;
  return elAt.closest?.(".unitCard") || null;
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

function normalizeElementFilter(v) {
  const s = String(v || "").trim();
  if (!s || s.toLowerCase() === "all") return "all";
  return s.toLowerCase();
}
function normalizeRarityFilter(v) {
  const s = String(v || "").trim();
  if (!s || s.toLowerCase() === "all") return "all";
  return s.toLowerCase();
}

function renderRoster() {
  const grid = el("unitGrid");
  if (!grid) return;

  const q = (state.filters.q || "").toLowerCase().trim();
  const elFilter = normalizeElementFilter(state.filters.element);
  const rFilter = normalizeRarityFilter(state.filters.rarity);

  const filtered = state.units.filter((u) => {
    const uEl = String(u.element || "").toLowerCase();
    const uR = String(u.rarity || "").toLowerCase();

    if (elFilter !== "all" && uEl !== elFilter) return false;
    if (rFilter !== "all" && uR !== rFilter) return false;

    if (q) {
      const hay = `${u.name || ""} ${u.title || ""} ${u.element || ""} ${u.rarity || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const status = el("statusText");
  if (status) status.textContent = `${filtered.length} units shown`;

  grid.innerHTML = filtered.map(renderUnitCard).join("");

  // Apply owned + checkbox listeners
  grid.querySelectorAll("input[data-owned-id]").forEach((cb) => {
    const id = cb.getAttribute("data-owned-id");
    cb.checked = state.owned.has(id);

    cb.addEventListener("change", () => {
      if (cb.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();
    });
  });

  // Single tap: toggle owned. Double tap: expand details in compact mode.
  grid.querySelectorAll(".unitCard").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (dragState.suppressNextClick) return;

      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.closest("label"))) return;

      const now = Date.now();
      const last = Number(card.dataset.lastTap || "0");
      card.dataset.lastTap = String(now);

      // Double tap within 280ms toggles expanded (compact only)
      if ((now - last) < 280) {
        if (document.body.classList.contains("mobile-compact")) {
          card.classList.toggle("expanded");
        }
        return;
      }

      toggleOwnedForCard(card);
    });
  });

  wireDragSelect(grid);
}

function wireControls() {
  const search = el("searchInput");
  const elementSel = el("elementSelect");
  const raritySel = el("raritySelect");
  const viewBtn = el("viewToggle");

  search?.addEventListener("input", () => {
    state.filters.q = search.value || "";
    renderRoster();
  });

  elementSel?.addEventListener("change", () => {
    state.filters.element = elementSel.value || "all";
    renderRoster();
  });

  raritySel?.addEventListener("change", () => {
    state.filters.rarity = raritySel.value || "all";
    renderRoster();
  });

  viewBtn?.addEventListener("click", () => {
    state.view = (state.view === "compact") ? "detailed" : "compact";
    setViewPref(state.view);
    applyViewClass(state.view);
    setViewButtonText(state.view);

    // Collapse expanded cards when leaving compact
    if (state.view !== "compact") {
      document.querySelectorAll(".unitCard.expanded").forEach(c => c.classList.remove("expanded"));
    }
  });

  // Maintain view on resize/orientation changes
  window.addEventListener("resize", () => {
    applyViewClass(getViewPref());
  });
}

async function init() {
  state.owned = loadOwned();
  state.view = getViewPref();
  applyViewClass(state.view);
  setViewButtonText(state.view);

  await loadCharacters();

  // Initialize filter selects to defaults
  const elementSel = el("elementSelect");
  const raritySel = el("raritySelect");
  if (elementSel && !elementSel.value) elementSel.value = "all";
  if (raritySel && !raritySel.value) raritySel.value = "all";

  wireControls();
  renderRoster();

  // Let optimizer page refresh itself if it opened in another tab
  window.refreshOptimizerFromOwned?.();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    const status = el("statusText");
    if (status) status.textContent = `Error: ${String(err.message || err)}`;
  });
});
