/* app.js — Roster + Owned + ALWAYS-SHOW Leader Skills (robust key support) */

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v2";

const state = {
  units: [],
  owned: new Set(),
  filters: {
    q: "",
    element: "all",
    rarity: "all",
    ownedOnly: false,
  },
};

const $ = (sel) => document.querySelector(sel);

function safeStr(v, fallback = "") {
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function safeNum(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function loadOwned() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}

/**
 * Supports:
 * - characters.json as [] OR { characters: [] } OR { items: [] }
 */
async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_CHARACTERS}: HTTP ${res.status}`);
  const json = await res.json();

  if (Array.isArray(json)) return json;

  if (json && Array.isArray(json.characters)) return json.characters;
  if (json && Array.isArray(json.items)) return json.items;

  throw new Error("ERROR LOADING characters.json is not an array (or {characters:[]}/{items:[]})");
}

/**
 * Your project has used multiple shapes. This function normalizes leader skill into:
 * { name: string|null, description: string|null }
 */
function normalizeLeaderSkill(unit) {
  // Most common target structure:
  // unit.leaderSkill = { name, description }
  if (unit && unit.leaderSkill && typeof unit.leaderSkill === "object") {
    const name = safeStr(unit.leaderSkill.name, "").trim();
    const description = safeStr(unit.leaderSkill.description, "").trim();
    return {
      name: name || null,
      description: description || null,
    };
  }

  // Alternate keys sometimes used:
  // unit.leader_skill = { name, description }
  if (unit && unit.leader_skill && typeof unit.leader_skill === "object") {
    const name = safeStr(unit.leader_skill.name, "").trim();
    const description = safeStr(unit.leader_skill.description, "").trim();
    return {
      name: name || null,
      description: description || null,
    };
  }

  // Flat keys:
  const nameFlat =
    safeStr(unit.leaderSkillName, "") ||
    safeStr(unit.leader_name, "") ||
    safeStr(unit.leaderName, "") ||
    "";

  const descFlat =
    safeStr(unit.leaderSkillDescription, "") ||
    safeStr(unit.leader_desc, "") ||
    safeStr(unit.leaderDescription, "") ||
    "";

  const name = nameFlat.trim();
  const description = descFlat.trim();

  return {
    name: name || null,
    description: description || null,
  };
}

/**
 * Normalize unit shape so rendering is consistent.
 */
function normalizeUnit(raw, index) {
  const id =
    safeStr(raw.id, "").trim() ||
    safeStr(raw.unitId, "").trim() ||
    safeStr(raw.key, "").trim() ||
    `unit_${index}`;

  const name = safeStr(raw.name, "").trim();
  const secondaryName =
    safeStr(raw.secondaryName, "").trim() ||
    safeStr(raw.title, "").trim() ||
    safeStr(raw.handle, "").trim() ||
    ""; // optional

  const rarity = safeStr(raw.rarity, "").trim() || safeStr(raw.rank, "").trim() || "SSR";
  const element = safeStr(raw.element, "").trim() || "Unknown";

  const image =
    safeStr(raw.image, "").trim() ||
    safeStr(raw.imageUrl, "").trim() ||
    safeStr(raw.img, "").trim() ||
    "";

  // stats might be present or missing depending on your file
  const atk = safeNum(raw.atk, null);
  const hp = safeNum(raw.hp, null);
  const spd = safeNum(raw.spd, null);
  const cost = safeNum(raw.cost, null);

  const leaderSkill = normalizeLeaderSkill(raw);

  return {
    ...raw,
    id,
    name,
    secondaryName,
    rarity,
    element,
    image,
    atk,
    hp,
    spd,
    cost,
    leaderSkill,
  };
}

function escapeHtml(s) {
  return safeStr(s, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function leaderSkillDisplay(ls) {
  // Treat "None" / empty as missing
  const n = (ls?.name || "").trim();
  const d = (ls?.description || "").trim();

  const nameOk = n && n.toLowerCase() !== "none";
  const descOk = d && d.toLowerCase() !== "none";

  return {
    name: nameOk ? n : "No Leader Skill",
    description: descOk ? d : "This unit does not provide a leader skill.",
  };
}

/**
 * IMPORTANT: This returns a DOM node (not a string), so we can attach listeners safely.
 */
function renderUnitCard(unit) {
  const owned = state.owned.has(unit.id);
  const ls = leaderSkillDisplay(unit.leaderSkill);

  const card = document.createElement("div");
  card.className = "unitCard";
  card.dataset.unitId = unit.id;

  const thumb = document.createElement("div");
  thumb.className = "unitThumb";
  if (unit.image) {
    const img = document.createElement("img");
    img.src = unit.image;
    img.alt = unit.name;
    img.loading = "lazy";
    thumb.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "ph";
    ph.textContent = unit.name ? unit.name.slice(0, 1).toUpperCase() : "?";
    thumb.appendChild(ph);
  }

  const meta = document.createElement("div");
  meta.className = "meta";

  const nameRow = document.createElement("div");
  nameRow.className = "nameRow";

  const nameWrap = document.createElement("div");

  const mainName = document.createElement("div");
  mainName.className = "unitName";
  mainName.textContent = unit.name || "(missing name)";

  const subName = document.createElement("div");
  subName.className = "unitTitle";
  subName.textContent = unit.secondaryName || "";

  nameWrap.appendChild(mainName);
  nameWrap.appendChild(subName);

  const tags = document.createElement("div");
  tags.className = "tags";

  const tR = document.createElement("span");
  tR.className = "tag rarity";
  tR.textContent = unit.rarity || "—";

  const tE = document.createElement("span");
  tE.className = "tag element";
  tE.textContent = unit.element || "—";

  tags.appendChild(tR);
  tags.appendChild(tE);

  nameRow.appendChild(nameWrap);
  nameRow.appendChild(tags);

  // Optional stats line (only if values exist)
  const stats = document.createElement("div");
  stats.className = "statLine";

  const addStat = (label, val) => {
    if (val === null || val === undefined) return;
    const s = document.createElement("div");
    s.className = "stat";
    s.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(val)}`;
    stats.appendChild(s);
  };

  addStat("ATK", unit.atk);
  addStat("HP", unit.hp);
  addStat("SPD", unit.spd);
  addStat("COST", unit.cost);

  // LEADER BLOCK — ALWAYS PRESENT (NEVER "hidden")
  const leaderBlock = document.createElement("div");
  leaderBlock.className = "leaderBlock";

  const leaderName = document.createElement("div");
  leaderName.className = "leaderName";
  leaderName.textContent = ls.name;

  const leaderDesc = document.createElement("div");
  leaderDesc.className = "leaderDesc";
  leaderDesc.textContent = ls.description;

  leaderBlock.appendChild(leaderName);
  leaderBlock.appendChild(leaderDesc);

  // Owned
  const ownedRow = document.createElement("label");
  ownedRow.className = "ownedRow";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "ownedCheck";
  cb.checked = owned;

  cb.addEventListener("change", () => {
    if (cb.checked) state.owned.add(unit.id);
    else state.owned.delete(unit.id);
    saveOwned();
    if (state.filters.ownedOnly) renderRoster();
  });

  const ownedLabel = document.createElement("span");
  ownedLabel.className = "ownedLabel";
  ownedLabel.textContent = "Owned";

  ownedRow.appendChild(cb);
  ownedRow.appendChild(ownedLabel);

  meta.appendChild(nameRow);
  if (stats.childNodes.length) meta.appendChild(stats);
  meta.appendChild(leaderBlock);
  meta.appendChild(ownedRow);

  card.appendChild(thumb);
  card.appendChild(meta);

  return card;
}

function matchesFilters(u) {
  const q = state.filters.q.trim().toLowerCase();
  if (q) {
    const blob = `${u.name} ${u.secondaryName} ${u.element} ${u.rarity}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }

  if (state.filters.element !== "all") {
    if ((u.element || "").toLowerCase() !== state.filters.element) return false;
  }

  if (state.filters.rarity !== "all") {
    if ((u.rarity || "").toUpperCase() !== state.filters.rarity) return false;
  }

  if (state.filters.ownedOnly) {
    if (!state.owned.has(u.id)) return false;
  }

  return true;
}

function renderRoster() {
  const grid = $("#unitGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const list = state.units.filter(matchesFilters);
  for (const u of list) {
    grid.appendChild(renderUnitCard(u));
  }

  const status = $("#statusText");
  if (status) {
    status.textContent = `Showing ${list.length} / ${state.units.length} units`;
  }
}

function wireControls() {
  $("#searchInput")?.addEventListener("input", (e) => {
    state.filters.q = e.target.value || "";
    renderRoster();
  });

  $("#elementSelect")?.addEventListener("change", (e) => {
    state.filters.element = (e.target.value || "all").toLowerCase();
    renderRoster();
  });

  $("#raritySelect")?.addEventListener("change", (e) => {
    state.filters.rarity = (e.target.value || "all").toUpperCase();
    renderRoster();
  });

  $("#ownedOnly")?.addEventListener("change", (e) => {
    state.filters.ownedOnly = !!e.target.checked;
    renderRoster();
  });
}

async function init() {
  state.owned = loadOwned();
  wireControls();

  try {
    const raw = await loadCharacters();
    state.units = raw.map((x, i) => normalizeUnit(x, i));
    renderRoster();
  } catch (err) {
    console.error(err);
    const grid = $("#unitGrid");
    if (grid) grid.textContent = `ERROR: ${err.message}`;
  }
}

document.addEventListener("DOMContentLoaded", init);