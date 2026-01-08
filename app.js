// app.js (module) — Catalog + Team + Optimizer (single-source, no viewer merge)

const DATA = {
  catalog: "./data/catalog.toolbox.json",
};

let state = {
  items: [],
  byId: new Map(),
  teamMode: "story",
  teamSlots: [],
};

const $ = (sel) => document.querySelector(sel);

function showStatus(msg) {
  $("#status").classList.remove("hidden");
  $("#statusMsg").textContent = msg;
}
function hideStatus() {
  $("#status").classList.add("hidden");
}

function normCat(x) {
  const v = (x || "").toString().toLowerCase().trim();

  // Accept both singular and plural
  if (["character", "characters", "unit", "units"].includes(v)) return "character";
  if (["weapon", "weapons"].includes(v)) return "weapon";
  if (["enemy", "enemies", "monster", "monsters"].includes(v)) return "enemy";
  if (["boss", "bosses"].includes(v)) return "boss";
  if (["accessory", "accessories"].includes(v)) return "accessory";

  return v || "unknown";
}

function safeNum(v) {
  if (v == null) return 0;
  // support "1,234"
  const s = String(v).replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

function isHeaderItem(name) {
  const n = (name || "").toLowerCase();
  return (
    n === "name" ||
    n.includes("rarity element cost atk hp spd") ||
    n.includes("leader skill active skills") ||
    n.includes("passive skills")
  );
}

function normalizeCatalogItems(catalogJson) {
  // supported shapes:
  // { items: [...] } or { catalog: { items: [...] } } or array directly
  const items =
    Array.isArray(catalogJson) ? catalogJson
    : Array.isArray(catalogJson.items) ? catalogJson.items
    : catalogJson.catalog && Array.isArray(catalogJson.catalog.items) ? catalogJson.catalog.items
    : [];

  const out = [];

  for (const it of items) {
    const id = (it.id ?? it.key ?? it.name ?? "").toString().trim();
    const name = (it.name ?? "").toString().trim();
    if (!id || !name) continue;
    if (isHeaderItem(name)) continue;

    const category = normCat(it.category ?? it.type);

    const image =
      it.imageUrl || it.image || it.img || it.icon || it.iconUrl || null;

    out.push({
      id,
      name,
      category,
      element: it.element ?? null,
      cost: safeNum(it.cost),
      atk: safeNum(it.atk),
      hp: safeNum(it.hp),
      spd: safeNum(it.spd),
      weapon: it.weapon ?? null,
      leaderSkill: it.leaderSkill ?? null,
      activeSkills: it.activeSkills ?? null,
      passiveSkills: it.passiveSkills ?? null,
      image: image ? String(image) : null,
      url: it.url ?? null,
      raw: it,
    });
  }

  return out;
}

function setCounts(items) {
  const byCat = (cat) => items.filter((x) => x.category === cat).length;
  $("#countAll").textContent = items.length;
  $("#countChars").textContent = byCat("character");
  $("#countWeapons").textContent = byCat("weapon") + byCat("accessory");
  $("#countEnemies").textContent = byCat("enemy") + byCat("boss");
}

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g,"&quot;"); }

function cardHtml(item) {
  const img = item.image
    ? `<img src="${escapeAttr(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
    : `<div class="ph">${escapeHtml(item.name.slice(0, 1).toUpperCase())}</div>`;

  const tags = [
    item.category !== "unknown" ? item.category : "",
    item.element ? `elem: ${item.element}` : "",
    item.cost ? `cost: ${item.cost}` : "",
  ].filter(Boolean);

  return `
    <div class="card" draggable="${item.category === "character" ? "true" : "false"}" data-id="${escapeAttr(item.id)}">
      <div class="thumb">${img}</div>
      <div class="meta">
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="sub">
          ${escapeHtml(item.category)}${item.element ? " • " + escapeHtml(item.element) : ""}
        </div>
        <div class="tags">
          ${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderCatalog() {
  const cat = $("#categorySelect").value;
  const q = $("#searchInput").value.trim().toLowerCase();

  let filtered = state.items;

  if (cat !== "all") filtered = filtered.filter((x) => x.category === cat);
  if (q) filtered = filtered.filter((x) => x.name.toLowerCase().includes(q));

  $("#catalogGrid").innerHTML = filtered.map(cardHtml).join("");

  // drag handlers (characters only)
  for (const el of document.querySelectorAll(".card")) {
    el.addEventListener("dragstart", (e) => {
      const id = el.dataset.id;
      const item = state.byId.get(id);
      if (!item || item.category !== "character") {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", id);
    });
  }
}

function buildSlots(count, labels) {
  const slots = [];
  for (let i = 0; i < count; i++) {
    slots.push({ label: labels?.[i] ?? `Slot ${i + 1}`, id: null });
  }
  return slots;
}

function initTeam(mode) {
  state.teamMode = mode;
  if (mode === "story") {
    state.teamSlots = buildSlots(8, [
      "Main 1","Main 2","Main 3","Main 4","Main 5",
      "Backup 1","Backup 2","Backup 3",
    ]);
  } else {
    state.teamSlots = buildSlots(5, ["Slot 1","Slot 2","Slot 3","Slot 4","Slot 5"]);
  }
  renderTeam();
  renderSummary();
}

function renderTeam() {
  const wrap = $("#teamSlots");
  wrap.innerHTML = state.teamSlots.map((s, idx) => {
    const item = s.id ? state.byId.get(s.id) : null;
    return `
      <div class="slot" data-slot="${idx}">
        <button class="slotRemove" title="Remove" data-remove="${idx}">✕</button>
        <div class="slotTitle">${escapeHtml(s.label)}</div>
        ${item ? cardHtml(item) : `<div class="sub">Drop a character here</div>`}
      </div>
    `;
  }).join("");

  for (const slotEl of wrap.querySelectorAll(".slot")) {
    slotEl.addEventListener("dragover", (e) => e.preventDefault());
    slotEl.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      const item = state.byId.get(id);
      if (!item || item.category !== "character") return;

      const idx = Number(slotEl.dataset.slot);
      state.teamSlots[idx].id = id;
      renderTeam();
      renderSummary();
    });
  }

  for (const btn of wrap.querySelectorAll("[data-remove]")) {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove);
      state.teamSlots[idx].id = null;
      renderTeam();
      renderSummary();
    });
  }
}

function renderSummary() {
  const ids = state.teamSlots.map(s => s.id).filter(Boolean);
  const items = ids.map(id => state.byId.get(id)).filter(Boolean);

  $("#teamCount").textContent = items.length.toString();

  const cost = items.reduce((a,x)=>a + safeNum(x.cost), 0);
  $("#teamCost").textContent = cost.toString();

  const avg = (k) => items.length ? Math.round(items.reduce((a,x)=>a+safeNum(x[k]),0)/items.length) : 0;
  $("#teamAtk").textContent = avg("atk").toString();
  $("#teamHp").textContent  = avg("hp").toString();
  $("#teamSpd").textContent = avg("spd").toString();
}

// ---------- Optimizer ----------
function getWeights() {
  return {
    wAtk: safeNum($("#wAtk")?.value ?? 1),
    wHp: safeNum($("#wHp")?.value ?? 0.08),
    wSpd: safeNum($("#wSpd")?.value ?? 2),
    wCost: safeNum($("#wCost")?.value ?? 0.8),
  };
}
function scoreUnit(u, W) {
  return (u.atk * W.wAtk) + (u.hp * W.wHp) + (u.spd * W.wSpd) - (u.cost * W.wCost);
}
function optimizePreview() {
  const W = getWeights();
  const candidates = state.items
    .filter(x => x.category === "character")
    .map(x => ({ ...x, score: scoreUnit(x, W) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  $("#optResults").innerHTML = candidates.slice(0, 50).map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(x.name)}</td>
      <td>${x.atk}</td>
      <td>${x.hp}</td>
      <td>${x.spd}</td>
      <td>${x.cost}</td>
      <td>${Math.round(x.score)}</td>
    </tr>
  `).join("");
}
function currentTeamIds() { return state.teamSlots.map(s => s.id).filter(Boolean); }
function currentTeamCost() {
  return currentTeamIds()
    .map(id => state.byId.get(id))
    .filter(Boolean)
    .reduce((a, u) => a + safeNum(u.cost), 0);
}
function autofillTeam() {
  const W = getWeights();
  const maxCost = safeNum($("#maxCost")?.value ?? 999);
  const fillMode = $("#fillMode")?.value ?? "emptyOnly";  // emptyOnly | replaceAll
  const lockMode = $("#lockMode")?.value ?? "keepPlaced"; // keepPlaced | none

  const locked = new Set();
  for (let i = 0; i < state.teamSlots.length; i++) {
    const hasUnit = !!state.teamSlots[i].id;
    if (lockMode === "keepPlaced" && hasUnit) locked.add(i);
    if (fillMode === "replaceAll") locked.delete(i);
  }

  for (let i = 0; i < state.teamSlots.length; i++) {
    if (!locked.has(i)) {
      if (fillMode === "replaceAll") state.teamSlots[i].id = null;
    }
  }

  const used = new Set(currentTeamIds());
  let cost = currentTeamCost();

  const ranked = state.items
    .filter(x => x.category === "character")
    .map(x => ({ ...x, score: scoreUnit(x, W) }))
    .sort((a, b) => b.score - a.score);

  for (let i = 0; i < state.teamSlots.length; i++) {
    if (locked.has(i)) continue;
    if (fillMode === "emptyOnly" && state.teamSlots[i].id) continue;

    let pick = null;
    for (const cand of ranked) {
      if (used.has(cand.id)) continue;
      const nextCost = cost + safeNum(cand.cost);
      if (nextCost <= maxCost) { pick = cand; break; }
    }
    if (!pick) break;

    state.teamSlots[i].id = pick.id;
    used.add(pick.id);
    cost += safeNum(pick.cost);
  }

  renderTeam();
  renderSummary();
}

// ---------- Tabs ----------
function wireTabs() {
  $("#tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;

    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    $("#tab-catalog").classList.toggle("hidden", tab !== "catalog");
    $("#tab-team").classList.toggle("hidden", tab !== "team");
    $("#tab-optimizer").classList.toggle("hidden", tab !== "optimizer");
  });
}

async function main() {
  wireTabs();

  $("#categorySelect").addEventListener("change", renderCatalog);
  $("#searchInput").addEventListener("input", renderCatalog);

  $("#modeStory").addEventListener("click", () => {
    $("#modeStory").classList.add("active");
    $("#modePlatoon").classList.remove("active");
    initTeam("story");
  });
  $("#modePlatoon").addEventListener("click", () => {
    $("#modePlatoon").classList.add("active");
    $("#modeStory").classList.remove("active");
    initTeam("platoon");
  });
  $("#clearTeam").addEventListener("click", () => initTeam(state.teamMode));

  $("#runOptimize")?.addEventListener("click", optimizePreview);
  $("#autoFill")?.addEventListener("click", () => {
    autofillTeam();
    optimizePreview();
  });

  ["#wAtk","#wHp","#wSpd","#wCost","#maxCost","#fillMode","#lockMode"].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("input", optimizePreview);
    if (el) el.addEventListener("change", optimizePreview);
  });

  try {
    showStatus("Loading catalog…");

    const catalogJson = await fetchJson(DATA.catalog);
    const items = normalizeCatalogItems(catalogJson);

    state.items = items;
    state.byId = new Map(items.map(x => [x.id, x]));

    setCounts(items);
    initTeam("story");
    renderCatalog();
    optimizePreview();

    hideStatus();
  } catch (err) {
    console.error(err);
    showStatus(`ERROR: ${err.message}`);
  }
}

main();