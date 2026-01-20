const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";

const state = {
  units: [],
  owned: new Set(),
  query: ""
};

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
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;
  throw new Error("characters.json is not an array");
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

  return `
    <div class="unitCard">
      <div class="unitThumb">
        <img src="${unit.image}" alt="${unit.name}">
      </div>

      <div class="meta">
        <div class="unitName">${unit.name}</div>
        <div class="unitSub">${unit.secondaryName || ""}</div>

        <div class="tags">
          <span class="tag rarity">${unit.rarity}</span>
          <span class="tag">${unit.element}</span>
        </div>

        <div class="leaderBlock">
          <div class="leaderName">${leaderName}</div>
          <div class="leaderDesc">${leaderDesc}</div>
        </div>

        <label class="ownedRow">
          <input type="checkbox"
            ${state.owned.has(unit.id) ? "checked" : ""}
            data-id="${unit.id}">
          Owned
        </label>
      </div>
    </div>
  `;
}

function renderRoster() {
  const grid = document.getElementById("unitGrid");
  grid.innerHTML = "";

  const q = state.query.toLowerCase();

  state.units
    .filter(u =>
      !q ||
      `${u.name} ${u.secondaryName || ""}`.toLowerCase().includes(q)
    )
    .forEach(u => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderUnitCard(u);
      const card = wrapper.firstElementChild;

      const checkbox = card.querySelector("input[type=checkbox]");
      checkbox.addEventListener("change", () => {
        checkbox.checked
          ? state.owned.add(u.id)
          : state.owned.delete(u.id);
        saveOwned();
      });

      grid.appendChild(card);
    });
}

async function init() {
  state.owned = loadOwned();

  document.getElementById("searchInput")
    .addEventListener("input", e => {
      state.query = e.target.value;
      renderRoster();
    });

  try {
    state.units = await loadCharacters();
    renderRoster();
  } catch (err) {
    console.error(err);
    document.getElementById("unitGrid").textContent =
      "Failed to load characters.json";
  }
}

document.addEventListener("DOMContentLoaded", init);