// app.js (module) — clean catalog loader + UI
const DATA_URL = "./data/catalog.json";

const $ = (sel) => document.querySelector(sel);

let state = {
  catalog: null,
  flat: [],
};

function showStatus(msg) {
  $("#status").classList.remove("hidden");
  $("#statusMsg").textContent = msg;
}
function hideStatus() {
  $("#status").classList.add("hidden");
}
function escapeHtml(s){return (s??"").toString().replace(/[&<>"']/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/"/g,"&quot;")}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

function flattenCatalog(cat) {
  const blocks = [
    ["character", cat.characters ?? []],
    ["weapon", cat.weapons ?? []],
    ["accessory", cat.accessories ?? []],
    ["enemy", cat.enemies ?? []],
    ["boss", cat.bosses ?? []],
    ["unknown", cat.unknown ?? []],
  ];

  const flat = [];
  for (const [type, arr] of blocks) {
    for (const it of arr) {
      flat.push({
        ...it,
        category: it.category || type,
      });
    }
  }
  return flat;
}

function cardHtml(item) {
  const img = item.image
    ? `<img src="${escapeAttr(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
    : `<div class="ph">${escapeHtml(item.name.slice(0,1).toUpperCase())}</div>`;

  const tags = [];
  if (item.element) tags.push(`elem: ${item.element}`);
  if (item.cost != null) tags.push(`cost: ${item.cost}`);
  if (item.atk != null && item.atk !== 0) tags.push(`atk: ${item.atk}`);
  if (item.hp != null && item.hp !== 0) tags.push(`hp: ${item.hp}`);
  if (item.spd != null && item.spd !== 0) tags.push(`spd: ${item.spd}`);

  return `
    <div class="card" data-id="${escapeAttr(item.id)}">
      <div class="thumb">${img}</div>
      <div class="meta">
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="sub">${escapeHtml(item.category)}${item.element ? " • " + escapeHtml(item.element) : ""}</div>
        <div class="tags">${tags.map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      </div>
    </div>
  `;
}

function renderCounts(flat) {
  const count = (cat) => flat.filter(x => x.category === cat).length;
  $("#countAll").textContent = flat.length;
  $("#countChars").textContent = count("character");
  $("#countWeapons").textContent = count("weapon");
  $("#countEnemies").textContent = count("enemy") + count("boss");
}

function renderGrid() {
  const cat = $("#categorySelect").value;
  const q = $("#searchInput").value.trim().toLowerCase();

  let items = state.flat;

  if (cat !== "all") items = items.filter(x => x.category === cat);
  if (q) items = items.filter(x => (x.name || "").toLowerCase().includes(q));

  $("#catalogGrid").innerHTML = items.map(cardHtml).join("");
}

async function main() {
  $("#categorySelect").addEventListener("change", renderGrid);
  $("#searchInput").addEventListener("input", renderGrid);

  try {
    showStatus("Loading catalog…");
    const catalog = await fetchJson(DATA_URL);
    state.catalog = catalog;
    state.flat = flattenCatalog(catalog);

    renderCounts(state.flat);
    renderGrid();
    hideStatus();
  } catch (e) {
    console.error(e);
    showStatus(`ERROR loading ${DATA_URL}: ${e.message}`);
  }
}

main();