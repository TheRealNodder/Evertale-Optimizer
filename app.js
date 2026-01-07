// app.js
// Loads Toolbox-scraped data files and powers roster + (future) weapons/enemies tabs.

let units = [];     // roster characters
let weapons = [];   // optional
let enemies = [];   // optional

// --------- Helpers ----------
function $(sel) {
  return document.querySelector(sel);
}

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
  console.log(msg);
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

// Normalize different possible formats into a plain array
function normalizeIdsPayload(payload) {
  // Our scraper writes: { updatedAt, source, ids: [...] }
  if (payload && Array.isArray(payload.ids)) return payload.ids;

  // Older formats: { updatedAt, units: [...] }
  if (payload && Array.isArray(payload.units)) return payload.units;

  // Raw array
  if (Array.isArray(payload)) return payload;

  return [];
}

function buildUnitObjectsFromIds(ids) {
  // Build minimal objects the roster can display.
  // If later you enrich with real stats, you can replace this mapping.
  return ids.map((id) => ({
    id,
    name: id,
    title: "",
    element: null,
    rarity: null,
    cost: null,
    stats: { atk: null, hp: null, spd: null },
    leaderSkillName: null,
    leaderSkillText: null,
    activeSkills: [],
    passiveSkills: []
  }));
}

// ---------- Roster Rendering ----------
function renderRoster() {
  const container = $("#roster");
  if (!container) return;

  container.innerHTML = "";

  if (!units.length) {
    container.innerHTML = `<div class="empty">No characters loaded.</div>`;
    return;
  }

  for (const u of units) {
    const card = document.createElement("div");
    card.className = "unit-card";
    card.dataset.unitId = u.id;

    card.innerHTML = `
      <div class="unit-name">${escapeHtml(u.name ?? u.id)}</div>
      <div class="unit-sub">${escapeHtml(u.title ?? "")}</div>
    `;

    card.addEventListener("click", () => openUnitModal(u.id));
    container.appendChild(card);
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---------- Modal (minimal, won’t break if you already have one) ----------
function openUnitModal(unitId) {
  const u = units.find((x) => x.id === unitId);
  if (!u) return;

  const modal = $("#unitModal");
  const modalBody = $("#unitModalBody");
  const modalTitle = $("#unitModalTitle");
  if (!modal || !modalBody || !modalTitle) return;

  modalTitle.textContent = u.name ?? u.id;

  const stats = u.stats || {};
  modalBody.innerHTML = `
    <div><strong>ID:</strong> ${escapeHtml(u.id)}</div>
    <div><strong>Title:</strong> ${escapeHtml(u.title ?? "")}</div>
    <div><strong>Element:</strong> ${escapeHtml(u.element ?? "")}</div>
    <div><strong>Rarity:</strong> ${u.rarity ?? ""}</div>
    <hr/>
    <div><strong>Cost:</strong> ${u.cost ?? ""}</div>
    <div><strong>ATK:</strong> ${stats.atk ?? ""}</div>
    <div><strong>HP:</strong> ${stats.hp ?? ""}</div>
    <div><strong>SPD:</strong> ${stats.spd ?? ""}</div>
    <hr/>
    <div><strong>Leader Skill:</strong> ${escapeHtml(u.leaderSkillName ?? "")}</div>
    <div>${escapeHtml(u.leaderSkillText ?? "")}</div>
    <hr/>
    <div><strong>Active Skills:</strong></div>
    <ul>${(u.activeSkills || []).map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
    <div><strong>Passive Skills:</strong></div>
    <ul>${(u.passiveSkills || []).map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
  `;

  modal.style.display = "block";
}

function initModalClose() {
  const modal = $("#unitModal");
  const closeBtn = $("#unitModalClose");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => (modal.style.display = "none"));
  }

  // click outside modal closes
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

// ---------- Main Load ----------
async function init() {
  setStatus("Loading characters…");

  try {
    // Characters roster
    const charPayload = await loadJson("data/characters.toolbox.json");
    const charIds = normalizeIdsPayload(charPayload);
    units = Array.isArray(charIds) && typeof charIds[0] === "string"
      ? buildUnitObjectsFromIds(charIds)
      : (charIds || []);

    // Optional: weapons + enemies (not required for roster)
    try {
      const weaponPayload = await loadJson("data/weapons.toolbox.json");
      const weaponIds = normalizeIdsPayload(weaponPayload);
      weapons = weaponIds;
    } catch {
      weapons = [];
    }

    try {
      const enemyPayload = await loadJson("data/enemies.toolbox.json");
      const enemyIds = normalizeIdsPayload(enemyPayload);
      enemies = enemyIds;
    } catch {
      enemies = [];
    }

    setStatus(`Loaded ${units.length} characters`);
    renderRoster();
    initModalClose();
  } catch (err) {
    showError(
      `Failed to load roster data.\n\n` +
      `Make sure these files exist in /data:\n` +
      `- characters.toolbox.json\n\n` +
      `Error: ${err.message}`
    );
    setStatus("Load failed");
  }
}

document.addEventListener("DOMContentLoaded", init);
