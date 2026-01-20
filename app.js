/* app.js — ROSTER + LEADER SKILL MERGE (FULL FILE) */

const DATA_CHARACTERS = "./data/characters.json";
const DATA_LEADER_SKILLS = "./data/leader_skills.json";

const LS_OWNED_KEY = "evertale_owned_units_v1";

const state = {
  units: [],
  owned: new Set(),
  filters: { q: "", element: "all", rarity: "all" },
};

const $ = (s) => document.querySelector(s);

/* ---------------- Utilities ---------------- */
function safeText(v, fallback = "") {
  if (v === undefined || v === null) return fallback;
  return String(v);
}

function normalizeKey(s) {
  return safeText(s)
    .toLowerCase()
    .trim()
    // unify separators
    .replace(/[_/]+/g, " ")
    .replace(/[-]+/g, " ")
    // drop punctuation
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    // collapse spaces
    .replace(/\s+/g, " ")
    .trim();
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

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

/* ---------------- Loaders ---------------- */
async function loadCharacters() {
  const json = await fetchJson(DATA_CHARACTERS);
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;
  throw new Error("characters.json is not an array (expected [] or {characters:[]})");
}

async function loadLeaderSkills() {
  const json = await fetchJson(DATA_LEADER_SKILLS);

  // Accept formats:
  // 1) [{unitName, leaderSkillName, leaderSkillDesc}, ...]
  // 2) { leaderSkills: [{...}] }
  // 3) { skills: [{...}] }
  // 4) { "<unitName>": { name, description } }
  if (Array.isArray(json)) return json;

  if (json && Array.isArray(json.leaderSkills)) return json.leaderSkills;
  if (json && Array.isArray(json.skills)) return json.skills;

  // key-value map
  if (json && typeof json === "object") {
    const arr = [];
    for (const [k, v] of Object.entries(json)) {
      if (!v) continue;
      arr.push({
        unitName: k,
        name: v.name ?? v.leaderName ?? v.leaderSkillName ?? "None",
        description: v.description ?? v.desc ?? v.leaderSkillDesc ?? "None",
      });
    }
    return arr;
  }

  return [];
}

/* ---------------- Merge logic ---------------- */
function buildLeaderSkillIndex(lsArr) {
  // Create a Map from normalized unit name -> {name, description}
  const idx = new Map();

  for (const raw of lsArr) {
    // try multiple possible field names
    const unitName =
      raw.unitName ??
      raw.characterName ??
      raw.nameOfUnit ??
      raw.unit ??
      raw.owner ??
      raw.sourceUnit ??
      raw.character ??
      raw.name ??
      "";

    // leader skill fields
    const lsName =
      raw.leaderSkillName ??
      raw.leaderName ??
      raw.skillName ??
      raw.name ??
      raw.title ??
      raw.lsName ??
      "None";

    const lsDesc =
      raw.leaderSkillDesc ??
      raw.leaderSkillDescription ??
      raw.description ??
      raw.desc ??
      raw.text ??
      raw.lsDesc ??
      "None";

    const key = normalizeKey(unitName);
    if (!key) continue;

    idx.set(key, {
      name: safeText(lsName, "None"),
      description: safeText(lsDesc, "None"),
    });
  }

  return idx;
}

function mergeLeaderSkillsIntoCharacters(chars, leaderIdx) {
  return chars.map((c) => {
    const primaryName = c.name ?? c.unitName ?? c.title ?? "";
    const secondaryName = c.secondaryName ?? c.handle ?? c.subtitle ?? "";

    const key1 = normalizeKey(primaryName);
    const key2 = normalizeKey(secondaryName);
    const key3 = normalizeKey(`${primaryName} ${secondaryName}`);

    // If character already has a leaderSkill object and it is not null-ish, keep it
    const existing = c.leaderSkill;
    const existingName = existing?.name ?? existing?.leaderSkillName ?? null;
    const existingDesc = existing?.description ?? existing?.leaderSkillDesc ?? null;

    let mergedLeaderSkill = null;

    // Prefer existing if it’s non-empty and not "None"
    if (existing && (existingName || existingDesc) && existingName !== "None") {
      mergedLeaderSkill = {
        name: safeText(existingName, "None"),
        description: safeText(existingDesc, "None"),
      };
    } else {
      // Try matching leader skills by name keys
      const hit =
        leaderIdx.get(key1) ||
        (key2 ? leaderIdx.get(key2) : null) ||
        leaderIdx.get(key3) ||
        null;

      mergedLeaderSkill = hit
        ? { name: safeText(hit.name, "None"), description: safeText(hit.description, "None") }
        : { name: "None", description: "None" };
    }

    return {
      ...c,
      // normalize naming fields for UI
      name: safeText(c.name ?? c.unitName ?? c.title, ""),
      secondaryName: safeText(c.secondaryName ?? c.handle ?? c.subtitle, ""),
      leaderSkill: mergedLeaderSkill,
    };
  });
}

/* ---------------- Rendering ---------------- */
function escapeHtml(s) {
  return safeText(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function renderUnitCard(unit) {
  const img = unit.image
    ? `<img src="${escapeHtml(unit.image)}" alt="${escapeHtml(unit.name)}" loading="lazy">`
    : `<div class="ph">${escapeHtml(unit.name?.slice(0, 1)?.toUpperCase() || "?")}</div>`;

  const rarity = escapeHtml(unit.rarity ?? "");
  const element = escapeHtml(unit.element ?? "");

  const leaderName =
    unit.leaderSkill?.name && unit.leaderSkill.name !== "None"
      ? escapeHtml(unit.leaderSkill.name)
      : "No Leader Skill";

  const leaderDesc =
    unit.leaderSkill?.description && unit.leaderSkill.description !== "None"
      ? escapeHtml(unit.leaderSkill.description)
      : "This unit does not provide a leader skill.";

  const checked = state.owned.has(String(unit.id)) ? "checked" : "";

  return `
    <div class="unitCard" data-unit="${escapeHtml(unit.id)}">
      <div class="unitThumb">${img}</div>

      <div class="meta">
        <div class="topRow">
          <div>
            <div class="unitName">${escapeHtml(unit.name)}</div>
            <div class="unitTitle">${escapeHtml(unit.secondaryName || "")}</div>
          </div>

          <div class="tags">
            ${rarity ? `<span class="tag rarity">${rarity}</span>` : ""}
            ${element ? `<span class="tag element">${element}</span>` : ""}
          </div>
        </div>

        <!-- LEADER SKILL ALWAYS RENDERED -->
        <div class="leaderBlock">
          <div class="leaderName">${leaderName}</div>
          <div class="leaderDesc">${leaderDesc}</div>
        </div>

        <label class="ownedRow">
          <input class="ownedCheck" type="checkbox" data-owned-id="${escapeHtml(unit.id)}" ${checked}>
          <span class="ownedLabel">Owned</span>
        </label>
      </div>
    </div>
  `;
}

function applyFilters(list) {
  const q = state.filters.q.trim().toLowerCase();
  const el = state.filters.element;
  const r = state.filters.rarity;

  return list.filter((u) => {
    if (el !== "all" && safeText(u.element).toLowerCase() !== el) return false;
    if (r !== "all" && safeText(u.rarity).toLowerCase() !== r) return false;

    if (!q) return true;
    const hay = `${u.name} ${u.secondaryName} ${u.element} ${u.rarity}`.toLowerCase();
    return hay.includes(q);
  });
}

function wireOwnedHandlers() {
  document.querySelectorAll("input[data-owned-id]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = cb.getAttribute("data-owned-id");
      if (!id) return;

      if (cb.checked) state.owned.add(String(id));
      else state.owned.delete(String(id));

      saveOwned();
    });
  });
}

function renderRoster() {
  const grid = $("#unitGrid");
  if (!grid) return;

  const filtered = applyFilters(state.units);
  grid.innerHTML = filtered.map(renderUnitCard).join("");
  wireOwnedHandlers();
}

/* ---------------- Init ---------------- */
async function init() {
  state.owned = loadOwned();

  $("#searchInput")?.addEventListener("input", (e) => {
    state.filters.q = e.target.value || "";
    renderRoster();
  });

  // Optional filters if you have them in HTML:
  $("#elementSelect")?.addEventListener("change", (e) => {
    state.filters.element = (e.target.value || "all").toLowerCase();
    renderRoster();
  });
  $("#raritySelect")?.addEventListener("change", (e) => {
    state.filters.rarity = (e.target.value || "all").toLowerCase();
    renderRoster();
  });

  try {
    const [chars, leaderArr] = await Promise.all([loadCharacters(), loadLeaderSkills()]);
    const leaderIdx = buildLeaderSkillIndex(leaderArr);

    state.units = mergeLeaderSkillsIntoCharacters(chars, leaderIdx);

    // Debug counts in console
    const nonNone = state.units.filter(
      (u) => u.leaderSkill && u.leaderSkill.name && u.leaderSkill.name !== "None"
    ).length;
    console.log(`[leader merge] characters=${state.units.length}, leaderSkillsLoaded=${leaderArr.length}, withLeader=${nonNone}`);

    renderRoster();
  } catch (err) {
    console.error(err);
    const grid = $("#unitGrid");
    if (grid) grid.textContent = `ERROR: ${err.message}`;
  }
}

document.addEventListener("DOMContentLoaded", init);