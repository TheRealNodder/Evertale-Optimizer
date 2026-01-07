// app.js
// Loads characters from: data/characters.viewer.full.json
// Renders searchable cards + modal details.
// (Weapons/enemies/bosses/accessories can be added later with more Playwright scrapers.)

let DATA = {
  characters: []
};

let CURRENT_KEY = "characters";

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

function getItems(key) {
  if (key === "characters") return DATA.characters || [];
  return [];
}

function render() {
  const grid = $("#grid");
  const count = $("#countBadge");
  if (!grid) return;

  const items = getItems(CURRENT_KEY);
  const q = ($("#searchInput")?.value ?? "").trim().toLowerCase();

  const filtered = !q
    ? items
    : items.filter(it => {
        const name = (it.name ?? "").toLowerCase();
        const title = (it.title ?? "").toLowerCase();
        const id = (it.id ?? "").toLowerCase();
        return name.includes(q) || title.includes(q) || id.includes(q);
      });

  if (count) count.textContent = String(filtered.length);

  grid.innerHTML = filtered.map(it => {
    const img = it.imageUrl
      ? `<img class="card-img" src="${escapeHtml(it.imageUrl)}" alt="${escapeHtml(it.name)}" loading="lazy">`
      : `<div class="card-img placeholder">No Image</div>`;

    const sub = it.title ? it.title : (it.id ?? "");

    return `
      <div class="card" data-id="${escapeHtml(it.id)}">
        ${img}
        <div class="card-name">${escapeHtml(it.name ?? it.id)}</div>
        <div class="card-sub">${escapeHtml(sub)}</div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".card").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });

  setStatus(`Showing ${filtered.length} of ${items.length}`);
}

function openModal(id) {
  const item = getItems(CURRENT_KEY).find(x => x.id === id);
  if (!item) return;

  const modal = $("#itemModal");
  const title = $("#itemModalTitle");
  const body = $("#itemModalBody");
  if (!modal || !title || !body) return;

  title.textContent = item.name ?? item.id;

  const stats = item.stats || {};
  const actives = Array.isArray(item.activeSkills) ? item.activeSkills : [];
  const passives = Array.isArray(item.passiveSkills) ? item.passiveSkills : [];

  body.innerHTML = `
    <div class="modal-row"><strong>ID:</strong> ${escapeHtml(item.id)}</div>
    <div class="modal-row"><strong>Title:</strong> ${escapeHtml(item.title ?? "")}</div>

    ${item.imageUrl ? `<img class="modal-img" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : ""}

    <hr/>

    <div class="modal-row"><strong>Cost:</strong> ${item.cost ?? ""}</div>
    <div class="modal-row"><strong>ATK:</strong> ${stats.atk ?? ""}</div>
    <div class="modal-row"><strong>HP:</strong> ${stats.hp ?? ""}</div>
    <div class="modal-row"><strong>SPD:</strong> ${stats.spd ?? ""}</div>

    <hr/>

    <div class="modal-row"><strong>Leader Skill:</strong> ${escapeHtml(item.leaderSkillName ?? "")}</div>
    <div class="modal-row">${escapeHtml(item.leaderSkillText ?? "")}</div>

    <hr/>

    <div class="modal-row"><strong>Active Skills</strong></div>
    <ul>${actives.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>

    <div class="modal-row"><strong>Passive Skills</strong></div>
    <ul>${passives.map(s => `<li>${escapeHtml(s)}</li>`).join("")}</ul>
  `;

  modal.style.display = "block";
}

function initModalClose() {
  const modal = $("#itemModal");
  const closeBtn = $("#itemModalClose");
  if (closeBtn && modal) closeBtn.addEventListener("click", () => (modal.style.display = "none"));
  window.addEventListener("click", (e) => { if (e.target === modal) modal.style.display = "none"; });
}

function initCategoryDropdown() {
  const sel = $("#categorySelect");
  if (!sel) return;

  // For now, only Characters are fully powered by Viewer scrape.
  // We'll add other categories once you add more Playwright scrapers.
  const keys = [
    { key: "characters", label: `Characters (Viewer) (${DATA.characters.length})` }
  ];

  sel.innerHTML = keys.map(k => `<option value="${k.key}">${k.label}</option>`).join("");
  sel.value = CURRENT_KEY;

  sel.addEventListener("change", () => {
    CURRENT_KEY = sel.value;
    render();
  });
}

async function init() {
  try {
    setStatus("Loading Viewer characters…");

    const payload = await loadJson("data/characters.viewer.full.json");
    const chars = Array.isArray(payload.characters) ? payload.characters : [];
    DATA.characters = chars;

    initCategoryDropdown();

    $("#searchInput")?.addEventListener("input", render);
    initModalClose();

    render();
  } catch (e) {
    showError(
      "Failed to load data/characters.viewer.full.json.\n\n" +
      "Run the GitHub Action (Update toolbox data) and confirm the file exists in /data.\n\n" +
      `Error: ${e.message}`
    );
    setStatus("Load failed");
  }
}

document.addEventListener("DOMContentLoaded", init);
