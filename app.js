/* app.js — Roster + Optimizer (owned sync via localStorage) */

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";

const state = {
  units: [],
  owned: new Set(),
  filters: { q: "", element: "all", rarity: "all", ownedOnly: false },
};

const $ = (s) => document.querySelector(s);

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function loadOwned() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_CHARACTERS} (${res.status})`);
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;
  throw new Error("ERROR LOADING characters.json is not an array");
}

/* ---------------- Card HTML (LOCKED leader block always visible) ---------------- */
function renderUnitCardHTML(unit) {
  const imgHtml = unit.image
    ? `<img src="${unit.image}" alt="${unit.name}" loading="lazy">`
    : `<div class="ph">${(unit.name || "?").slice(0, 1).toUpperCase()}</div>`;

  const leaderName =
    unit.leaderSkill?.name && unit.leaderSkill.name !== "None"
      ? unit.leaderSkill.name
      : "No Leader Skill";

  const leaderDesc =
    unit.leaderSkill?.description && unit.leaderSkill.description !== "None"
      ? unit.leaderSkill.description
      : "This unit does not provide a leader skill.";

  const atk = safeNum(unit.atk);
  const hp  = safeNum(unit.hp);
  const spd = safeNum(unit.spd);
  const cost = safeNum(unit.cost);

  const checked = state.owned.has(unit.id) ? "checked" : "";

  return `
    <div class="unitCard" data-unit-id="${unit.id}">
      <div class="unitThumb">${imgHtml}</div>

      <div class="meta">
        <div class="nameRow">
          <div>
            <div class="unitName">${unit.name ?? ""}</div>
            <div class="unitSub">${unit.secondaryName ?? unit.title ?? ""}</div>
          </div>

          <div class="tags">
            <span class="tag rarity">${unit.rarity ?? ""}</span>
            <span class="tag element">${unit.element ?? ""}</span>
          </div>
        </div>

        <div class="statLine">
          <div class="stat"><strong>ATK:</strong> ${atk}</div>
          <div class="stat"><strong>HP:</strong> ${hp}</div>
          <div class="stat"><strong>SPD:</strong> ${spd}</div>
          <div class="stat"><strong>COST:</strong> ${cost}</div>
        </div>

        <div class="leaderBlock">
          <div class="leaderName">${leaderName}</div>
          <div class="leaderDesc">${leaderDesc}</div>
        </div>

        <label class="ownedRow">
          <input class="ownedCheck" type="checkbox" data-owned-id="${unit.id}" ${checked}>
          <span class="ownedLabel">Owned</span>
        </label>
      </div>
    </div>
  `;
}

/* ---------------- Roster page ---------------- */
function applyRosterFilters(units) {
  const q = (state.filters.q || "").trim().toLowerCase();
  const el = state.filters.element;
  const r = state.filters.rarity;
  const ownedOnly = !!state.filters.ownedOnly;

  return units.filter((u) => {
    if (ownedOnly && !state.owned.has(u.id)) return false;
    if (el !== "all" && (u.element || "") !== el) return false;
    if (r !== "all" && (u.rarity || "") !== r) return false;

    if (!q) return true;
    const hay = `${u.name ?? ""} ${u.secondaryName ?? ""} ${u.title ?? ""} ${u.element ?? ""} ${u.rarity ?? ""} ${u.leaderSkill?.name ?? ""} ${u.leaderSkill?.description ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderRoster() {
  const grid = $("#unitGrid");
  if (!grid) return;

  const filtered = applyRosterFilters(state.units);

  $("#statusText").textContent = `Showing ${filtered.length} / ${state.units.length}`;

  grid.innerHTML = filtered.map(renderUnitCardHTML).join("");

  // wire owned checkboxes
  grid.querySelectorAll("input[data-owned-id]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-owned-id");
      if (!id) return;
      if (cb.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();
    });
  });
}

function initRosterPage() {
  $("#searchInput")?.addEventListener("input", (e) => {
    state.filters.q = e.target.value || "";
    renderRoster();
  });

  $("#elementSelect")?.addEventListener("change", (e) => {
    state.filters.element = e.target.value;
    renderRoster();
  });

  $("#raritySelect")?.addEventListener("change", (e) => {
    state.filters.rarity = e.target.value;
    renderRoster();
  });

  $("#ownedOnly")?.addEventListener("change", (e) => {
    state.filters.ownedOnly = !!e.target.checked;
    renderRoster();
  });

  renderRoster();
}

/* ---------------- Optimizer page ---------------- */
function scoreUnit(u) {
  // baseline score
  const atk = safeNum(u.atk);
  const hp  = safeNum(u.hp);
  const spd = safeNum(u.spd);
  const cost = safeNum(u.cost);
  return atk * 1 + hp * 0.08 + spd * 2 - cost * 0.8;
}

function leaderBoostScore(u, strategy, monoElement) {
  // very lightweight: prefer units that have a leader skill that mentions the chosen element or “Attack”
  if (strategy !== "leader") return 0;

  const name = (u.leaderSkill?.name || "").toLowerCase();
  const desc = (u.leaderSkill?.description || "").toLowerCase();
  let bonus = 0;

  if (monoElement) {
    const el = monoElement.toLowerCase();
    if (name.includes(el) || desc.includes(el)) bonus += 50;
  }
  if (name.includes("atk") || desc.includes("attack")) bonus += 25;
  if (desc.includes("max hp") || desc.includes("hp")) bonus += 10;

  return bonus;
}

function pickBestTeam(ownedUnits, opts) {
  const {
    teamType,            // story | platoon
    strategy,            // rainbow | mono
    monoElement,         // element string
    synergyMode,         // leader | raw
    maxCost,             // number or 0
  } = opts;

  const slots = teamType === "story" ? 7 : 5;

  let pool = ownedUnits.slice();

  if (strategy === "mono") {
    pool = pool.filter(u => (u.element || "") === monoElement);
  }

  // rank by composite score
  const ranked = pool
    .map(u => ({
      u,
      s: scoreUnit(u) + leaderBoostScore(u, synergyMode, strategy === "mono" ? monoElement : null),
    }))
    .sort((a, b) => b.s - a.s);

  const picked = [];
  const used = new Set();
  let totalCost = 0;

  for (const { u } of ranked) {
    if (picked.length >= slots) break;
    if (used.has(u.id)) continue;

    const c = safeNum(u.cost);
    if (maxCost > 0 && totalCost + c > maxCost) continue;

    picked.push(u);
    used.add(u.id);
    totalCost += c;
  }

  return picked;
}

function renderTeam(team) {
  const wrap = $("#teamSlots");
  if (!wrap) return;

  wrap.innerHTML = team.map((u, idx) => {
    return `
      <div class="slot">
        <div class="slotTitle">Slot ${idx + 1}</div>
        ${renderUnitCardHTML(u)}
      </div>
    `;
  }).join("");

  // remove “Owned” checkbox interactions inside optimizer slots (display only)
  wrap.querySelectorAll("input[data-owned-id]").forEach((cb) => {
    cb.disabled = true;
  });

  const avg = (k) => team.length ? Math.round(team.reduce((a,x)=>a+safeNum(x[k]),0)/team.length) : 0;

  $("#sumUnits").textContent = String(team.length);
  $("#sumCost").textContent  = String(team.reduce((a,x)=>a+safeNum(x.cost),0));
  $("#sumAtk").textContent   = String(avg("atk"));
  $("#sumHp").textContent    = String(avg("hp"));
  $("#sumSpd").textContent   = String(avg("spd"));
}

function initOptimizerPage() {
  const monoRow = $("#monoElementRow");
  const strategySel = $("#strategy");
  const updateMonoRow = () => {
    const v = strategySel?.value || "rainbow";
    if (!monoRow) return;
    monoRow.classList.toggle("hidden", v !== "mono");
  };
  strategySel?.addEventListener("change", updateMonoRow);
  updateMonoRow();

  const refreshOwned = () => {
    state.owned = loadOwned();
    const ownedCount = state.owned.size;
    $("#ownedCountText").textContent = `Owned units: ${ownedCount}`;
  };

  $("#refreshOwned")?.addEventListener("click", refreshOwned);

  $("#buildTeam")?.addEventListener("click", () => {
    refreshOwned();

    const ownedUnits = state.units.filter(u => state.owned.has(u.id));
    const teamType = $("#teamType")?.value || "story";
    const strategy = $("#strategy")?.value || "rainbow";
    const monoElement = $("#monoElement")?.value || "Fire";
    const synergyMode = $("#synergyMode")?.value || "leader";
    const maxCost = safeNum($("#maxCost")?.value || 0);

    const team = pickBestTeam(ownedUnits, { teamType, strategy, monoElement, synergyMode, maxCost });
    renderTeam(team);
  });

  refreshOwned();
  renderTeam([]);
}

/* ---------------- Boot ---------------- */
async function boot() {
  state.owned = loadOwned();

  try {
    state.units = await loadCharacters();
  } catch (e) {
    console.error(e);
    $("#statusText") && ($("#statusText").textContent = e.message);
    return;
  }

  const page = document.body.getAttribute("data-page");
  if (page === "optimizer") initOptimizerPage();
  else initRosterPage();
}

document.addEventListener("DOMContentLoaded", boot);