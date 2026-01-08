// app.js (module) — loads data/catalog.clean.json and renders catalog + counts.
// This file assumes your GitHub Pages site serves from repo root.
//
// Expected JSON shape (recommended):
// {
//   "generatedAt": "...",
//   "sourceFiles": [...],
//   "characters": [...],
//   "weapons": [...],
//   "accessories": [...],
//   "enemies": [...],
//   "bosses": [...]
// }
//
// Each item should be like:
// { id, name, category, element, image, url, cost, atk, hp, spd }

const DATA_URL = "./data/catalog.clean.json";

const $ = (sel) => document.querySelector(sel);

function showStatus(msg) {
  const s = $("#status");
  if (!s) return;
  s.classList.remove("hidden");
  $("#statusMsg").textContent = msg;
}
function hideStatus() {
  const s = $("#status");
  if (!s) return;
  s.classList.add("hidden");
}

function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function normCat(x) {
  const v = (x || "").toString().toLowerCase().trim();
  if (["character", "characters", "unit", "units"].includes(v)) return "character";
  if (["weapon", "weapons"].includes(v)) return "weapon";
  if (["accessory", "accessories"].includes(v)) return "accessory";
  if (["enemy", "enemies", "monster", "monsters"].includes(v)) return "enemy";
  if (["boss", "bosses"].includes(v)) return "boss";
  return v || "unknown";
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

function flattenCleanCatalog(clean) {
  // Supports both "split blocks" and "flat array" formats.
  if (Array.isArray(clean)) {
    return clean.map((x) => ({ ...x, category: normCat(x.category ?? x.type) }));
  }
  if (clean && Array.isArray(clean.items)) {
    return clean.items.map((x) => ({ ...x, category: normCat(x.category ?? x.type) }));
  }

  const blocks = [
    ["character", clean?.characters ?? []],
    ["weapon", clean?.weapons ?? []],
    ["accessory", clean?.accessories ?? []],
    ["enemy", clean?.enemies ?? []],
    ["boss", clean?.bosses ?? []],
  ];

  const out = [];
  for (const [cat, arr] of blocks) {
    if (!Array.isArray(arr)) continue;
    for (const it of arr) out.push({ ...it, category: normCat(it.category ?? cat) });
  }
  return out;
}

function setCounts(flat) {
  const byCat = (c) => flat.filter((x) => x.category === c).length;
  const all = flat.length;

  const elAll = $("#countAll");
  const elChars = $("#countChars");
  const elWeapons = $("#countWeapons");
  const elEnemies = $("#countEnemies");

  if (elAll) elAll.textContent = String(all);
  if (elChars) elChars.textContent = String(byCat("character"));
  if (elWeapons) elWeapons.textContent = String(byCat("weapon"));
  if (elEnemies) elEnemies.textContent = String(byCat("enemy") + byCat("boss"));
}

function cardHtml(item) {
  const img = item.image
    ? `<img src="${escapeAttr(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
    : `<div class="ph">${escapeHtml((item.name || "?").slice(0, 1).toUpperCase())}</div>`;

  return `
    <div class="card" data-id="${escapeAttr(item.id ?? item.name ?? "")}">
      <div class="thumb">${img}</div>
      <div class="meta">
        <div class="name">${escapeHtml(item.name ?? "")}</div>
        <div class="sub">${escapeHtml(item.category ?? "unknown")}${item.element ? " • " + escapeHtml(item.element) : ""}</div>
      </div>
    </div>
  `;
}

function renderCatalog(flat) {
  const grid = $("#catalogGrid");
  if (!grid) return;

  const catSel = $("#categorySelect");
  const qEl = $("#searchInput");

  const cat = (catSel?.value ?? "all").toLowerCase();
  const q = (qEl?.value ?? "").trim().toLowerCase();

  let filtered = flat;

  if (cat !== "all") filtered = filtered.filter((x) => x.category === cat);
  if (q) filtered = filtered.filter((x) => (x.name ?? "").toLowerCase().includes(q));

  grid.innerHTML = filtered.map(cardHtml).join("");
}

async function main() {
  try {
    showStatus("Loading clean catalog…");

    const clean = await fetchJson(DATA_URL);
    const flat = flattenCleanCatalog(clean);

    // basic sanity
    if (!flat.length) {
      throw new Error("catalog.clean.json loaded, but contains 0 items.");
    }

    // Wire UI (if those controls exist)
    $("#categorySelect")?.addEventListener("change", () => renderCatalog(flat));
    $("#searchInput")?.addEventListener("input", () => renderCatalog(flat));

    setCounts(flat);
    renderCatalog(flat);

    hideStatus();
  } catch (err) {
    console.error(err);
    showStatus(`ERROR: ${err.message}`);
  }
}

main();