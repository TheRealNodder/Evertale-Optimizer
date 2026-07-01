/* optimizer.js — WHOLE FILE
   Adds slot-locks for Story + Platoons and passes to engine.
*/

const DATA_CHARACTERS = "./apkfiles/entries/bundles/character_families.bundle.json";
// Current + legacy keys (older builds used `evertale_owned`).
const OWNED_KEY = "evertale_owned_units_v1";
const OWNED_KEY_LEGACY = "evertale_owned";

// NOTE:
// Some earlier builds referenced a helper named `renderImageStateControls()`
// during init but did not include the definition, which crashes the optimizer
// page (and prevents owned units from loading). Keep a safe implementation
// here so the page always boots.
function renderImageStateControls() {
  // Intentionally a no-op initializer for older builds.
  // Per-card state buttons (when present) are handled via event delegation.
}
const LAYOUT_KEY = "evertale_team_layout_v1";

const LS_TEAMTYPE_KEY = "evertale_optimizer_teamType_v1";
const LS_PRESET_KEY = "evertale_optimizer_preset_v1";
const LS_LOCKS_KEY = "evertale_optimizer_slotLocks_v1";
const LS_PRIMARY_ARCHETYPE_KEY = "evertale_optimizer_primaryArchetype_v1";
const LS_SECONDARY_ARCHETYPE_KEY = "evertale_optimizer_secondaryArchetype_v1";

const ARCHETYPE_OPTIONS = new Set(["","none","burn","poison","sleep","stun","heal","turn","cleanse","defense","guardian","stealth","spirit","charge","blood","crisis","survivor"]);

const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

const EQUIPMENT_AFFINITY_TERMS = ["burn","poison","sleep","stun","heal","turn","tu","cleanse","defense","guard","stealth","spirit","charge","blood","crisis","survivor","revenge","ward","armor","attack","damage","hp","speed"];

let equipmentTextCache = new WeakMap();
let equipmentTagCache = new WeakMap();
let equipmentRecommendationCache = new WeakMap();

function resetEquipmentCaches() {
  equipmentTextCache = new WeakMap();
  equipmentTagCache = new WeakMap();
  equipmentRecommendationCache = new WeakMap();
}

const state = {
  all: [],
  ownedIds: new Set(),
  ownedUnits: [],
  layout: null,
  locks: null, // { storyMain:bool[5], storyBack:bool[3], platoons:bool[20][5] }
  mode: "story",
  exampleMode: false, // when true, slots can show units not owned (greyed out)
  equipmentRuntime: { weapons: [], accessories: [], counts: {} },
};

function el(id) { return document.getElementById(id); }
function safeJsonParse(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
function normId(v) { return (v == null || v === "") ? "" : String(v); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch])); }

function getTeamTypePref() {
  const v = localStorage.getItem(LS_TEAMTYPE_KEY);
  return (v === "mono" || v === "rainbow" || v === "auto") ? v : "auto";
}
function getPresetPref() {
  const allowed = new Set(["auto","burn","poison","sleep","stun","heal","turn","atkBuff","hpBuff","cleanse","guardian","blood","crisis","survivor"]);
  const v = localStorage.getItem(LS_PRESET_KEY) || "auto";
  return allowed.has(v) ? v : "auto";
}
function setTeamTypePref(v) { localStorage.setItem(LS_TEAMTYPE_KEY, v); }
function setPresetPref(v) { localStorage.setItem(LS_PRESET_KEY, v); }
function getPrimaryArchetypePref() {
  const v = localStorage.getItem(LS_PRIMARY_ARCHETYPE_KEY) || "";
  return ARCHETYPE_OPTIONS.has(v) ? v : "";
}
function getSecondaryArchetypePref() {
  const v = localStorage.getItem(LS_SECONDARY_ARCHETYPE_KEY) || "none";
  return ARCHETYPE_OPTIONS.has(v) ? v : "none";
}
function setPrimaryArchetypePref(v) { localStorage.setItem(LS_PRIMARY_ARCHETYPE_KEY, ARCHETYPE_OPTIONS.has(v) ? v : ""); }
function setSecondaryArchetypePref(v) { localStorage.setItem(LS_SECONDARY_ARCHETYPE_KEY, (v && ARCHETYPE_OPTIONS.has(v)) ? v : "none"); }

function defaultLocks() {
  return {
    storyMain: Array(STORY_MAIN).fill(false),
    storyBack: Array(STORY_BACK).fill(false),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill(false)),
  };
}

function loadLocks() {
  const obj = safeJsonParse(localStorage.getItem(LS_LOCKS_KEY) || "null", null);
  const base = defaultLocks();
  if (!obj) return base;

  if (Array.isArray(obj.storyMain)) base.storyMain = obj.storyMain.slice(0,STORY_MAIN).map(Boolean);
  if (Array.isArray(obj.storyBack)) base.storyBack = obj.storyBack.slice(0,STORY_BACK).map(Boolean);
  if (Array.isArray(obj.platoons)) {
    base.platoons = obj.platoons.slice(0,PLATOON_COUNT).map(row => {
      const r = Array.isArray(row) ? row.slice(0,PLATOON_SIZE).map(Boolean) : [];
      return r.concat(Array(PLATOON_SIZE).fill(false)).slice(0,PLATOON_SIZE);
    });
    while (base.platoons.length < PLATOON_COUNT) base.platoons.push(Array(PLATOON_SIZE).fill(false));
  }
  return base;
}

function saveLocks() {
  localStorage.setItem(LS_LOCKS_KEY, JSON.stringify(state.locks));
}

function syncArchetypeDropdowns() {
  const primarySel = el("primaryArchetypeSelect");
  const secondarySel = el("secondaryArchetypeSelect");
  const primary = primarySel?.value || "";
  const secondary = secondarySel?.value || "none";

  if (secondarySel) {
    Array.from(secondarySel.options).forEach(opt => {
      if (!opt.value || opt.value === "none") { opt.disabled = false; return; }
      opt.disabled = opt.value === primary;
    });
    if (secondary && secondary !== "none" && secondary === primary) secondarySel.value = "none";
  }
}

function initSharedOptimizerFiltersUI() {
  const teamSel = el("teamTypeSelect");
  const presetSel = el("presetSelect");
  const primarySel = el("primaryArchetypeSelect");
  const secondarySel = el("secondaryArchetypeSelect");
  if (teamSel) teamSel.value = getTeamTypePref();
  if (presetSel) presetSel.value = getPresetPref();
  if (primarySel) primarySel.value = getPrimaryArchetypePref();
  if (secondarySel) secondarySel.value = getSecondaryArchetypePref() || "none";
  syncArchetypeDropdowns();
  teamSel?.addEventListener("change", (e) => setTeamTypePref(e.target.value || "auto"));
  presetSel?.addEventListener("change", (e) => setPresetPref(e.target.value || "auto"));
  primarySel?.addEventListener("change", (e) => {
    setPrimaryArchetypePref(e.target.value || "");
    syncArchetypeDropdowns();
  });
  secondarySel?.addEventListener("change", (e) => {
    setSecondaryArchetypePref(e.target.value || "none");
    syncArchetypeDropdowns();
  });
}

function getOwnedIds() {
  const rawCurrent = localStorage.getItem(OWNED_KEY);
  const rawLegacy = localStorage.getItem(OWNED_KEY_LEGACY);

  let ids = safeJsonParse(rawCurrent || "null", null);
  if (!Array.isArray(ids)) {
    ids = safeJsonParse(rawLegacy || "[]", []);
  }
  ids = Array.isArray(ids) ? ids : [];

  // If we're reading from legacy, also write-through to the current key.
  if (!rawCurrent && rawLegacy && ids.length) {
    try { localStorage.setItem(OWNED_KEY, JSON.stringify(ids)); } catch (_) {}
  }

  return new Set(ids.map(normId).filter(Boolean));
}

function loadLayout() {
  const empty = {
    storyMain: Array(STORY_MAIN).fill(""),
    storyBack: Array(STORY_BACK).fill(""),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
  };

  const obj = safeJsonParse(localStorage.getItem(LAYOUT_KEY) || "null", null);
  if (!obj) return empty;

  obj.storyMain = Array.isArray(obj.storyMain) ? obj.storyMain.map(normId) : empty.storyMain;
  obj.storyBack = Array.isArray(obj.storyBack) ? obj.storyBack.map(normId) : empty.storyBack;
  obj.platoons  = Array.isArray(obj.platoons) ? obj.platoons : empty.platoons;

  obj.storyMain = obj.storyMain.slice(0, STORY_MAIN).concat(Array(STORY_MAIN).fill("")).slice(0, STORY_MAIN);
  obj.storyBack = obj.storyBack.slice(0, STORY_BACK).concat(Array(STORY_BACK).fill("")).slice(0, STORY_BACK);

  obj.platoons = obj.platoons.slice(0, PLATOON_COUNT);
  while (obj.platoons.length < PLATOON_COUNT) obj.platoons.push(Array(PLATOON_SIZE).fill(""));

  obj.platoons = obj.platoons.map(row => {
    const r = Array.isArray(row) ? row.map(normId) : [];
    return r.slice(0, PLATOON_SIZE).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE);
  });

  return obj;
}

function saveLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(state.layout));
}

async function loadCharacters() {
  const raw = window.EvertaleData && window.EvertaleData.loadCharactersMerged
    ? await window.EvertaleData.loadCharactersMerged()
    : [];

  const seen = new Set();
  const deduped = [];
  for (const u of raw) {
    const id = normId(u?.id);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(u);
  }

  return deduped;
}

function normalizeRuntimeArray(chunk) {
  if (Array.isArray(chunk)) return chunk;
  if (Array.isArray(chunk?.entries)) return chunk.entries;
  if (Array.isArray(chunk?.items)) return chunk.items;
  if (Array.isArray(chunk?.data)) return chunk.data;
  if (chunk && typeof chunk === "object") return Object.values(chunk).filter(v => v && typeof v === "object");
  return [];
}

async function loadOptimizerRuntimeIfAvailable() {
  if (window.loadOptimizerRuntime && !window.OptimizerRuntime?.loaded) {
    try { await window.loadOptimizerRuntime({ skipHeavy: true }); } catch (err) { console.warn("[Optimizer] Runtime load failed; equipment pairing disabled.", err); }
  }
  const chunks = window.OptimizerRuntime?.chunks || {};
  const weapons = normalizeRuntimeArray(chunks.weapons);
  const accessories = normalizeRuntimeArray(chunks.accessories);
  resetEquipmentCaches();
  state.equipmentRuntime = {
    weapons,
    accessories,
    counts: Object.fromEntries(Object.entries(chunks).map(([key, value]) => [key, normalizeRuntimeArray(value).length || (value && typeof value === "object" ? Object.keys(value).length : 0)])),
  };
  updateOptimizerRuntimeStatus();
}

function updateOptimizerRuntimeStatus() {
  const status = el("optimizerRuntimeStatus");
  if (!status) return;
  const chunks = window.OptimizerRuntime?.chunks || {};
  const counts = state.equipmentRuntime?.counts || {};
  const parts = [
    `characters ${counts.characters || normalizeRuntimeArray(chunks.characters).length || state.all.length || 0}`,
    `weapons ${state.equipmentRuntime?.weapons?.length || 0}`,
    `accessories ${state.equipmentRuntime?.accessories?.length || 0}`,
    `tags ${counts.tags || normalizeRuntimeArray(chunks.tags).length || 0}`,
  ];
  status.textContent = `Runtime: ${parts.join(" • ")}`;
}

function textBlobFor(value) {
  const cacheable = !!value && typeof value === "object";
  if (cacheable && equipmentTextCache.has(value)) return equipmentTextCache.get(value);
  const parts = [];
  const seen = new Set();
  const walk = (obj, depth = 0) => {
    if (obj == null || depth > 4) return;
    if (typeof obj === "string" || typeof obj === "number") {
      const text = String(obj);
      if (text && !seen.has(text)) { seen.add(text); parts.push(text); }
      return;
    }
    if (Array.isArray(obj)) { obj.forEach(v => walk(v, depth + 1)); return; }
    if (typeof obj === "object") Object.values(obj).forEach(v => walk(v, depth + 1));
  };
  walk(value);
  const text = parts.join(" ").toLowerCase();
  if (cacheable) equipmentTextCache.set(value, text);
  return text;
}

function tagSetFor(value) {
  const cacheable = !!value && typeof value === "object";
  if (cacheable && equipmentTagCache.has(value)) return equipmentTagCache.get(value);
  const tags = new Set();
  const add = (v) => { const s = String(v || "").trim().toLowerCase(); if (s) tags.add(s.replace(/^elem_/, "")); };
  for (const key of ["tags", "derivedTags", "passiveTags", "roles", "archetypes"]) {
    const arr = value?.[key];
    if (Array.isArray(arr)) arr.forEach(add);
  }
  const text = textBlobFor(value);
  EQUIPMENT_AFFINITY_TERMS.forEach(term => { if (text.includes(term)) tags.add(term); });
  ["fire","water","storm","earth","light","dark"].forEach(term => { if (text.includes(term)) tags.add(term); });
  if (cacheable) equipmentTagCache.set(value, tags);
  return tags;
}

function equipmentName(eq) { return String(eq?.displayName || eq?.name || eq?.title || eq?.id || eq?.sourceId || "Unknown"); }
function equipmentImage(eq, type) {
  if (eq?.image) return eq.image;
  if (Array.isArray(eq?.imageVariants) && eq.imageVariants[0]?.url) return eq.imageVariants[0].url;
  const sourceId = eq?.sourceId || eq?.id || eq?.internal?.sourceId;
  if (!sourceId) return "";
  return `https://ik.imagekit.io/r8fsa98s9/${type === "accessory" ? "accessories" : "weapons"}/${sourceId}.png`;
}

function scoreEquipmentForUnit(eq, unit, type) {
  const unitTags = tagSetFor(unit);
  const eqTags = tagSetFor(eq);
  const unitText = textBlobFor(unit);
  const eqText = textBlobFor(eq);
  let score = 0;
  for (const tag of eqTags) if (unitTags.has(tag)) score += 12;
  const element = String(unit?.element || "").toLowerCase();
  if (element && eqText.includes(element)) score += 8;
  const roleText = unitText + " " + Array.from(unitTags).join(" ");
  if (/attack|damage|dps|survivor|blood|crisis/.test(roleText) && /attack|damage|atk|critical|crit/.test(eqText)) score += 10;
  if (/guard|tank|defense|hp|armor|ward/.test(roleText) && /hp|guard|defense|armor|reduction|survive|ward/.test(eqText)) score += 10;
  if (/turn|tu|speed|spirit|tempo|charge/.test(roleText) && /turn|tu|speed|spirit|charge|cost/.test(eqText)) score += 10;
  EQUIPMENT_AFFINITY_TERMS.forEach(term => { if (roleText.includes(term) && eqText.includes(term)) score += 5; });
  const stats = eq?.stats || eq?.raw || {};
  if (Number(stats.atk || stats.attack || stats.flatAttack || 0) > 0 && /attack|damage|dps/.test(roleText)) score += 4;
  if (Number(stats.hp || stats.maxHp || stats.flatMaxHp || 0) > 0 && /guard|tank|defense|hp/.test(roleText)) score += 4;
  if (Number(stats.spd || stats.speed || stats.flatSpeed || 0) > 0 && /turn|tu|speed|tempo/.test(roleText)) score += 4;
  if (type === "weapon" && String(unit?.weaponType || unit?.raw?.weaponPref || "").toLowerCase()) {
    const pref = String(unit?.weaponType || unit?.raw?.weaponPref || "").toLowerCase();
    if (eqText.includes(pref) || String(eq?.weaponType || eq?.raw?.weaponType || "").toLowerCase().includes(pref)) score += 15;
  }
  return score;
}

function recommendBestEquipment(unit, type) {
  if (!unit) return null;
  const cached = equipmentRecommendationCache.get(unit);
  if (cached && Object.prototype.hasOwnProperty.call(cached, type)) return cached[type];
  const rows = type === "accessory" ? state.equipmentRuntime.accessories : state.equipmentRuntime.weapons;
  let best = null;
  let bestScore = -Infinity;
  for (const eq of rows || []) {
    const score = scoreEquipmentForUnit(eq, unit, type);
    if (score > bestScore) { best = eq; bestScore = score; }
  }
  const result = best ? { item: best, score: bestScore, type } : null;
  const next = cached || Object.create(null);
  next[type] = result;
  equipmentRecommendationCache.set(unit, next);
  return result;
}

function equipmentMiniHTML(rec) {
  if (!rec?.item) return "";
  const name = equipmentName(rec.item);
  const img = equipmentImage(rec.item, rec.type);
  const label = rec.type === "accessory" ? "Accessory" : "Weapon";
  const title = `${label}: ${name} | Match ${Math.max(0, Math.round(rec.score || 0))}`;
  return `<div class="equipmentMini equipment-${rec.type}" title="${escapeHtml(title)}">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async">` : `<span class="equipmentMiniFallback">${label[0]}</span>`}<span class="equipmentMiniName">${escapeHtml(name)}</span></div>`;
}

function equipmentPairHTML(unit) {
  if (!unit) return "";
  const weapon = recommendBestEquipment(unit, "weapon");
  const accessory = recommendBestEquipment(unit, "accessory");
  if (!weapon && !accessory) return "";
  return `<div class="equipmentPair" data-equipment-repeatable="true">${equipmentMiniHTML(weapon)}${equipmentMiniHTML(accessory)}</div>`;
}

function optionList(units) {
  const opts = [`<option value="">(empty)</option>`];
  for (const u of units) {
    opts.push(`<option value="${normId(u.id)}">${u.name} (${u.element} ${u.rarity})</option>`);
  }
  return opts.join("");
}

function slotCardHTML(slotKey, idx, currentId, poolUnits, locked, ownedIdSet){
  const currentNorm = normId(currentId || "");
  const isPlatoon = String(slotKey).startsWith("platoon_");

  const selectedUnit = (poolUnits || []).find(u => normId(u?.id) === currentNorm) || null;
  const equipmentHtml = equipmentPairHTML(selectedUnit);
  const name = selectedUnit?.name || "?";
  const title = selectedUnit?.title || (isPlatoon ? "Select a unit" : "");
  const element = selectedUnit?.element || "";
  const rarity = selectedUnit?.rarity || "";
  const kind = isPlatoon ? "platoon" : (String(slotKey).includes("Main") ? "main" : "back");

  const isOwned = !currentNorm ? true : !!(ownedIdSet && ownedIdSet.has(currentNorm));
  const ownedClass = (!isOwned && selectedUnit) ? "missingOwned" : "";

  const elClass = element ? `el-${String(element).toLowerCase()}` : "el-none";
  const rarClass = rarity ? `rar-${String(rarity).toLowerCase()}` : "rar-none";

  const img = selectedUnit?.image
    ? `<img class="${isPlatoon ? "unitPortrait" : ""}" src="${selectedUnit.image}" alt="${name}" loading="lazy" decoding="async" />`
    : (isPlatoon ? `<div class="unitPortraitPlaceholder">?</div>` : ``);

  const selectHtml = `
    <select class="slotSelect" data-slot="${slotKey}" data-idx="${idx}" data-options-ready="false">
      <option value="">(empty)</option>
      ${selectedUnit ? `<option value="${currentNorm}" selected>${selectedUnit.name} (${selectedUnit.element || ""} ${selectedUnit.rarity || ""})</option>` : ""}
    </select>
  `;

  const lockHtml = isPlatoon
    ? `<label class="lockRow"><input type="checkbox" class="slotLock" data-slot="${slotKey}" data-idx="${idx}" ${locked ? "checked" : ""}/> <span>Lock</span></label>`
    : `<label class="lockRow"><input type="checkbox" class="slotLock" data-slot="${slotKey}" data-idx="${idx}" ${locked ? "checked" : ""}/> Lock</label>`;

  // Platoon: compact card to match your revamped UI
  if (isPlatoon) {
    return `
      <div class="slotCard platoonSlotCard ${kind} ${elClass} ${rarClass} ${ownedClass}" data-element="${element}" data-rarity="${rarity}">
        <div class="slotTop">
          <div class="slotImg">${img}</div>
        </div>

        <div class="slotMid">
          ${selectHtml}
          <div class="slotTitle">${name}</div>
          <div class="slotSub">${title}</div>
          <div class="slotBadges">
            <span class="tag kind">Platoon</span>
            ${element ? `<span class="tag element ${String(element).toLowerCase()}">${element}</span>` : ``}
            ${rarity ? `<span class="tag rarity ${String(rarity).toLowerCase()}">${rarity}</span>` : ``}
          </div>
          ${equipmentHtml}
        </div>

        <div class="slotBottom">
          ${lockHtml}
        </div>
      </div>`;
  }

  // Story: original-ish card (keeps your existing layout expectations)
  const stats = selectedUnit ? `<div class="slotStats">ATK ${selectedUnit.atk} · HP ${selectedUnit.hp} · SPD ${selectedUnit.spd} · COST ${selectedUnit.cost}</div>` : "";
  const badges = selectedUnit ? `<div class="slotBadges"><span class="badge">${rarity}</span><span class="badge">${element}</span></div>` : "";

  return `
    <div class="slotCard storySlotCard ${kind} ${elClass} ${rarClass} ${ownedClass}" data-element="${element}" data-rarity="${rarity}">
      <div class="slotTop">
        <div class="slotImg">${selectedUnit?.image ? `<img src="${selectedUnit.image}" alt="${name}" loading="lazy" decoding="async">` : ""}</div>
        <div class="slotName">${name}</div>
      </div>
      <div class="slotMid">${title}${badges}${stats}${equipmentHtml}</div>
      <div class="slotBottom">${selectHtml}${lockHtml}</div>
    </div>`;
}



function getLockFor(slotKey, idx) {
  if (slotKey === "storyMain") return !!state.locks.storyMain[idx];
  if (slotKey === "storyBack") return !!state.locks.storyBack[idx];
  if (slotKey.startsWith("platoon_")) {
    const p = parseInt(slotKey.split("_")[1], 10);
    return !!state.locks.platoons[p][idx];
  }
  return false;
}

function setLockFor(slotKey, idx, val) {
  if (slotKey === "storyMain") state.locks.storyMain[idx] = !!val;
  else if (slotKey === "storyBack") state.locks.storyBack[idx] = !!val;
  else if (slotKey.startsWith("platoon_")) {
    const p = parseInt(slotKey.split("_")[1], 10);
    state.locks.platoons[p][idx] = !!val;
  }
  saveLocks();
}

function hydrateSlotSelect(sel) {
  if (!sel || sel.dataset.optionsReady === "true") return;
  const current = normId(sel.value);
  const pool = state.exampleMode ? state.all : state.ownedUnits;
  sel.innerHTML = optionList(pool);
  sel.value = current;
  sel.dataset.optionsReady = "true";
}

function wireSelects() {
  document.querySelectorAll("select.slotSelect").forEach(sel => {
    const slot = sel.getAttribute("data-slot");
    const idx = parseInt(sel.getAttribute("data-idx"), 10);
    const ensureOptions = () => hydrateSlotSelect(sel);
    sel.addEventListener("pointerdown", ensureOptions, { once: true });
    sel.addEventListener("focus", ensureOptions, { once: true });

    let current = "";
    if (slot === "storyMain") current = state.layout.storyMain[idx] || "";
    else if (slot === "storyBack") current = state.layout.storyBack[idx] || "";
    else if (slot.startsWith("platoon_")) {
      const p = parseInt(slot.split("_")[1], 10);
      current = state.layout.platoons[p][idx] || "";
    }

    sel.value = normId(current);

    sel.addEventListener("change", () => {
      const v = normId(sel.value);
      if (slot === "storyMain") state.layout.storyMain[idx] = v;
      else if (slot === "storyBack") state.layout.storyBack[idx] = v;
      else if (slot.startsWith("platoon_")) {
        const p = parseInt(slot.split("_")[1], 10);
        state.layout.platoons[p][idx] = v;
      }
      saveLayout();
      renderAll();
    });
  });

  document.querySelectorAll("input.slotLock").forEach(cb => {
    const slot = cb.getAttribute("data-slot");
    const idx = parseInt(cb.getAttribute("data-idx"), 10);
    cb.addEventListener("change", () => {
      setLockFor(slot, idx, cb.checked);
      renderAll();
    });
  });
}

function renderStory() {
  const mainEl = el("storyMain");
  const backEl = el("storyBack");
  if (!mainEl || !backEl) return;

  const pool = state.exampleMode ? state.all : state.ownedUnits;
  mainEl.innerHTML = state.layout.storyMain.map((id,i) =>
    slotCardHTML("storyMain", i, id, pool, getLockFor("storyMain", i), state.ownedIds)
  ).join("");

  backEl.innerHTML = state.layout.storyBack.map((id,i) =>
    slotCardHTML("storyBack", i, id, pool, getLockFor("storyBack", i), state.ownedIds)
  ).join("");
}

function renderPlatoons() {
  const grid = el("platoonsGrid");
  if (!grid) return;

  const pool = state.exampleMode ? state.all : state.ownedUnits;
  grid.innerHTML = state.layout.platoons.map((row,p) => {
    const slots = row.map((id,i) =>
      slotCardHTML(`platoon_${p}`, i, id, pool, getLockFor(`platoon_${p}`, i), state.ownedIds)
    ).join("");

    return `
      <div class="panel platoonPanel">
        <div class="panelTitle">Platoon ${p+1}</div>
        <div class="slotGrid platoonSlots">${slots}</div>
      </div>
    `;
  }).join("");
}

function renderStorage() {
  const grid = el("storageGrid");
  if (!grid) return;

  const used = new Set([
    ...state.layout.storyMain.filter(Boolean),
    ...state.layout.storyBack.filter(Boolean),
    ...state.layout.platoons.flat().filter(Boolean),
  ].map(normId));

  const remaining = state.ownedUnits.filter(u => !used.has(normId(u.id)));

  grid.innerHTML = remaining.map(u => {
    const img = u.image ? `<img src="${u.image}" alt="">` : `<div class="ph">?</div>`;
    const equipmentHtml = equipmentPairHTML(u);
    return `
      <div class="slotCard">
        <div class="slotTop">
          <div class="slotImg">${img}</div>
          <div>
            <div class="slotName">${u.name}</div>
            <div class="slotSub">${u.title || ""}</div>
          </div>
        </div>
        <div class="slotMetaRow">
          <span class="slotChip">${u.rarity || ""}</span>
          <span class="slotChip">${u.element || ""}</span>
        </div>
        ${equipmentHtml}
      </div>
    `;
  }).join("");
}

function renderAll() {
  el("ownedCount") && (el("ownedCount").textContent = `${state.ownedUnits.length} selected`);
  el("ownedPoolText") && (el("ownedPoolText").textContent = `${state.ownedUnits.length} owned units available`);
  updateOptimizerRuntimeStatus();

  const storySection = el("storySection");
  const platoonsSection = el("platoonsSection");
  if (storySection && platoonsSection) {
    if (state.mode === "story") {
      storySection.classList.remove("hidden");
      platoonsSection.classList.add("hidden");
    } else {
      storySection.classList.add("hidden");
      platoonsSection.classList.remove("hidden");
    }
  }

  if (state.mode === "story") {
    renderStory();
    const platoonsGrid = el("platoonsGrid");
    if (platoonsGrid) platoonsGrid.innerHTML = "";
  } else {
    renderPlatoons();
    const storyMain = el("storyMain");
    const storyBack = el("storyBack");
    if (storyMain) storyMain.innerHTML = "";
    if (storyBack) storyBack.innerHTML = "";
  }
  renderStorage();
  wireSelects();
}

function buildExampleOptions() {
  // Example teams ignore owned constraints for selection, but we keep ownedIds for grey-out.
  const teamType = (el("teamTypeSelect")?.value || getTeamTypePref());
  const preset = (el("presetSelect")?.value || getPresetPref());
  const style = (el("exampleStyleSelect")?.value || "best");

  const options = buildEngineOptions();
  if (["burn","poison","sleep","stun","heal","turn","cleanse"].includes(style) && (!options.archetypes || !options.archetypes.length)) {
    options.archetypes = [style];
  }

  // Force preset behavior for examples
  // - "best": let engine auto-pick (and we allow presetSelect to bias if user chose a specific preset)
  // - other styles: choose a practical preset mapping
  if (style === "best") {
    options.presetTag = (preset === "auto") ? "" : preset;
    options.presetMode = (preset === "auto") ? "auto" : "hard";
  } else if (["burn","poison","sleep","stun","heal","turn","atkBuff","hpBuff","cleanse"].includes(style)) {
    options.presetTag = style;
    options.presetMode = "hard";
  } else if (style === "aggro") {
    // Practical aggressive examples: bias toward ATK buff / pressure teams.
    options.presetTag = "atkBuff";
    options.presetMode = "hard";
  } else if (style === "timestop") {
    // Tempo/control examples.
    options.presetTag = "turn";
    options.presetMode = "hard";
  } else if (style === "sustain") {
    // Healing / cleanse / revive examples.
    options.presetTag = "heal";
    options.presetMode = "hard";
  }

  // Keep team type selection as-is
  if (teamType === "mono") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_mono" };
  else if (teamType === "rainbow") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_rainbow" };
  else options.doctrineOverrides.monoVsRainbow = { selectionMode: "auto" };

  return options;
}

function buildExampleTeam() {
  if (!window.OptimizerEngine || typeof window.OptimizerEngine.run !== "function") {
    showOptimizerNotice("Example Team: optimizer engine is not available.");
    return;
  }
  if (!state.all || !state.all.length) {
    showOptimizerNotice("Example Team: no runtime characters loaded.");
    return;
  }

  state.exampleMode = true;

  const ssrPool = state.all.filter(u => String(u?.rarity || "").toUpperCase() === "SSR");
  const examplePool = ssrPool.length >= STORY_MAIN ? ssrPool : state.all;
  if (!examplePool.length) {
    showOptimizerNotice("Example Team: no eligible units available.");
    return;
  }

  const style = (el("exampleStyleSelect")?.value || "best");
  const savedLocks = structuredCloneSafe(state.locks);

  // Example teams are previews, so they must be able to fill empty slots even
  // when the user's normal optimizer locks are enabled.
  const unlockedLocks = defaultLocks();

  const poolSig = examplePool.map(u => normId(u?.id)).filter(Boolean).join("|");
  const cacheKey = [
    state.mode,
    style,
    el("teamTypeSelect")?.value || getTeamTypePref(),
    el("presetSelect")?.value || getPresetPref(),
    el("primaryArchetypeSelect")?.value || getPrimaryArchetypePref() || "",
    el("secondaryArchetypeSelect")?.value || getSecondaryArchetypePref() || "none",
    poolSig
  ].join("::");
  const exampleCache = buildExampleTeam._cache || (buildExampleTeam._cache = new Map());
  const cachedResult = exampleCache.get(cacheKey);
  if (cachedResult && cachedResult.story) {
    state.locks = unlockedLocks;
    applyEngineResult(structuredCloneSafe(cachedResult));
    state.locks = savedLocks;
    saveLocks();
    showOptimizerNotice(`Example Team loaded instantly from ${examplePool.length} ${ssrPool.length >= STORY_MAIN ? "SSR" : "available"} units.`);
    return;
  }

  const makeExampleOptions = (presetKey = "") => {
    const options = buildEngineOptions();
    options.currentLayout = structuredCloneSafe({
      storyMain: Array(STORY_MAIN).fill(""),
      storyBack: Array(STORY_BACK).fill(""),
      platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
    });
    options.slotLocks = structuredCloneSafe(unlockedLocks);
    options.exampleMode = true;
    if (presetKey) {
      options.presetTag = presetKey;
      options.presetMode = "hard";
    }
    return options;
  };

  let result = null;

  try {
    if (style === "best") {
      const preferredPreset = (el("presetSelect")?.value || getPresetPref() || "auto");
      result = runSelectedEngine(
        examplePool,
        makeExampleOptions(preferredPreset !== "auto" ? preferredPreset : "")
      );
    } else {
      const options = buildExampleOptions();
      options.currentLayout = makeExampleOptions().currentLayout;
      options.slotLocks = makeExampleOptions().slotLocks;
      options.exampleMode = true;
      result = runSelectedEngine(examplePool, options);
    }
  } catch (err) {
    console.error("[Optimizer] Example team build failed.", err);
    showOptimizerNotice(`Example Team error: ${String(err.message || err)}`);
    state.locks = savedLocks;
    return;
  }

  if (!result || !result.story) {
    showOptimizerNotice("Example Team: no valid result returned.");
    state.locks = savedLocks;
    renderAll();
    return;
  }

  if (exampleCache) {
    exampleCache.set(cacheKey, structuredCloneSafe(result));
    if (exampleCache.size > 8) exampleCache.delete(exampleCache.keys().next().value);
  }

  state.locks = unlockedLocks;
  applyEngineResult(result);
  state.locks = savedLocks;
  saveLocks();
  showOptimizerNotice(`Example Team loaded from ${examplePool.length} ${ssrPool.length >= STORY_MAIN ? "SSR" : "available"} units.`);
}

function clearTeams() {
  state.exampleMode = false;
  state.layout = {
    storyMain: Array(STORY_MAIN).fill(""),
    storyBack: Array(STORY_BACK).fill(""),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
  };
  saveLayout();
  renderAll();
}

function resultUnitId(value) {
  if (value == null || value === "") return "";
  if (typeof value === "object") return normId(value.id || value.sourceId || value.family || value.name || "");
  return normId(value);
}

function resultUnitIds(values) {
  return Array.isArray(values) ? values.map(resultUnitId).filter(Boolean) : [];
}

function layoutIds(layout = state.layout) {
  return {
    storyMain: Array.from({ length: STORY_MAIN }, (_, i) => normId(layout?.storyMain?.[i] || "")),
    storyBack: Array.from({ length: STORY_BACK }, (_, i) => normId(layout?.storyBack?.[i] || "")),
    platoons: Array.from({ length: PLATOON_COUNT }, (_, p) =>
      Array.from({ length: PLATOON_SIZE }, (_, i) => normId(layout?.platoons?.[p]?.[i] || ""))
    ),
  };
}

function lockSummary(locks = state.locks) {
  const storyMain = Array.from({ length: STORY_MAIN }, (_, i) => !!locks?.storyMain?.[i]);
  const storyBack = Array.from({ length: STORY_BACK }, (_, i) => !!locks?.storyBack?.[i]);
  const platoons = Array.from({ length: PLATOON_COUNT }, (_, p) =>
    Array.from({ length: PLATOON_SIZE }, (_, i) => !!locks?.platoons?.[p]?.[i])
  );
  return {
    storyMain,
    storyBack,
    platoons,
    lockedStoryMain: storyMain.filter(Boolean).length,
    lockedStoryBack: storyBack.filter(Boolean).length,
    lockedStorySlots: storyMain.filter(Boolean).length + storyBack.filter(Boolean).length,
    lockedPlatoonSlots: platoons.flat().filter(Boolean).length,
  };
}

function runSelectedEngine(units, options) {
  window.__lastOptimizerOptions = structuredCloneSafe(options);
  window.__optimizerOptions = window.__lastOptimizerOptions;
  const result = window.OptimizerEngine.run(units, options);
  window.__lastOptimizerEngineResult = result;
  window.__optimizerResult = result;
  return result;
}

function showOptimizerNotice(message) {
  const status = el("optimizerRuntimeStatus") || el("ownedCount");
  if (status && message) status.textContent = message;
}

function applyEngineResult(result) {
  if (!result || !result.story) return;

  // Apply only into unlocked slots. Locked slots keep what user has.
  const main = resultUnitIds(result.story.main);
  const back = resultUnitIds(result.story.back);
  const before = layoutIds();
  const skipped = { storyMain: [], storyBack: [], platoons: [] };

  for (let i=0;i<STORY_MAIN;i++) {
    if (!state.locks.storyMain[i]) state.layout.storyMain[i] = main[i] || "";
    else skipped.storyMain.push({ slot: i + 1, kept: before.storyMain[i], proposed: main[i] || "" });
  }
  for (let i=0;i<STORY_BACK;i++) {
    if (!state.locks.storyBack[i]) state.layout.storyBack[i] = back[i] || "";
    else skipped.storyBack.push({ slot: i + 1, kept: before.storyBack[i], proposed: back[i] || "" });
  }

  if (Array.isArray(result.platoons)) {
    for (let p=0;p<PLATOON_COUNT;p++) {
      const row = resultUnitIds(result.platoons[p]?.units || result.platoons[p] || []);
      const skippedRow = [];
      for (let i=0;i<PLATOON_SIZE;i++) {
        if (!state.locks.platoons[p][i]) state.layout.platoons[p][i] = row[i] || "";
        else skippedRow.push({ slot: i + 1, kept: before.platoons[p][i], proposed: row[i] || "" });
      }
      if (skippedRow.length) skipped.platoons.push({ platoon: p + 1, slots: skippedRow });
    }
  }

  const after = layoutIds();
  const locks = lockSummary();
  const application = {
    engineVersion: result.engineVersion || "unknown",
    plan: result.plan || "",
    selectedEngine: result.diagnostics?.selectedEngine || "",
    buildScope: window.__lastOptimizerOptions?.buildScope || state.mode,
    locks,
    skippedLockedSlots: skipped,
    skippedLockedCount: skipped.storyMain.length + skipped.storyBack.length + skipped.platoons.reduce((sum, row) => sum + row.slots.length, 0),
    before,
    after,
  };
  result.diagnostics = { ...(result.diagnostics || {}), application };
  window.__lastOptimizerEngineResult = result;
  window.__lastOptimizerVisibleLayout = application;
  const root = document.documentElement;
  root.dataset.optimizerEngineVersion = application.engineVersion;
  root.dataset.optimizerPlan = application.plan;
  root.dataset.optimizerSelectedEngine = application.selectedEngine;
  root.dataset.optimizerUsedFallback = String(!!result.diagnostics?.usedFallback);
  root.dataset.optimizerLockedStorySlots = String(locks.lockedStorySlots);
  root.dataset.optimizerLockedPlatoonSlots = String(locks.lockedPlatoonSlots);
  root.dataset.optimizerSkippedLockedCount = String(application.skippedLockedCount);
  root.dataset.optimizerStoryDiagnostics = JSON.stringify((result.diagnostics?.storyPicks || []).map(pick => ({
    id: pick.id,
    active: !!pick.explicitActiveEvidence,
    passive: !!pick.explicitPassiveEvidence,
    applies: Object.keys(pick.applies || {}),
    consumes: Object.keys(pick.consumes || {}),
    reasons: (pick.reasons || []).slice(0, 4),
  })));
  const status = el("optimizerRuntimeStatus") || el("ownedCount");
  if (status) {
    status.dataset.engineVersion = application.engineVersion;
    status.dataset.optimizerPlan = application.plan;
  }

  saveLayout();
  renderAll();
}

function buildEngineOptions() {
  const teamType = (el("teamTypeSelect")?.value || getTeamTypePref());
  const preset   = (el("presetSelect")?.value || getPresetPref());

  setTeamTypePref(teamType);
  setPresetPref(preset);

  const options = {};
  options.doctrineOverrides = {};

  if (teamType === "mono") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_mono" };
  else if (teamType === "rainbow") options.doctrineOverrides.monoVsRainbow = { selectionMode: "force_rainbow" };
  else options.doctrineOverrides.monoVsRainbow = { selectionMode: "auto" };

  options.presetTag = (preset === "auto") ? "" : preset;
  options.presetMode = (preset === "auto") ? "auto" : "hard";

  const primaryArchetype = (el("primaryArchetypeSelect")?.value || getPrimaryArchetypePref() || "");
  const secondaryArchetypeRaw = (el("secondaryArchetypeSelect")?.value || getSecondaryArchetypePref() || "none");
  const secondaryArchetype = secondaryArchetypeRaw === "none" ? "" : secondaryArchetypeRaw;
  options.archetypes = [primaryArchetype, secondaryArchetype].filter((v, i, arr) => v && arr.indexOf(v) === i);

  // Pass current layout + locks so engine can treat locked units as forced picks.
  options.buildScope = state.mode;
  options.currentLayout = structuredCloneSafe(state.layout);
  options.slotLocks = structuredCloneSafe(state.locks);
  options.debugSelection = {
    selectedTeamType: teamType,
    selectedCorePlan: preset,
    selectedPrimaryArchetype: primaryArchetype,
    selectedSecondaryArchetype: secondaryArchetype,
    buildScope: options.buildScope,
    ...lockSummary(options.slotLocks),
  };

  return options;
}

function runEngine() {
  // normal optimizer = owned-only
  state.exampleMode = false;
  const owned = state.ownedUnits || [];
  if (!owned.length || !window.OptimizerEngine || typeof window.OptimizerEngine.run !== "function") return;
  const options = buildEngineOptions();
  const result = runSelectedEngine(owned, options);
  applyEngineResult(result);
}

function structuredCloneSafe(obj) {
  try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj || {})); }
}

function installModeButtons() {
  const storyBtn = el("modeStory");
  const platoonsBtn = el("modePlatoons");
  if (!storyBtn || !platoonsBtn) return;

  storyBtn.addEventListener("click", () => {
    state.mode = "story";
    storyBtn.classList.add("active");
    platoonsBtn.classList.remove("active");
    renderAll();
  });

  platoonsBtn.addEventListener("click", () => {
    state.mode = "platoons";
    platoonsBtn.classList.add("active");
    storyBtn.classList.remove("active");
    renderAll();
  });
}

function lockFilledStorySlots() {
  for (let i=0;i<STORY_MAIN;i++) state.locks.storyMain[i] = !!state.layout.storyMain[i];
  for (let i=0;i<STORY_BACK;i++) state.locks.storyBack[i] = !!state.layout.storyBack[i];
  saveLocks();
  renderAll();
}

function lockFilledPlatoons() {
  for (let p=0;p<PLATOON_COUNT;p++) {
    for (let i=0;i<PLATOON_SIZE;i++) {
      state.locks.platoons[p][i] = !!state.layout.platoons[p][i];
    }
  }
  saveLocks();
  renderAll();
}

function unlockAllLocks() {
  state.locks = defaultLocks();
  saveLocks();
  renderAll();
}

// Hook entrypoint
window.refreshOptimizerFromOwned = function refreshOptimizerFromOwned() {
  state.exampleMode = false;
  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(normId(u.id)));
  window.__optimizerOwnedUnits = state.ownedUnits;
  renderAll();
};

window.runOptimizer = function runOptimizer() {
  runEngine();
};

async function init() {
  initSharedOptimizerFiltersUI();

  await loadOptimizerRuntimeIfAvailable();
  state.all = await loadCharacters();
  state.layout = loadLayout();
  state.locks = loadLocks();

  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(normId(u.id)));
  window.__optimizerOwnedUnits = state.ownedUnits;

  el("buildBest")?.addEventListener("click", runEngine);
  el("buildExample")?.addEventListener("click", buildExampleTeam);
  el("clearTeams")?.addEventListener("click", clearTeams);

  el("lockFilledStory")?.addEventListener("click", lockFilledStorySlots);
  el("lockFilledPlatoons")?.addEventListener("click", lockFilledPlatoons);
  el("unlockAllLocks")?.addEventListener("click", unlockAllLocks);

  installModeButtons();
  updateOptimizerRuntimeStatus();
  renderAll();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error(err);
    const owned = el("ownedCount");
    if (owned) owned.textContent = `Error: ${String(err.message || err)}`;
  });
});
