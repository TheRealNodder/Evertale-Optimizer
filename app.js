// app.js — CLEAN OPTION A
// Single source of truth: data/catalog.toolbox.json

const DATA_URL = "./data/catalog.toolbox.json";

let state = {
  items: [],
  byId: new Map(),
  team: [],
};

// ----------------- Utils -----------------
const $ = (s) => document.querySelector(s);

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function esc(s = "") {
  return s.toString().replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
  );
}

// ----------------- Load -----------------
async function loadCatalog() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load catalog.toolbox.json");

  const json = await res.json();
  if (!Array.isArray(json.items)) {
    throw new Error("catalog.toolbox.json has no items[]");
  }

  state.items = json.items;
  state.byId = new Map(json.items.map(i => [i.id, i]));
}

// ----------------- Catalog -----------------
function renderCatalog() {
  const cat = $("#category").value;
  const q = $("#search").value.toLowerCase();

  const list = state.items.filter(i => {
    if (cat !== "all" && i.category !== cat) return false;
    if (q && !i.name.toLowerCase().includes(q)) return false;
    return true;
  });

  $("#catalog").innerHTML = list.map(renderCard).join("");
}

function renderCard(item) {
  return `
    <div class="card" draggable="${item.category === "character"}"
         data-id="${esc(item.id)}">
      <div class="thumb">
        ${item.image ? `<img src="${item.image}" />` : `<div class="ph"></div>`}
      </div>
      <div class="name">${esc(item.name)}</div>
      <div class="meta">${esc(item.category)} ${item.element ?? ""}</div>
    </div>
  `;
}

// ----------------- Team -----------------
function initTeam() {
  state.team = Array(8).fill(null);
  renderTeam();
}

function renderTeam() {
  $("#team").innerHTML = state.team.map((id, i) => {
    const u = id ? state.byId.get(id) : null;
    return `
      <div class="slot" data-slot="${i}">
        ${u ? esc(u.name) : "Drop character"}
      </div>
    `;
  }).join("");

  document.querySelectorAll(".slot").forEach(slot => {
    slot.ondragover = e => e.preventDefault();
    slot.ondrop = e => {
      const id = e.dataTransfer.getData("text/plain");
      const unit = state.byId.get(id);
      if (!unit || unit.category !== "character") return;

      state.team[slot.dataset.slot] = id;
      renderTeam();
      renderSummary();
    };
  });
}

// ----------------- Summary -----------------
function renderSummary() {
  const units = state.team.map(id => state.byId.get(id)).filter(Boolean);

  const sum = k => units.reduce((a,u)=>a+safeNum(u[k]),0);
  const avg = k => units.length ? Math.round(sum(k)/units.length) : 0;

  $("#sumCost").textContent = sum("cost");
  $("#sumAtk").textContent = avg("atk");
  $("#sumHp").textContent  = avg("hp");
  $("#sumSpd").textContent = avg("spd");
}

// ----------------- Optimizer -----------------
function score(u) {
  return (
    safeNum(u.atk) * 1 +
    safeNum(u.hp)  * 0.08 +
    safeNum(u.spd) * 2 -
    safeNum(u.cost) * 0.8
  );
}

function runOptimizer() {
  const ranked = state.items
    .filter(i => i.category === "character")
    .map(u => ({ ...u, score: score(u) }))
    .sort((a,b)=>b.score-a.score)
    .slice(0, 20);

  $("#optimizer").innerHTML = ranked.map((u,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${esc(u.name)}</td>
      <td>${u.atk}</td>
      <td>${u.hp}</td>
      <td>${u.spd}</td>
      <td>${u.cost}</td>
      <td>${Math.round(u.score)}</td>
    </tr>
  `).join("");
}

// ----------------- Drag -----------------
document.addEventListener("dragstart", e => {
  const card = e.target.closest(".card");
  if (!card) return;
  e.dataTransfer.setData("text/plain", card.dataset.id);
});

// ----------------- Main -----------------
async function main() {
  try {
    await loadCatalog();

    $("#category").onchange = renderCatalog;
    $("#search").oninput = renderCatalog;
    $("#optimize").onclick = runOptimizer;

    initTeam();
    renderCatalog();
    runOptimizer();
  } catch (e) {
    console.error(e);
    alert(e.message);
  }
}

main();