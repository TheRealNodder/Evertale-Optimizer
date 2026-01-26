/* app.js — WHOLE FILE
   Includes:
   - De-dupe characters.json by id (prevents duplicate roster cards)
   - Tap anywhere on card toggles Owned
   - Long-press + drag across cards toggles many quickly (each card once per drag)
   Notes:
   - Mobile compact/detailed classes are applied normally.
   - Desktop behavior is controlled by style.css media queries (recommended fix).
*/

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_MOBILE_VIEW_KEY = "evertale_mobile_view_v1"; // "compact" | "detailed"

const state = {
  units: [],
  owned: new Set(),
  filters: { q: "", element: "all", rarity: "all" },
  teamMode: "story", // "story" | "platoons"
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

const $ = (s) => document.querySelector(s);

function loadOwned() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}

function getMobileViewPref() {
  try { return localStorage.getItem(LS_MOBILE_VIEW_KEY) || "compact"; }
  catch { return "compact"; }
}
function setMobileViewPref(v) {
  try { localStorage.setItem(LS_MOBILE_VIEW_KEY, v); } catch {}
}

function applyMobileViewClass(view) {
  document.body.classList.remove("mobile-compact", "mobile-detailed");
  if (view === "detailed") document.body.classList.add("mobile-detailed");
  else document.body.classList.add("mobile-compact");
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
    <div class="unitCard" data-unit-id="${unit.id}">
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
          <input class="ownedCheck" type="checkbox" data-owned-id="${unit.id}">
          <span>Owned</span>
        </label>
      </div>
    </div>
  `;
}

function updateOwnedCount() {
  const n = state.owned.size;
  const el = $("#ownedCount");
  if (el) el.textContent = String(n);
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
  const grid = $("#unitGrid");
  if (!grid) return;

  const q = (state.filters.q || "").toLowerCase();
  const elFilter = state.filters.element;
  const rFilter = state.filters.rarity;

  const filtered = state.units.filter((u) => {
    if (elFilter !== "all" && String(u.element || "").toLowerCase() !== elFilter) return false;
    if (rFilter !== "all" && String(u.rarity || "").toLowerCase() !== rFilter) return false;
    if (q) {
      const hay = `${u.name || ""} ${u.title || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const status = $("#statusText");
  if (status) status.textContent = `${filtered.length} units shown`;

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

function showPage(which) {
  const roster = $("#pageRoster");
  const opt = $("#pageOptimizer");
  const tabRoster = $("#tabRoster");
  const tabOpt = $("#tabOptimizer");

  if (!roster || !opt) return;

  if (which === "optimizer") {
    roster.classList.add("hidden");
    opt.classList.remove("hidden");
    tabRoster?.classList.remove("active");
    tabOpt?.classList.add("active");
    renderOptimizerLayout();
  } else {
    opt.classList.add("hidden");
    roster.classList.remove("hidden");
    tabOpt?.classList.remove("active");
    tabRoster?.classList.add("active");
  }
}

function setTeamMode(mode) {
  state.teamMode = mode;
  const storyBtn = $("#teamModeStory");
  const platBtn = $("#teamModePlatoons");
  if (storyBtn && platBtn) {
    if (mode === "platoons") {
      storyBtn.classList.remove("active");
      platBtn.classList.add("active");
    } else {
      platBtn.classList.remove("active");
      storyBtn.classList.add("active");
    }
  }
}

function renderOptimizerLayout() {
  const wrap = $("#optimizerArea");
  if (!wrap) return;

  const ownedUnits = state.units.filter((u) => state.owned.has(String(u.id)));
  const mode = state.teamMode;

  wrap.innerHTML = `
    <div class="panel">
      <div class="panelTitle">${mode === "platoons" ? "Platoons (20 × 5)" : "Story Team (5 + 3)"}</div>
      <div class="muted">${ownedUnits.length} owned units available</div>
      <div class="muted" style="margin-top:6px;">Use the dedicated Optimizer page for full logic.</div>
      <a class="btn" href="./optimizer.html" style="margin-top:10px; display:inline-block; text-decoration:none;">Go to Optimizer</a>
    </div>
  `;
}

function wireRosterControls() {
  const q = $("#searchInput");
  const elSel = $("#filterElement");
  const rSel = $("#filterRarity");

  q?.addEventListener("input", () => {
    state.filters.q = q.value || "";
    renderRoster();
  });

  elSel?.addEventListener("change", () => {
    state.filters.element = String(elSel.value || "all");
    renderRoster();
  });

  rSel?.addEventListener("change", () => {
    state.filters.rarity = String(rSel.value || "all");
    renderRoster();
  });

  const viewBtn = $("#mobileViewBtn");
  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      const cur = getMobileViewPref();
      const next = cur === "compact" ? "detailed" : "compact";
      setMobileViewPref(next);
      applyMobileViewClass(next);
      viewBtn.textContent = `View: ${next === "compact" ? "Compact" : "Detailed"}`;
    });
  }

  // Re-apply on resize/rotation (keeps orientation changes stable)
  window.addEventListener("resize", () => {
    applyMobileViewClass(getMobileViewPref());
  });

  $("#goToOptimizerBtn")?.addEventListener("click", () => showPage("optimizer"));
  $("#tabRoster")?.addEventListener("click", () => showPage("roster"));
  $("#tabOptimizer")?.addEventListener("click", () => showPage("optimizer"));

  $("#teamModeStory")?.addEventListener("click", () => setTeamMode("story"));
  $("#teamModePlatoons")?.addEventListener("click", () => setTeamMode("platoons"));
}

async function init() {
  state.owned = loadOwned();
  updateOwnedCount();

  const view = getMobileViewPref();
  applyMobileViewClass(view);

  const viewBtn = $("#mobileViewBtn");
  if (viewBtn) viewBtn.textContent = `View: ${view === "compact" ? "Compact" : "Detailed"}`;

  await loadCharacters();
  wireRosterControls();
  renderRoster();
  showPage("roster");
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err) => {
    console.error(err);
    const status = $("#statusText");
    if (status) status.textContent = `Error: ${String(err.message || err)}`;
  });
});
