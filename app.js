// app.js (module) — loads data/catalog.clean.json and renders counts + basic list.
// Keeps working even if stats are null.

const DATA_URL = new URL("./data/catalog.clean.json", import.meta.url);

const $ = (sel) => document.querySelector(sel);

function showStatus(msg) {
  const box = $("#status");
  if (!box) return;
  box.classList.remove("hidden");
  $("#statusMsg").textContent = msg;
}
function hideStatus() {
  const box = $("#status");
  if (!box) return;
  box.classList.add("hidden");
}

async function fetchJson(urlObj) {
  const res = await fetch(urlObj.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${urlObj.pathname}`);
  return await res.json();
}

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function flattenCatalog(clean) {
  const blocks = [
    ...(clean.characters ?? []).map(x => ({...x, category:"character"})),
    ...(clean.weapons ?? []).map(x => ({...x, category:"weapon"})),
    ...(clean.accessories ?? []).map(x => ({...x, category:"accessory"})),
    ...(clean.enemies ?? []).map(x => ({...x, category:"enemy"})),
    ...(clean.bosses ?? []).map(x => ({...x, category:"boss"})),
    ...(clean.unknown ?? []).map(x => ({...x, category:"unknown"})),
  ];
  return blocks;
}

function renderCounts(clean) {
  const c = clean.counts || {};
  if ($("#countAll")) $("#countAll").textContent = (c.total ?? 0).toString();
  if ($("#countChars")) $("#countChars").textContent = (c.characters ?? 0).toString();
  if ($("#countWeapons")) $("#countWeapons").textContent = (c.weapons ?? 0).toString();
  if ($("#countEnemies")) $("#countEnemies").textContent = ((c.enemies ?? 0) + (c.bosses ?? 0)).toString();
}

function cardHtml(item) {
  const img = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
    : `<div class="ph">${escapeHtml(item.name?.slice?.(0,1)?.toUpperCase?.() ?? "?")}</div>`;

  // stats may be null; show placeholders
  const stats =
    item.category === "character"
      ? `<div class="stats">ATK: ${item.atk ?? "—"} • HP: ${item.hp ?? "—"} • SPD: ${item.spd ?? "—"} • COST: ${item.cost ?? "—"}</div>`
      : "";

  return `
    <div class="card">
      <div class="thumb">${img}</div>
      <div class="meta">
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="sub">${escapeHtml(item.category)}${item.element ? " • " + escapeHtml(item.element) : ""}</div>
        ${stats}
      </div>
    </div>
  `;
}

function renderList(items) {
  const catSel = $("#categorySelect");
  const qSel = $("#searchInput");
  const cat = catSel ? catSel.value : "all";
  const q = qSel ? qSel.value.trim().toLowerCase() : "";

  let filtered = items;

  if (cat !== "all") filtered = filtered.filter(x => x.category === cat);
  if (q) filtered = filtered.filter(x => (x.name || "").toLowerCase().includes(q));

  const grid = $("#catalogGrid");
  if (grid) grid.innerHTML = filtered.map(cardHtml).join("");
}

async function main() {
  try {
    showStatus("Loading catalog…");

    const clean = await fetchJson(DATA_URL);
    const items = flattenCatalog(clean);

    renderCounts(clean);
    renderList(items);

    // wire search controls if present
    $("#categorySelect")?.addEventListener("change", () => renderList(items));
    $("#searchInput")?.addEventListener("input", () => renderList(items));

    hideStatus();
  } catch (err) {
    console.error(err);
    showStatus(`ERROR: ${err.message}`);
  }
}

main();