// app.js — Option A (clean): single stable file: ./data/catalog.json

const DATA_URL = "./data/catalog.json";

const $ = (s) => document.querySelector(s);

let state = {
  items: [],
  byId: new Map(),
  team: Array(8).fill(null),
};

// ---------- UI helpers ----------
function showStatus(msg) {
  $("#status").classList.remove("hidden");
  $("#statusText").textContent = msg;
}
function hideStatus() {
  $("#status").classList.add("hidden");
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function esc(s = "") {
  return s.toString().replace(/[&<>"']/g, c =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
  );
}

function toAbs(u) {
  if (!u) return null;
  const s = String(u);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return s; // allow relative paths too
}

// ---------- Load ----------
async function loadCatalog() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Missing catalog file: ${DATA_URL} (HTTP ${res.status})`);
  }
  const json = await res.json();
  if (!json || !json.items || !Array.isArray(json.items)) {
    throw new Error("catalog.json must have { items: [] }");
  }

  // Normalize & filter broken entries
  const items = json.items
    .map((x) => ({
      id: String(x.id ?? ""),
      name: String(x.name ?? ""),
      category: String(x.category ?? "unknown").toLowerCase(),
      element: x.element ?? null,
      cost: x.cost ?? null,
      atk: x.atk ?? null,
      hp: x.hp ?? null,
      spd: x.spd ?? null,
      image: toAbs(x.image),
      url: x.url ?? null,
    }))
    .filter((x) => x.id && x.name);

  state.items = items;
  state.byId = new Map(items.map(i => [i.id, i]));
}

// ---------- Render catalog ----------
function cardHtml(item) {
  const img = item.image
    ? `<img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy" />`
    : `<div class="ph">${esc(item.name.slice(0, 1).toUpperCase())}</div>`;

  return `
    <div class="card" draggable="${item.category === "character"}" data-id="${esc(item.id)}">
      <div class="thumb">${img}</div>
      <div>
        <div class="name">${esc(item.name)}</div>
        <div class="meta">${esc(item.category)}${item.element ? " • " + esc(item.element) : ""}</div>
      </div>
    </div>
  `;
}

function renderCatalog() {
  const cat = $("#category").value;
  const q = $("#search").value.trim().toLowerCase();

  let list = state.items;

  if (cat !== "all") list = list.filter(x => x.category === cat);
  if (q) list = list.filter(x => x.name.toLowerCase().includes(q));

  $("#catalog").innerHTML = list.map(cardHtml).join("");
}

// ---------- Team ----------
function renderTeam() {
  $("#team").innerHTML = state.team.map((id, idx) => {
    const u = id ? state.byId.get(id) : null;
    return `<div class="slot" data-slot="${idx}">${u ? esc(u.name) : "Drop character"}</div>`;
  }).join("");

  document.querySelectorAll(".slot").forEach(slot => {
    slot.ondragover = (e) => e.preventDefault();
    slot.ondrop = (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const unit = state.byId.get(id);
      if (!unit || unit.category !== "character") return;

      const idx = Number(slot.dataset.slot);
      state.team[idx] = id;
      renderTeam();
      renderSummary();
    };
  });
}

function renderSummary() {
  const units = state.team.map(id => state.byId.get(id)).filter(Boolean);

  const sum = (k) => units.reduce((a, u) => a + safeNum(u[k]), 0);
  const avg = (k) => units.length ? Math.round(sum(k) / units.length) : 0;

  $("#sumCost").textContent = String(sum("cost"));
  $("#sumAtk").textContent  = String(avg("atk"));
  $("#sumHp").textContent   = String(avg("hp"));
  $("#sumSpd").textContent  = String(avg("spd"));
}

// ---------- Optimizer ----------
function score(u) {
  // same weights as before (tweak later)
  return (safeNum(u.atk) * 1) + (safeNum(u.hp) * 0.08) + (safeNum(u.spd) * 2) - (safeNum(u.cost) * 0.8);
}

function runOptimizer() {
  const ranked = state.items
    .filter(i => i.category === "character")
    .map(u => ({ ...u, score: score(u) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  $("#optimizer").innerHTML = ranked.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(u.name)}</td>
      <td>${safeNum(u.atk)}</td>
      <td>${safeNum(u.hp)}</td>
      <td>${safeNum(u.spd)}</td>
      <td>${safeNum(u.cost)}</td>
      <td>${Math.round(u.score)}</td>
    </tr>
  `).join("");
}

// Drag support
document.addEventListener("dragstart", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  e.dataTransfer.setData("text/plain", card.dataset.id);
});

// ---------- Main ----------
async function main() {
  try {
    showStatus("Loading catalog…");

    await loadCatalog();

    $("#category").addEventListener("change", renderCatalog);
    $("#search").addEventListener("input", renderCatalog);
    $("#optimize").addEventListener("click", runOptimizer);

    renderCatalog();
    renderTeam();
    renderSummary();
    runOptimizer();

    hideStatus();
  } catch (err) {
    console.error(err);
    showStatus(`ERROR: ${err.message}`);
  }
}

main();