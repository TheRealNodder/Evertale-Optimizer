// app.js (module) — Catalog + Team Builder + Optimizer using separated data/*.toolbox.json files

const DATA = {
  characters: "./data/characters.toolbox.json",
  weapons: "./data/weapons.toolbox.json",
  accessories: "./data/accessories.toolbox.json",
  enemies: "./data/enemies.toolbox.json",
  bosses: "./data/bosses.toolbox.json",
};

let state = {
  items: [],        // combined catalog items
  byId: new Map(),  // id -> item
  teamMode: "story", // story | platoon
  teamSlots: [],     // array of {label, id}
};

const $ = (sel) => document.querySelector(sel);

function showStatus(msg) {
  const box = $("#status");
  if (!box) return;
  box.classList.remove("hidden");
  const el = $("#statusMsg");
  if (el) el.textContent = msg;
}
function hideStatus() {
  const box = $("#status");
  if (!box) return;
  box.classList.add("hidden");
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

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

function unwrapArray(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.items)) return json.items;
  if (json && json.data && Array.isArray(json.data.items)) return json.data.items;
  return [];
}

function normalizeItem(raw, forcedCategory) {
  const category = normCat(forcedCategory ?? raw.category ?? raw.type);
  const id =
    (raw.id ?? raw.key ?? raw.unitId ?? raw.name ?? raw.title ?? "").toString().trim();

  const name = (raw.name ?? raw.title ?? raw.displayName ?? "").toString().trim();

  // image might be absolute or /files/...
  let image =
    raw.image ??
    raw.imageUrl ??
    raw.img ??
    raw.icon ??
    raw.portrait ??
    null;

  if (image && typeof image === "string" && image.startsWith("/")) {
    // toolbox paths are root-based; on GH Pages we still want absolute toolbox host? (No)
    // If your JSON already contains full URLs, keep them. If it contains /files/..., keep as-is.
    // The browser will try to load it from your GH pages domain, not toolbox.
    // If you want toolbox images, store full URLs in JSON during your build step.
    image = image;
  }

  const element = (raw.element ?? raw.elem ?? "").toString().trim() || null;

  const cost = raw.cost != null ? safeNum(raw.cost) : null;
  const atk = raw.atk != null ? safeNum(raw.atk) : null;
  const hp = raw.hp != null ? safeNum(raw.hp) : null;
  const spd = raw.spd != null ? safeNum(raw.spd) : null;

  const url = raw.url ?? raw.link ?? null;

  return {
    id,
    name,
    category,
    element,
    image,
    url,
    cost,
    atk,
    hp,
    spd,
    raw,
  };
}

function buildCatalog({ characters, weapons, accessories, enemies, bosses }) {
  const items = [];

  for (const c of characters) items.push(normalizeItem(c, "character"));
  for (const w of weapons) items.push(normalizeItem(w, "weapon"));
  for (const a of accessories) items.push(normalizeItem(a, "accessory"));
  for (const e of enemies) items.push(normalizeItem(e, "enemy"));
  for (const b of bosses) items.push(normalizeItem(b, "boss"));

  // filter broken rows
  return items.filter((x) => x.id && x.name);
}

function setCounts(items) {
  const count = (cat) => items.filter((x) => x.category === cat).length;

  const all = $("#countAll");
  const chars = $("#countChars");
  const weapons = $("#countWeapons");
  const enemies = $("#countEnemies");

  if (all) all.textContent = String(items.length);
  if (chars) chars.textContent = String(count("character"));
  if (weapons) weapons.textContent = String(count("weapon") + count("accessory"));
  if (enemies) enemies.textContent = String(count("enemy") + count("boss"));
}

function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function cardHtml(item) {
  const img = item.image
    ? `<img src="${escapeAttr(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
    : `<div class="ph">${escapeHtml(item.name.slice(0, 1).toUpperCase())}</div>`;

  const tags = [
    item.element ? `elem: ${item.element}` : "",
    item.cost != null ? `cost: ${item.cost}` : "",
  ].filter(Boolean);

  // only characters draggable into team
  const draggable = item.category === "character" ? "true" : "false";

  return `
    <div class="card" draggable="${draggable}" data-id="${escapeAttr(item.id)}">
      <div class="thumb">${img}</div>
      <div class="meta">
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="sub">${escapeHtml(item.category)}${item.element ? " • " + escapeHtml(item.element) : ""}</div>
        <div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      </div>
    </div>
  `;
}

function renderCatalog() {
  const cat = $("#categorySelect")?.value ?? "all";
  const q = ($("#searchInput")?.value ?? "").trim().toLowerCase();

  let filtered = state.items;

  if (cat !== "all") filtered = filtered.filter((x) => x.category === cat);
  if (q) filtered = filtered.filter((x) => x.name.toLowerCase().includes(q));

  const grid = $("#catalogGrid");
  if (!grid) return;

  grid.innerHTML = filtered.map(cardHtml).join("");

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
      "Main 1", "Main 2", "Main 3", "Main 4", "Main 5",
      "Backup 1", "Backup 2", "Backup 3",
    ]);
  } else {
    state.teamSlots = buildSlots(5, ["Slot 1", "Slot 2", "Slot 3", "Slot 4", "Slot 5"]);
  }

  renderTeam();
  renderSummary();
}

function renderTeam() {
  const wrap = $("#teamSlots");
  if (!wrap) return;

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

  const teamCount = $("#teamCount");
  const teamCost = $("#teamCost");
  const teamAtk = $("#teamAtk");
  const teamHp = $("#teamHp");
  const teamSpd = $("#teamSpd");

  if (teamCount) teamCount.textContent = String(items.length);

  const cost = items.reduce((a, x) => a + safeNum(x.cost), 0);
  if (teamCost) teamCost.textContent = String(cost);

  const avg = (k) => items.length
    ? Math.round(items.reduce((a, x) => a + safeNum(x[k]), 0) / items.length)
    : 0;

  if (teamAtk) teamAtk.textContent = String(avg("atk"));
  if (teamHp) teamHp.textContent = String(avg("hp"));
  if (teamSpd) teamSpd.textContent = String(avg("spd"));
}

// ----- Optimizer -----
function getWeights() {
  return {
    wAtk: safeNum($("#wAtk")?.value ?? 1),
    wHp: safeNum($("#wHp")?.value ?? 0.08),
    wSpd: safeNum($("#wSpd")?.value ?? 2),
    wCost: safeNum($("#wCost")?.value ?? 0.8),
  };
}

function scoreUnit(u, W) {
  return (safeNum(u.atk) * W.wAtk) + (safeNum(u.hp) * W.wHp) + (safeNum(u.spd) * W.wSpd) - (safeNum(u.cost) * W.wCost);
}

function optimizePreview() {
  const W = getWeights();

  const ranked = state.items
    .filter(x => x.category === "character")
    .map(x => ({ ...x, score: scoreUnit(x, W) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const tbody = $("#optimizer");
  if (!tbody) return;

  tbody.innerHTML = ranked.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(x.name)}</td>
      <td>${x.atk ?? ""}</td>
      <td>${x.hp ?? ""}</td>
      <td>${x.spd ?? ""}</td>
      <td>${x.cost ?? ""}</td>
      <td>${Math.round(x.score)}</td>
    </tr>
  `).join("");
}

// ----- Tabs -----
function wireTabs() {
  const tabs = $("#tabs");
  if (!tabs) return;

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;

    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    $("#tab-catalog")?.classList.toggle("hidden", tab !== "catalog");
    $("#tab-team")?.classList.toggle("hidden", tab !== "team");
    $("#tab-optimizer")?.classList.toggle("hidden", tab !== "optimizer");
  });
}

async function main() {
  wireTabs();

  $("#categorySelect")?.addEventListener("change", renderCatalog);
  $("#searchInput")?.addEventListener("input", renderCatalog);

  $("#modeStory")?.addEventListener("click", () => {
    $("#modeStory")?.classList.add("active");
    $("#modePlatoon")?.classList.remove("active");
    initTeam("story");
  });

  $("#modePlatoon")?.addEventListener("click", () => {
    $("#modePlatoon")?.classList.add("active");
    $("#modeStory")?.classList.remove("active");
    initTeam("platoon");
  });

  $("#clearTeam")?.addEventListener("click", () => initTeam(state.teamMode));

  $("#runOptimize")?.addEventListener("click", optimizePreview);

  ["#wAtk", "#wHp", "#wSpd", "#wCost"].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener("input", optimizePreview);
      el.addEventListener("change", optimizePreview);
    }
  });

  try {
    showStatus("Loading toolbox data…");

    const [charactersJson, weaponsJson, accessoriesJson, enemiesJson, bossesJson] =
      await Promise.all([
        fetchJson(DATA.characters),
        fetchJson(DATA.weapons),
        fetchJson(DATA.accessories),
        fetchJson(DATA.enemies),
        fetchJson(DATA.bosses).catch(() => []), // allow missing bosses file
      ]);

    const characters = unwrapArray(charactersJson);
    const weapons = unwrapArray(weaponsJson);
    const accessories = unwrapArray(accessoriesJson);
    const enemies = unwrapArray(enemiesJson);
    const bosses = unwrapArray(bossesJson);

    const items = buildCatalog({ characters, weapons, accessories, enemies, bosses });

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