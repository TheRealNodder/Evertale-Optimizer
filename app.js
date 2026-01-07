// app.js — Full: Catalog + Team Builder + Optimizer
// Requires:
// - data/catalog.toolbox.json  (categories + images)
// - data/characters.viewer.full.json (character stats/skills/leader skills)

let CATALOG = null;      // { catalog: { characters, weapons, accessories, enemies, bosses } }
let VIEWER = null;       // { characters: [...] }

let CURRENT_CATEGORY = "characters";

const STORAGE_KEY = "evertale_optimizer_teams_v1";

const TEAMS = {
  story: {
    main: [null, null, null, null, null],
    backup: [null, null, null]
  },
  platoons: Array.from({ length: 20 }, () => [null, null, null, null, null]),
  currentPlatoonIndex: 0
};

function $(sel) { return document.querySelector(sel); }

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
}

function showError(msg) {
  console.error(msg);
  const el = $("#error");
  if (el) {
    el.style.display = "block";
    el.textContent = msg;
  } else {
    alert(msg);
  }
}

async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normKey(s) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// ---------- Data join: Viewer characters + Catalog images ----------
function buildCharacterImageMap() {
  const map = new Map(); // key: normalized name => imageUrl
  const list = CATALOG?.catalog?.characters ?? [];
  for (const it of list) {
    const k = normKey(it.name);
    if (!k) continue;
    if (!map.has(k) && it.imageUrl) map.set(k, it.imageUrl);
  }
  return map;
}

function enrichViewerCharactersWithImages() {
  const chars = VIEWER?.characters ?? [];
  const imgMap = buildCharacterImageMap();

  for (const c of chars) {
    // Prefer Viewer image if valid; otherwise use catalog mapping by name
    if (!c.imageUrl) {
      const k = normKey(c.name);
      const url = imgMap.get(k);
      if (url) c.imageUrl = url;
    }
  }
}

// ---------- Category dropdown + card rendering ----------
function categoryItems(cat) {
  if (!CATALOG?.catalog) return [];
  if (cat === "characters") {
    // Use Viewer list (full stats), but keep images from join
    return VIEWER?.characters ?? [];
  }
  return CATALOG.catalog[cat] ?? [];
}

function categoryLabel(cat) {
  const pretty = cat[0].toUpperCase() + cat.slice(1);
  const count = categoryItems(cat).length;
  return `${pretty} (${count})`;
}

function initCategoryDropdown() {
  const sel = $("#categorySelect");
  if (!sel) return;

  const keys = ["characters", "weapons", "accessories", "enemies", "bosses"];
  sel.innerHTML = keys.map(k => `<option value="${k}">${categoryLabel(k)}</option>`).join("");
  sel.value = CURRENT_CATEGORY;

  sel.addEventListener("change", () => {
    CURRENT_CATEGORY = sel.value;
    renderGrid();
  });
}

function renderGrid() {
  const grid = $("#grid");
  const count = $("#countBadge");
  if (!grid) return;

  const q = ($("#searchInput")?.value ?? "").trim().toLowerCase();
  const items = categoryItems(CURRENT_CATEGORY);

  const filtered = !q ? items : items.filter(it => {
    const name = (it.name ?? it.id ?? "").toLowerCase();
    const title = (it.title ?? "").toLowerCase();
    const id = (it.id ?? "").toLowerCase();
    return name.includes(q) || title.includes(q) || id.includes(q);
  });

  if (count) count.textContent = String(filtered.length);

  grid.innerHTML = filtered.map(it => {
    const name = it.name ?? it.id;
    const sub = CURRENT_CATEGORY === "characters"
      ? (it.title ?? it.id ?? "")
      : (it.id ?? "");

    const img = it.imageUrl
      ? `<img class="card-img" src="${escapeHtml(it.imageUrl)}" alt="${escapeHtml(name)}" loading="lazy">`
      : `<div class="card-img placeholder">No Image</div>`;

    // Make draggable only for characters (team uses chars)
    const draggable = (CURRENT_CATEGORY === "characters") ? `draggable="true"` : "";

    return `
      <div class="card" data-id="${escapeHtml(it.id ?? "")}" ${draggable}>
        ${img}
        <div class="card-name">${escapeHtml(name)}</div>
        <div class="card-sub">${escapeHtml(sub)}</div>
      </div>
    `;
  }).join("");

  // card click -> modal
  grid.querySelectorAll(".card").forEach(el => {
    el.addEventListener("click", (e) => {
      // don't block dragstart
      if (e.type === "click") openModal(el.dataset.id);
    });
  });

  // dragstart for characters
  if (CURRENT_CATEGORY === "characters") {
    grid.querySelectorAll(".card").forEach(el => {
      el.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", el.dataset.id);
        ev.dataTransfer.effectAllowed = "copy";
      });
    });
  }

  setStatus(`Showing ${filtered.length} of ${items.length} in ${CURRENT_CATEGORY}`);
}

// ---------- Modal ----------
function openModal(id) {
  const modal = $("#itemModal");
  const title = $("#itemModalTitle");
  const body = $("#itemModalBody");
  if (!modal || !title || !body) return;

  const items = categoryItems(CURRENT_CATEGORY);
  const it = items.find(x => String(x.id) === String(id));
  if (!it) return;

  const name = it.name ?? it.id;
  title.textContent = name;

  if (CURRENT_CATEGORY !== "characters") {
    body.innerHTML = `
      <div><strong>Category:</strong> ${escapeHtml(CURRENT_CATEGORY)}</div>
      <div><strong>ID:</strong> ${escapeHtml(it.id ?? "")}</div>
      ${it.imageUrl ? `<img class="modal-img" src="${escapeHtml(it.imageUrl)}" alt="${escapeHtml(name)}">` : ""}
    `;
    modal.style.display = "flex";
    return;
  }

  const stats = it.stats || {};
  const act = Array.isArray(it.activeSkills) ? it.activeSkills : [];
  const pas = Array.isArray(it.passiveSkills) ? it.passiveSkills : [];

  body.innerHTML = `
    <div><strong>ID:</strong> ${escapeHtml(it.id)}</div>
    <div><strong>Title:</strong> ${escapeHtml(it.title ?? "")}</div>
    ${it.imageUrl ? `<img class="modal-img" src="${escapeHtml(it.imageUrl)}" alt="${escapeHtml(name)}">` : ""}

    <hr/>
    <div><strong>Cost:</strong> ${it.cost ?? ""}</div>
    <div><strong>ATK:</strong> ${stats.atk ?? ""}</div>
    <div><strong>HP:</strong> ${stats.hp ?? ""}</div>
    <div><strong>SPD:</strong> ${stats.spd ?? ""}</div>

    <hr/>
    <div><strong>Leader Skill:</strong> ${escapeHtml(it.leaderSkillName ?? "")}</div>
    <div>${escapeHtml(it.leaderSkillText ?? "")}</div>

    <hr/>
    <div><strong>Active Skills</strong></div>
    <ul>${act.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>

    <div><strong>Passive Skills</strong></div>
    <ul>${pas.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
  `;

  modal.style.display = "flex";
}

function initModalClose() {
  const modal = $("#itemModal");
  const closeBtn = $("#itemModalClose");
  if (closeBtn && modal) closeBtn.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
}

// ---------- Team persistence ----------
function saveTeams() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(TEAMS));
  } catch {}
}
function loadTeams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.story && parsed?.platoons) {
      TEAMS.story = parsed.story;
      TEAMS.platoons = parsed.platoons;
      TEAMS.currentPlatoonIndex = parsed.currentPlatoonIndex ?? 0;
    }
  } catch {}
}

// ---------- Team Builder UI ----------
function initPlatoonSelect() {
  const sel = $("#platoonSelect");
  if (!sel) return;

  sel.innerHTML = Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    return `<option value="${i}">Platoon ${n}</option>`;
  }).join("");

  sel.value = String(TEAMS.currentPlatoonIndex);

  sel.addEventListener("change", () => {
    TEAMS.currentPlatoonIndex = Number(sel.value);
    saveTeams();
    renderTeamSlots();
    renderTeamSummary();
  });
}

function currentMode() {
  return $("#teamMode")?.value ?? "story";
}

function currentPlatoonArray() {
  return TEAMS.platoons[TEAMS.currentPlatoonIndex];
}

function getCharById(id) {
  return (VIEWER?.characters ?? []).find(c => String(c.id) === String(id)) ?? null;
}

function slotSet(slotKey, charId) {
  const mode = currentMode();
  if (mode === "story") {
    if (slotKey.startsWith("story-main-")) {
      const idx = Number(slotKey.split("-").pop()) - 1;
      TEAMS.story.main[idx] = charId;
    } else if (slotKey.startsWith("story-backup-")) {
      const idx = Number(slotKey.split("-").pop()) - 1;
      TEAMS.story.backup[idx] = charId;
    }
  } else {
    if (slotKey.startsWith("platoon-")) {
      const idx = Number(slotKey.split("-").pop()) - 1;
      currentPlatoonArray()[idx] = charId;
    }
  }
  saveTeams();
}

function slotGet(slotKey) {
  const mode = currentMode();
  if (mode === "story") {
    if (slotKey.startsWith("story-main-")) {
      const idx = Number(slotKey.split("-").pop()) - 1;
      return TEAMS.story.main[idx];
    } else if (slotKey.startsWith("story-backup-")) {
      const idx = Number(slotKey.split("-").pop()) - 1;
      return TEAMS.story.backup[idx];
    }
  } else {
    if (slotKey.startsWith("platoon-")) {
      const idx = Number(slotKey.split("-").pop()) - 1;
      return currentPlatoonArray()[idx];
    }
  }
  return null;
}

function clearCurrentTeam() {
  const mode = currentMode();
  if (mode === "story") {
    TEAMS.story.main = [null, null, null, null, null];
    TEAMS.story.backup = [null, null, null];
  } else {
    TEAMS.platoons[TEAMS.currentPlatoonIndex] = [null, null, null, null, null];
  }
  saveTeams();
  renderTeamSlots();
  renderTeamSummary();
}

function initTeamMode() {
  const sel = $("#teamMode");
  if (!sel) return;

  sel.addEventListener("change", () => {
    const mode = currentMode();
    $("#platoonSelect").style.display = (mode === "platoon") ? "inline-flex" : "none";
    $("#storyLayout").style.display = (mode === "story") ? "flex" : "none";
    $("#platoonLayout").style.display = (mode === "platoon") ? "flex" : "none";
    renderTeamSlots();
    renderTeamSummary();
  });
}

function initSlotDnD() {
  document.querySelectorAll(".slot").forEach(slot => {
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      slot.classList.add("dragover");
    });
    slot.addEventListener("dragleave", () => slot.classList.remove("dragover"));
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      slot.classList.remove("dragover");
      const id = e.dataTransfer.getData("text/plain");
      if (!id) return;
      // only characters can be dropped
      if (!getCharById(id)) return;
      slotSet(slot.dataset.slot, id);
      renderTeamSlots();
      renderTeamSummary();
    });
  });
}

function renderSlot(slotEl) {
  const key = slotEl.dataset.slot;
  const id = slotGet(key);

  // clear existing card content (but keep label)
  slotEl.querySelectorAll(".slot-card, .slot-remove").forEach(x => x.remove());

  if (!id) return;

  const c = getCharById(id);
  if (!c) return;

  const remove = document.createElement("button");
  remove.className = "slot-remove";
  remove.textContent = "✕";
  remove.addEventListener("click", () => {
    slotSet(key, null);
    renderTeamSlots();
    renderTeamSummary();
  });

  const wrap = document.createElement("div");
  wrap.className = "slot-card";
  wrap.innerHTML = `
    ${c.imageUrl ? `<img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(c.name)}">` : ""}
    <div class="slot-name">${escapeHtml(c.name)}</div>
    <div class="slot-meta">
      <span>Cost: ${c.cost ?? ""}</span>
      <span>SPD: ${c.stats?.spd ?? ""}</span>
    </div>
  `;

  slotEl.appendChild(remove);
  slotEl.appendChild(wrap);
}

function renderTeamSlots() {
  const mode = currentMode();
  document.querySelectorAll(".slot").forEach(slot => {
    const key = slot.dataset.slot;
    const isStory = key.startsWith("story-");
    const isPlatoon = key.startsWith("platoon-");

    // hide irrelevant slots (but keep layout containers toggled too)
    if (mode === "story" && isPlatoon) return;
    if (mode === "platoon" && isStory) return;

    renderSlot(slot);
  });
}

function renderTeamSummary() {
  const el = $("#teamSummary");
  if (!el) return;

  const mode = currentMode();
  const ids = [];
  if (mode === "story") {
    ids.push(...TEAMS.story.main, ...TEAMS.story.backup);
  } else {
    ids.push(...currentPlatoonArray());
  }

  const chars = ids.map(id => getCharById(id)).filter(Boolean);
  const totalCost = chars.reduce((a, c) => a + (c.cost ?? 0), 0);
  const totalAtk = chars.reduce((a, c) => a + (c.stats?.atk ?? 0), 0);
  const totalHp  = chars.reduce((a, c) => a + (c.stats?.hp ?? 0), 0);
  const avgSpd = chars.length ? Math.round(chars.reduce((a,c)=>a+(c.stats?.spd ?? 0),0) / chars.length) : 0;

  el.innerHTML = `
    <div class="row"><span class="muted">Mode</span><span>${escapeHtml(mode === "story" ? "Story Team" : `Platoon ${TEAMS.currentPlatoonIndex + 1}`)}</span></div>
    <div class="row"><span class="muted">Units placed</span><span>${chars.length} / ${mode === "story" ? 8 : 5}</span></div>
    <div class="row"><span class="muted">Total Cost</span><span>${totalCost}</span></div>
    <div class="row"><span class="muted">Total ATK</span><span>${totalAtk}</span></div>
    <div class="row"><span class="muted">Total HP</span><span>${totalHp}</span></div>
    <div class="row"><span class="muted">Avg SPD</span><span>${avgSpd}</span></div>
    <div class="hint" style="margin-top:10px;">
      We’ll add leader-skill effects and weapon synergy after we confirm the data is stable.
    </div>
  `;
}

// ---------- Optimizer ----------
function readWeights() {
  const wAtk = Number($("#wAtk")?.value ?? 1);
  const wHp = Number($("#wHp")?.value ?? 0.08);
  const wSpd = Number($("#wSpd")?.value ?? 2);
  const wCost = Number($("#wCost")?.value ?? 0.8);
  return { wAtk, wHp, wSpd, wCost };
}

function scoreChar(c, W) {
  const atk = c.stats?.atk ?? 0;
  const hp  = c.stats?.hp ?? 0;
  const spd = c.stats?.spd ?? 0;
  const cost = c.cost ?? 0;
  return atk * W.wAtk + hp * W.wHp + spd * W.wSpd - cost * W.wCost;
}

function topRankedChars(limit = 50) {
  const W = readWeights();
  const chars = (VIEWER?.characters ?? []).slice();
  chars.sort((a,b) => scoreChar(b, W) - scoreChar(a, W));
  return chars.slice(0, limit).map(c => ({ c, s: scoreChar(c, W) }));
}

function renderTopPicks() {
  const el = $("#topPicks");
  if (!el) return;
  const ranked = topRankedChars(25);

  el.innerHTML = ranked.map(({ c, s }, i) => `
    <div class="list-item">
      <div>
        <div><b>#${i+1} ${escapeHtml(c.name)}</b> <small>${escapeHtml(c.title ?? "")}</small></div>
        <small>Cost ${c.cost ?? ""} • ATK ${c.stats?.atk ?? ""} • HP ${c.stats?.hp ?? ""} • SPD ${c.stats?.spd ?? ""}</small>
      </div>
      <div><b>${Math.round(s)}</b></div>
    </div>
  `).join("");
}

function autofillCurrentTeam() {
  const mode = currentMode();
  const ranked = topRankedChars(300).map(x => x.c);

  // avoid duplicates within the target team
  const used = new Set();

  function pickNext() {
    for (const c of ranked) {
      if (!used.has(c.id)) {
        used.add(c.id);
        return c.id;
      }
    }
    return null;
  }

  if (mode === "story") {
    for (let i = 0; i < 5; i++) {
      const k = `story-main-${i+1}`;
      slotSet(k, pickNext());
    }
    for (let i = 0; i < 3; i++) {
      const k = `story-backup-${i+1}`;
      slotSet(k, pickNext());
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const k = `platoon-${i+1}`;
      slotSet(k, pickNext());
    }
  }

  renderTeamSlots();
  renderTeamSummary();
}

// ---------- Init ----------
async function init() {
  try {
    setStatus("Loading data…");

    CATALOG = await loadJson("data/catalog.toolbox.json");
    VIEWER = await loadJson("data/characters.viewer.full.json");

    // normalize viewer format
    if (!Array.isArray(VIEWER.characters)) VIEWER.characters = [];

    enrichViewerCharactersWithImages();
    loadTeams();

    // wire UI
    initModalClose();

    initCategoryDropdown();
    $("#searchInput")?.addEventListener("input", renderGrid);

    initPlatoonSelect();
    initTeamMode();
    initSlotDnD();

    $("#btnClearTeam")?.addEventListener("click", clearCurrentTeam);

    $("#btnAutofill")?.addEventListener("click", () => {
      autofillCurrentTeam();
      renderTopPicks();
      setStatus("Auto-filled the current team.");
    });

    // update top picks when weights change
    ["#wAtk","#wHp","#wSpd","#wCost"].forEach(id => {
      $(id)?.addEventListener("input", renderTopPicks);
    });

    // initial view setup
    $("#platoonSelect").style.display = ($("#teamMode").value === "platoon") ? "inline-flex" : "none";
    $("#storyLayout").style.display = ($("#teamMode").value === "story") ? "flex" : "none";
    $("#platoonLayout").style.display = ($("#teamMode").value === "platoon") ? "flex" : "none";

    renderGrid();
    renderTeamSlots();
    renderTeamSummary();
    renderTopPicks();

    setStatus("Ready.");
  } catch (e) {
    showError(
      "Failed to load required data files.\n\n" +
      "Make sure GitHub Actions created these:\n" +
      "- data/catalog.toolbox.json\n" +
      "- data/characters.viewer.full.json\n\n" +
      `Error: ${e.message}`
    );
    setStatus("Load failed");
  }
}

document.addEventListener("DOMContentLoaded", init);