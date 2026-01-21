/* app.js — REPLACE ENTIRE FILE WITH THIS */

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_MOBILE_VIEW_KEY = "evertale_mobile_view_v1"; // "compact" | "detailed"

const state = {
  units: [],
  owned: new Set(),
  filters: { q: "", element: "all", rarity: "all" },
  teamMode: "story", // "story" | "platoons"
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

  // supports: [ ... ] OR { characters: [ ... ] }
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;

  throw new Error("characters.json must be an array OR an object with { characters: [] }");
}

function safeText(v, fallback = "") {
  return v == null ? fallback : String(v);
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

  const atk = unit.atk ?? "";
  const hp = unit.hp ?? "";
  const spd = unit.spd ?? "";
  const cost = unit.cost ?? "";

  const activeSkills = Array.isArray(unit.activeSkills) ? unit.activeSkills : [];
  const passiveDetails = Array.isArray(unit.passiveSkillDetails) ? unit.passiveSkillDetails : [];

  const img = unit.image ? `<img src="${unit.image}" alt="${safeText(unit.name)}">` : `<div class="ph">?</div>`;

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

          <!-- LEADER SKILL: ALWAYS RENDERED -->
          <div class="leaderBlock">
            <div class="leaderName">${leaderName}</div>
            <div class="leaderDesc">${leaderDesc}</div>
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
                         const desc = s.description ? `\n${s.description}` : "";
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

function renderRoster() {
  const grid = $("#unitGrid");
  if (!grid) return;

  const q = (state.filters.q || "").toLowerCase();
  const element = state.filters.element || "all";
  const rarity = state.filters.rarity || "all";

  const filtered = (state.units || []).filter((u) => {
    const hay = `${u.name || ""} ${u.title || ""} ${u.element || ""} ${u.rarity || ""}`.toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (element !== "all" && (u.element || "") !== element) return false;
    if (rarity !== "all" && (u.rarity || "") !== rarity) return false;
    return true;
  });

  $("#statusText").textContent = `${filtered.length} units shown`;

  grid.innerHTML = filtered.map(renderUnitCard).join("");

  // Apply owned + listeners
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

  // Compact mode: tap card expands (ignore checkbox clicks)
  grid.querySelectorAll(".unitCard").forEach((card) => {
    card.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.closest("label"))) return;
      card.classList.toggle("expanded");
    });
  });
}

function updateOwnedCount() {
  const n = state.owned.size;
  const el = $("#ownedCount");
  if (el) el.textContent = String(n);
}

function showPage(which) {
  const roster = $("#pageRoster");
  const opt = $("#pageOptimizer");
  const tabRoster = $("#tabRoster");
  const tabOpt = $("#tabOptimizer");

  if (which === "optimizer") {
    roster.classList.add("hidden");
    opt.classList.remove("hidden");
    tabRoster.classList.remove("active");
    tabOpt.classList.add("active");
    renderOptimizerLayout();
  } else {
    opt.classList.add("hidden");
    roster.classList.remove("hidden");
    tabOpt.classList.remove("active");
    tabRoster.classList.add("active");
  }
}

function setTeamMode(mode) {
  state.teamMode = mode;
  $("#modeStory").classList.toggle("active", mode === "story");
  $("#modePlatoons").classList.toggle("active", mode === "platoons");
  renderOptimizerLayout();
}

function ownedUnitsArray() {
  const map = new Map(state.units.map(u => [u.id, u]));
  return [...state.owned].map(id => map.get(id)).filter(Boolean);
}

/* Layout only (not full optimizer brain yet) */
function renderOptimizerLayout() {
  const wrap = $("#optimizerArea");
  if (!wrap) return;

  const owned = ownedUnitsArray();

  if (state.teamMode === "story") {
    wrap.innerHTML = `
      <div class="panel">
        <div class="panelTitle">Story Team</div>
        <div class="muted">Main: 5 units • Backup: 3 units</div>
        <div class="panel" style="margin-top:10px">
          <div class="panelTitle">Owned Pool (for optimizer)</div>
          <div class="muted">${owned.length} owned units available</div>
        </div>
      </div>
    `;
  } else {
    wrap.innerHTML = `
      <div class="panel">
        <div class="panelTitle">Platoons</div>
        <div class="muted">20 platoons • 5 units each</div>
        <div class="panel" style="margin-top:10px">
          <div class="panelTitle">Owned Pool (for optimizer)</div>
          <div class="muted">${owned.length} owned units available</div>
        </div>
      </div>
    `;
  }
}

async function init() {
  // mobile view mode
  let mobileView = getMobileViewPref();
  applyMobileViewClass(mobileView);
  const viewBtn = $("#mobileViewToggle");
  if (viewBtn) {
    viewBtn.textContent = mobileView === "detailed" ? "Mobile: Detailed" : "Mobile: Compact";
    viewBtn.addEventListener("click", () => {
      mobileView = mobileView === "detailed" ? "compact" : "detailed";
      setMobileViewPref(mobileView);
      applyMobileViewClass(mobileView);
      viewBtn.textContent = mobileView === "detailed" ? "Mobile: Detailed" : "Mobile: Compact";
      document.querySelectorAll(".unitCard.expanded").forEach((c) => c.classList.remove("expanded"));
    });
  }

  // owned
  state.owned = loadOwned();
  updateOwnedCount();

  // filters
  $("#searchInput")?.addEventListener("input", (e) => {
    state.filters.q = e.target.value || "";
    renderRoster();
  });
  $("#elementSelect")?.addEventListener("change", (e) => {
    state.filters.element = e.target.value || "all";
    renderRoster();
  });
  $("#raritySelect")?.addEventListener("change", (e) => {
    state.filters.rarity = e.target.value || "all";
    renderRoster();
  });

  // navigation
  $("#tabRoster")?.addEventListener("click", () => showPage("roster"));
  $("#tabOptimizer")?.addEventListener("click", () => showPage("optimizer"));
  $("#goOptimizer")?.addEventListener("click", () => showPage("optimizer"));
  $("#backToRoster")?.addEventListener("click", () => showPage("roster"));

  // optimizer mode
  $("#modeStory")?.addEventListener("click", () => setTeamMode("story"));
  $("#modePlatoons")?.addEventListener("click", () => setTeamMode("platoons"));

  // placeholder build button
  $("#buildBestTeam")?.addEventListener("click", () => {
    alert("Build Best Team is a placeholder right now. Layout is ready; optimizer brain comes next.");
  });

  // load data + render
  try {
    state.units = await loadCharacters();
    renderRoster();
  } catch (err) {
    console.error(err);
    $("#statusText").textContent = "ERROR loading characters.json";
    $("#unitGrid").innerHTML = `<div class="panel"><div class="panelTitle">Error</div><div class="muted">${safeText(err.message)}</div></div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);