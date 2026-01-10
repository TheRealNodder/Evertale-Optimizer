// app.js — loads split data files with graceful fallback

const DATA = {
  characters: "./data/characters.json",
  weapons: "./data/weapons.json",
  accessories: "./data/accessories.json",
  enemies: "./data/enemies.json",
  bosses: "./data/bosses.json",
  leaderSkills: "./data/leaderSkills.todo.json", // optional
};

let state = {
  items: [],
  byId: new Map(),
  teamMode: "story",
  teamSlots: [],
};

const $ = (sel) => document.querySelector(sel);

function showStatus(msg) {
  const box = $("#status");
  if (!box) return;
  box.classList.remove("hidden");
  const msgEl = $("#statusMsg");
  if (msgEl) msgEl.textContent = msg;
}
function hideStatus() {
  const box = $("#status");
  if (!box) return;
  box.classList.add("hidden");
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function cleanText(s) {
  return (s ?? "").toString().trim();
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

async function fetchJsonOptional(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false, url, status: res.status, data: null };
    const data = await res.json();
    return { ok: true, url, status: res.status, data };
  } catch (e) {
    return { ok: false, url, status: 0, data: null, error: e?.message || String(e) };
  }
}

function unwrapItems(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.characters)) return json.characters;
  if (Array.isArray(json.weapons)) return json.weapons;
  if (Array.isArray(json.accessories)) return json.accessories;
  if (Array.isArray(json.enemies)) return json.enemies;
  if (Array.isArray(json.bosses)) return json.bosses;
  return [];
}

function escapeHtml(s){return (s??"").toString().replace(/[&<>"']/g,(c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/"/g,"&quot;")}

function cardHtml(item) {
  const img = item.image
    ? `<img src="${escapeAttr(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`
    : `<div class="ph">${escapeHtml(item.name.slice(0, 1).toUpperCase())}</div>`;

  const tags = [
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

function setCounts(items) {
  const byCat = (cat) => items.filter((x) => x.category === cat).length;
  const set = (id, val) => { const el = $(id); if (el) el.textContent = String(val); };
  set("#countAll", items.length);
  set("#countChars", byCat("character"));
  set("#countWeapons", byCat("weapon"));
  set("#countEnemies", byCat("enemy") + byCat("boss"));
}

// ---------- Catalog render ----------
function renderCatalog() {
  const catSel = $("#categorySelect");
  const qSel = $("#searchInput");

  const cat = catSel ? catSel.value : "all";
  const q = qSel ? qSel.value.trim().toLowerCase() : "";

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

// ---------- Team builder ----------
function buildSlots(count, labels) {
  const slots = [];
  for (let i = 0; i < count; i++) slots.push({ label: labels?.[i] ?? `Slot ${i+1}`, id: null });
  return slots;
}

function initTeam(mode) {
  state.teamMode = mode;
  if (mode === "story") {
    state.teamSlots = buildSlots(8, ["Main 1","Main 2","Main 3","Main 4","Main 5","Backup 1","Backup 2","Backup 3"]);
  } else {
    state.teamSlots = buildSlots(5, ["Slot 1","Slot 2","Slot 3","Slot 4","Slot 5"]);
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

  const set = (id, val) => { const el = $(id); if (el) el.textContent = String(val); };

  set("#teamCount", items.length);
  set("#teamCost", items.reduce((a,x)=>a+safeNum(x.cost),0));

  const avg = (k) => items.length ? Math.round(items.reduce((a,x)=>a+safeNum(x[k]),0)/items.length) : 0;
  set("#teamAtk", avg("atk"));
  set("#teamHp",  avg("hp"));
  set("#teamSpd", avg("spd"));
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
    .sort((a,b) => b.score - a.score)
    .slice(0, 50);

  const body = $("#optResults");
  if (!body) return;
  body.innerHTML = candidates.map((x,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${escapeHtml(x.name)}</td>
      <td>${x.atk}</td>
      <td>${x.hp}</td>
      <td>${x.spd}</td>
      <td>${x.cost}</td>
      <td>${Math.round(x.score)}</td>
    </tr>
  `).join("");
}

function currentTeamIds() {
  return state.teamSlots.map(s => s.id).filter(Boolean);
}
function currentTeamCost() {
  return currentTeamIds()
    .map(id => state.byId.get(id))
    .filter(Boolean)
    .reduce((a,u)=>a+safeNum(u.cost),0);
}

function autofillTeam() {
  const W = getWeights();
  const maxCost = safeNum($("#maxCost")?.value ?? 999);
  const fillMode = $("#fillMode")?.value ?? "emptyOnly";
  const lockMode = $("#lockMode")?.value ?? "keepPlaced";

  const locked = new Set();
  for (let i = 0; i < state.teamSlots.length; i++) {
    if (lockMode === "keepPlaced" && state.teamSlots[i].id) locked.add(i);
    if (fillMode === "replaceAll") locked.delete(i);
  }

  if (fillMode === "replaceAll") {
    for (let i = 0; i < state.teamSlots.length; i++) {
      if (!locked.has(i)) state.teamSlots[i].id = null;
    }
  }

  const used = new Set(currentTeamIds());
  let cost = currentTeamCost();

  const ranked = state.items
    .filter(x => x.category === "character")
    .map(x => ({ ...x, score: scoreUnit(x, W) }))
    .sort((a,b)=>b.score-a.score);

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
  optimizePreview();
}

// ---------- Tabs ----------
function wireTabs() {
  const tabs = $("#tabs");
  if (!tabs) return;

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;

    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");

    const tab = btn.dataset.tab;
    $("#tab-catalog")?.classList.toggle("hidden", tab !== "catalog");
    $("#tab-team")?.classList.toggle("hidden", tab !== "team");
    $("#tab-optimizer")?.classList.toggle("hidden", tab !== "optimizer");
  });
}

// ---------- Load split data ----------
function normalizeItem(raw, forcedCategory) {
  const category = normCat(forcedCategory ?? raw.category ?? raw.type);

  const id = cleanText(raw.id || raw.key || raw.slug || raw.name);
  const name = cleanText(raw.name || raw.title || raw.displayName || raw.id);

  return {
    id,
    name,
    category,
    rarity: raw.rarity ?? null,
    element: raw.element ?? null,
    cost: raw.cost ?? null,
    atk: safeNum(raw.atk ?? raw.attack ?? raw.stats?.atk),
    hp: safeNum(raw.hp ?? raw.health ?? raw.stats?.hp),
    spd: safeNum(raw.spd ?? raw.speed ?? raw.stats?.spd),
    weaponType: raw.weaponType ?? raw.weapon ?? null,
    leaderSkill: raw.leaderSkill ?? null,
    activeSkills: raw.activeSkills ?? raw.skills?.active ?? null,
    passiveSkills: raw.passiveSkills ?? raw.skills?.passive ?? null,
    image: raw.image ?? raw.imageUrl ?? raw.icon ?? null,
    url: raw.url ?? null,
    raw,
  };
}

async function loadAllData() {
  const results = await Promise.all([
    fetchJsonOptional(DATA.characters),
    fetchJsonOptional(DATA.weapons),
    fetchJsonOptional(DATA.accessories),
    fetchJsonOptional(DATA.enemies),
    fetchJsonOptional(DATA.bosses),
    fetchJsonOptional(DATA.leaderSkills),
  ]);

  const [charsR, weapR, accR, eneR, bossR, lsR] = results;

  const errs = results.filter(r => !r.ok);
  if (errs.length) {
    console.warn("Some data files failed to load:", errs);
    const msg = errs.map(e => `${e.url} (${e.status || "ERR"})`).join(" | ");
    showStatus(`Some files missing, loading partial data: ${msg}`);
  }

  const chars = unwrapItems(charsR.data).map(x => normalizeItem(x, "character"));
  const weapons = unwrapItems(weapR.data).map(x => normalizeItem(x, "weapon"));
  const accessories = unwrapItems(accR.data).map(x => normalizeItem(x, "accessory"));
  const enemies = unwrapItems(eneR.data).map(x => normalizeItem(x, "enemy"));
  const bosses = unwrapItems(bossR.data).map(x => normalizeItem(x, "boss"));

  let items = [...chars, ...weapons, ...accessories, ...enemies, ...bosses];

  // Apply leader skills mapping if available
  // supports:
  // { skills: { [id]: {name, description} } } OR { [id]: {name, description} }
  if (lsR.ok && lsR.data) {
    const map = lsR.data.skills || lsR.data;
    if (map && typeof map === "object") {
      items = items.map(it => {
        if (it.category !== "character") return it;
        const ls = map[it.id];
        return ls ? { ...it, leaderSkill: ls } : it;
      });
    }
  }

  // De-dupe by id
  const byId = new Map();
  for (const it of items) {
    if (!it.id || !it.name) continue;
    if (!byId.has(it.id)) byId.set(it.id, it);
  }

  return Array.from(byId.values());
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
  $("#autoFill")?.addEventListener("click", autofillTeam);

  ["#wAtk","#wHp","#wSpd","#wCost","#maxCost","#fillMode","#lockMode"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", optimizePreview);
    el.addEventListener("change", optimizePreview);
  });

  try {
    showStatus("Loading split data files…");

    const items = await loadAllData();
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