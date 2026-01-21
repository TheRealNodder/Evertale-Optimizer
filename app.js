/* app.js — Roster only (Optimizer lives in optimizer.html) */

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_VIEW_KEY = "evertale_mobile_view_v1"; // "compact" | "detailed"

const state = {
  units: [],
  owned: new Set(),
  filters: { q: "", element: "all", rarity: "all" },
};

const $ = (s) => document.querySelector(s);

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function loadOwned() {
  const arr = safeJsonParse(localStorage.getItem(LS_OWNED_KEY) || "[]", []);
  return new Set(Array.isArray(arr) ? arr : []);
}

function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}

function getViewPref() {
  const v = localStorage.getItem(LS_VIEW_KEY);
  return (v === "compact" || v === "detailed") ? v : "compact";
}

function setViewPref(v) {
  localStorage.setItem(LS_VIEW_KEY, v);
}

function applyViewClass() {
  const view = getViewPref();
  document.body.classList.remove("mobile-compact", "mobile-detailed");
  document.body.classList.add(view === "detailed" ? "mobile-detailed" : "mobile-compact");

  const btn = $("#viewToggle");
  if (btn) btn.textContent = view === "detailed" ? "View: Detailed" : "View: Compact";
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_CHARACTERS}: ${res.status}`);
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.characters)) return json.characters;
  throw new Error("characters.json must be an array OR { characters: [] }");
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

  const atk = unit.stats?.atk ?? unit.atk ?? "";
  const hp = unit.stats?.hp ?? unit.hp ?? "";
  const spd = unit.stats?.spd ?? unit.spd ?? "";
  const cost = unit.stats?.cost ?? unit.cost ?? "";

  const activeDetails = Array.isArray(unit.activeSkillDetails) ? unit.activeSkillDetails : [];
  const passiveDetails = Array.isArray(unit.passiveSkillDetails) ? unit.passiveSkillDetails : [];

  const img = unit.image
    ? `<img src="${unit.image}" alt="${safeText(unit.name)}">`
    : `<div class="ph">?</div>`;

  return `
    <div class="unitCard" data-unit-id="${unit.id}">
      <div class="unitThumb">${img}</div>

      <div class="meta">
        <div class="topRow">
          <div class="nameBlock">
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
            <div class="leaderName">${leaderName}</div>
            <div class="leaderDesc">${leaderDesc}</div>
          </div>

          ${
            activeDetails.length
              ? `<div class="panel">
                  <div class="panelTitle">Active Skills</div>
                  <div class="muted skillText">
                    ${activeDetails.slice(0, 4).map((s) => {
                      const nm = safeText(s.name);
                      const tu = s.tu != null ? ` • ${s.tu}TU` : "";
                      const sp = s.sp != null ? ` • ${s.sp}SP` : (s.spirit != null ? ` • ${s.spirit}SP` : "");
                      const desc = safeText(s.description);
                      return `<div class="skillLine"><strong>${nm}</strong>${tu}${sp}<div>${desc}</div></div>`;
                    }).join("")}
                  </div>
                </div>`
              : ``
          }

          ${
            passiveDetails.length
              ? `<div class="panel">
                  <div class="panelTitle">Passives</div>
                  <div class="muted skillText">
                    ${passiveDetails.slice(0, 6).map((p) => {
                      const nm = safeText(p.name);
                      const desc = safeText(p.description);
                      return `<div class="skillLine"><strong>${nm}</strong><div>${desc}</div></div>`;
                    }).join("")}
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

  // Owned checkboxes
  grid.querySelectorAll("input[data-owned-id]").forEach((cb) => {
    const id = cb.getAttribute("data-owned-id");
    cb.checked = state.owned.has(id);

    cb.addEventListener("change", () => {
      if (cb.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();
    });
  });

  // Compact: tap to expand (ignore clicks on checkbox row)
  grid.querySelectorAll(".unitCard").forEach((card) => {
    card.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.closest("label"))) return;
      if (document.body.classList.contains("mobile-compact")) {
        card.classList.toggle("expanded");
      }
    });
  });
}

async function init() {
  // View mode applies on desktop AND mobile
  applyViewClass();

  $("#viewToggle")?.addEventListener("click", () => {
    const cur = getViewPref();
    const next = cur === "compact" ? "detailed" : "compact";
    setViewPref(next);
    applyViewClass();
    document.querySelectorAll(".unitCard.expanded").forEach((c) => c.classList.remove("expanded"));
  });

  state.owned = loadOwned();

  $("#searchInput")?.addEventListener("input", (e) => { state.filters.q = e.target.value || ""; renderRoster(); });
  $("#elementSelect")?.addEventListener("change", (e) => { state.filters.element = e.target.value || "all"; renderRoster(); });
  $("#raritySelect")?.addEventListener("change", (e) => { state.filters.rarity = e.target.value || "all"; renderRoster(); });

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