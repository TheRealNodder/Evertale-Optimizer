// app.js
// Catalog UI: dropdown category selector + image cards

let CATALOG = null;
let CURRENT_KEY = "characters";

function $(sel) { return document.querySelector(sel); }

function setStatus(msg) {
  const el = $("#status");
  if (el) el.textContent = msg;
}

function showError(msg) {
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
  return (CATALOG?.catalog?.[key]) ?? [];
}

function render() {
  const grid = $("#grid");
  const count = $("#countBadge");
  const key = CURRENT_KEY;

  if (!grid) return;

  const items = getItems(key);
  if (count) count.textContent = String(items.length);

  const q = ($("#searchInput")?.value ?? "").trim().toLowerCase();

  const filtered = !q
    ? items
    : items.filter(it =>
        (it.name ?? it.id ?? "").toLowerCase().includes(q) ||
        (it.id ?? "").toLowerCase().includes(q)
      );

  grid.innerHTML = filtered.map(it => {
    const img = it.imageUrl
      ? `<img class="card-img" src="${escapeHtml(it.imageUrl)}" alt="${escapeHtml(it.name)}" loading="lazy">`
      : `<div class="card-img placeholder">No Image</div>`;

    return `
      <div class="card" data-id="${escapeHtml(it.id)}">
        ${img}
        <div class="card-name">${escapeHtml(it.name ?? it.id)}</div>
        <div class="card-sub">${escapeHtml(it.id ?? "")}</div>
      </div>
    `;
  }).join("");

  // click opens modal (optional)
  grid.querySelectorAll(".card").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });

  setStatus(`Loaded ${filtered.length} / ${items.length}`);
}

function openModal(id) {
  const key = CURRENT_KEY;
  const item = getItems(key).find(x => x.id === id);
  if (!item) return;

  const modal = $("#itemModal");
  const title = $("#itemModalTitle");
  const body = $("#itemModalBody");

  if (!modal || !title || !body) return;

  title.textContent = item.name ?? item.id;

  body.innerHTML = `
    <div><strong>Category:</strong> ${escapeHtml(key)}</div>
    <div><strong>ID:</strong> ${escapeHtml(item.id)}</div>
    ${item.imageUrl ? `<img class="modal-img" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}">` : ""}
  `;

  modal.style.display = "block";
}

function initModalClose() {
  const modal = $("#itemModal");
  const closeBtn = $("#itemModalClose");

  if (closeBtn && modal) closeBtn.addEventListener("click", () => modal.style.display = "none");
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
}

async function init() {
  try {
    setStatus("Loading catalog…");
    CATALOG = await loadJson("data/catalog.toolbox.json");

    // populate dropdown counts
    const sel = $("#categorySelect");
    if (sel) {
      const keys = ["characters", "weapons", "accessories", "enemies", "bosses"];
      sel.innerHTML = keys.map(k => {
        const n = getItems(k).length;
        const label = `${k[0].toUpperCase()}${k.slice(1)} (${n})`;
        return `<option value="${k}">${label}</option>`;
      }).join("");
      sel.value = CURRENT_KEY;
      sel.addEventListener("change", () => {
        CURRENT_KEY = sel.value;
        render();
      });
    }

    $("#searchInput")?.addEventListener("input", render);

    initModalClose();
    render();
  } catch (e) {
    showError(
      "Failed to load catalog. Make sure data/catalog.toolbox.json exists.\n\n" +
      `Error: ${e.message}`
    );
    setStatus("Load failed");
  }
}

document.addEventListener("DOMContentLoaded", init);
