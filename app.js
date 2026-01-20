/* app.js — Roster page (locked card layout + always-visible leader block) */
const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";

const state = {
  units: [],
  owned: new Set(),
  filters: { q: "", element: "all", rarity: "all", ownedOnly: false },
};

const $ = (s) => document.querySelector(s);

function loadOwned() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;
  throw new Error("ERROR LOADING characters.json is not an array");
}

function safeText(v, fallback="") { return v == null ? fallback : String(v); }

function leaderFrom(unit) {
  // supports leaderSkill as object OR string OR null
  const ls = unit.leaderSkill;
  if (!ls) return { name: "No Leader Skill", description: "This unit does not provide a leader skill." };
  if (typeof ls === "string") {
    const t = ls.trim();
    if (!t || t.toLowerCase() === "none" || t.toLowerCase() === "null")
      return { name: "No Leader Skill", description: "This unit does not provide a leader skill." };
    return { name: t, description: "" };
  }
  const name = safeText(ls.name, "No Leader Skill");
  const desc = safeText(ls.description, "");
  const bad = (s) => !s || String(s).trim().toLowerCase() === "none" || String(s).trim().toLowerCase() === "null";
  return {
    name: bad(name) ? "No Leader Skill" : name,
    description: bad(desc) ? "This unit does not provide a leader skill." : desc,
  };
}

function getImage(unit) {
  const img = unit.image || unit.icon || unit.portrait;
  return img ? String(img) : "";
}

function renderUnitCard(unit) {
  const { name: leaderName, description: leaderDesc } = leaderFrom(unit);
  const title = safeText(unit.title, "");
  const rarity = safeText(unit.rarity, "");
  const element = safeText(unit.element, "");
  const atk = unit.atk ?? unit.attack ?? null;
  const hp = unit.hp ?? unit.maxHp ?? null;
  const spd = unit.spd ?? unit.speed ?? null;
  const cost = unit.cost ?? null;

  const img = getImage(unit);
  const ph = safeText((unit.name || "?")[0], "?");

  return `
  <div class="unitCard" data-unit="${safeText(unit.id)}">
    <div class="unitThumb">
      ${img ? `<img loading="lazy" src="${img}" alt="${safeText(unit.name)}">` : `<div class="ph">${ph}</div>`}
    </div>

    <div class="meta">
      <div class="topRow">
        <div>
          <div class="unitName">${safeText(unit.name)}</div>
          <div class="unitTitle">${title}</div>
        </div>
        <div class="tags">
          ${rarity ? `<span class="tag rarity">${rarity}</span>` : ""}
          ${element ? `<span class="tag element">${element}</span>` : ""}
        </div>
      </div>

      <div class="statLine">
        ${atk != null ? `<span class="stat"><strong>ATK</strong> ${atk}</span>` : ""}
        ${hp != null ? `<span class="stat"><strong>HP</strong> ${hp}</span>` : ""}
        ${spd != null ? `<span class="stat"><strong>SPD</strong> ${spd}</span>` : ""}
        ${cost != null ? `<span class="stat"><strong>COST</strong> ${cost}</span>` : ""}
      </div>

      <div class="leaderBlock">
        <div class="leaderName">${leaderName}</div>
        <div class="leaderDesc">${leaderDesc}</div>
      </div>

      <label class="ownedRow">
        <input class="ownedCheck" type="checkbox" data-unit-id="${safeText(unit.id)}" />
        <span class="ownedLabel">Owned</span>
      </label>
    </div>
  </div>`;
}

function passesFilters(u) {
  const q = state.filters.q.trim().toLowerCase();
  if (q) {
    const hay = `${u.name||""} ${u.title||""} ${u.element||""} ${u.rarity||""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (state.filters.element !== "all" && String(u.element) !== state.filters.element) return false;
  if (state.filters.rarity !== "all" && String(u.rarity) !== state.filters.rarity) return false;
  if (state.filters.ownedOnly && !state.owned.has(String(u.id))) return false;
  return true;
}

function wireOwnedCheckboxes(root) {
  root.querySelectorAll("input[data-unit-id]").forEach((cb) => {
    const id = cb.getAttribute("data-unit-id");
    cb.checked = state.owned.has(id);
    cb.addEventListener("change", () => {
      if (cb.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();
      $("#statusText").textContent = `${state.owned.size} owned`;
      if (state.filters.ownedOnly) renderRoster();
    });
  });
}

function renderRoster() {
  const grid = $("#unitGrid");
  grid.innerHTML = "";
  const units = state.units.filter(passesFilters);
  const frag = document.createDocumentFragment();
  for (const u of units) {
    const wrap = document.createElement("div");
    wrap.innerHTML = renderUnitCard(u);
    frag.appendChild(wrap.firstElementChild);
  }
  grid.appendChild(frag);
  wireOwnedCheckboxes(grid);
  $("#statusText").textContent = `${units.length} shown • ${state.owned.size} owned`;
}

async function init() {
  state.owned = loadOwned();

  $("#searchInput")?.addEventListener("input", (e) => { state.filters.q = e.target.value; renderRoster(); });
  $("#elementFilter")?.addEventListener("change", (e) => { state.filters.element = e.target.value; renderRoster(); });
  $("#rarityFilter")?.addEventListener("change", (e) => { state.filters.rarity = e.target.value; renderRoster(); });
  $("#ownedOnly")?.addEventListener("change", (e) => { state.filters.ownedOnly = e.target.checked; renderRoster(); });

  try {
    state.units = await loadCharacters();
    renderRoster();
  } catch (err) {
    console.error(err);
    $("#unitGrid").textContent = String(err?.message || err);
  }
}

document.addEventListener("DOMContentLoaded", init);
