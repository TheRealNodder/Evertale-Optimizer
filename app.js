// app.js (module) — Roster UI + Owned selection persistence + Leader Units section
const DATA_URL = "./data/characters.json";
const OWNED_KEY = "ownedUnitIds";

const $ = (sel) => document.querySelector(sel);

let state = {
  all: [],
  owned: new Set(),
};

function showStatus(msg) {
  $("#status").classList.remove("hidden");
  $("#statusMsg").textContent = msg;
}
function hideStatus() {
  $("#status").classList.add("hidden");
}

function loadOwnedSet() {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveOwnedSet() {
  const arr = Array.from(state.owned);
  localStorage.setItem(OWNED_KEY, JSON.stringify(arr));
}

function getLeaderText(u) {
  if (typeof u.leaderSkill === "string") return u.leaderSkill;
  if (u.leaderSkill && typeof u.leaderSkill.text === "string") return u.leaderSkill.text;
  if (u.leaderSkill && typeof u.leaderSkill.description === "string") return u.leaderSkill.description;
  if (typeof u.leaderSkillText === "string") return u.leaderSkillText;
  return "";
}

function rarityClass(r) {
  const x = String(r || "").toUpperCase();
  if (x === "SSR") return "rarity-ssr";
  if (x === "SR") return "rarity-sr";
  if (x === "R") return "rarity-r";
  return "rarity-n";
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return await res.json();
}

function normalizeCatalog(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.characters)) return raw.characters;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return [];
}

function unitTile(u) {
  const wrap = document.createElement("div");
  wrap.className = "unit-tile";
  wrap.style.cssText = "display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;";

  const img = document.createElement("img");
  img.src = u.image || "";
  img.alt = u.name || u.id || "unit";
  img.loading = "lazy";
  img.style.cssText = "width:64px;height:64px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);";
  wrap.appendChild(img);

  const right = document.createElement("div");
  right.style.cssText = "flex:1;min-width:0;";

  const top = document.createElement("div");
  top.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:space-between;";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:800;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  title.textContent = u.name || u.id || "Unknown";
  top.appendChild(title);

  const rarity = document.createElement("span");
  rarity.className = `rarity-pill ${rarityClass(u.rarity)}`;
  rarity.textContent = (u.rarity || "N").toUpperCase();
  top.appendChild(rarity);

  right.appendChild(top);

  const meta = document.createElement("div");
  meta.style.cssText = "margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:rgba(255,255,255,0.72);font-size:12px;";
  const e = document.createElement("span");
  e.className = "chip";
  e.textContent = `Element: ${u.element || "?"}`;
  meta.appendChild(e);

  const stats = document.createElement("span");
  stats.className = "chip";
  stats.textContent = `ATK ${u.atk ?? "?"} • HP ${u.hp ?? "?"} • SPD ${u.spd ?? "?"}`;
  meta.appendChild(stats);

  right.appendChild(meta);

  const leader = getLeaderText(u);
  if (leader) {
    const ls = document.createElement("div");
    ls.style.cssText = "margin-top:8px;color:rgba(255,255,255,0.75);font-size:12.5px;line-height:1.35;";
    ls.innerHTML = `<span style="font-weight:800;">Leader:</span> <span></span>`;
    ls.querySelector("span:last-child").textContent = leader;
    right.appendChild(ls);
  }

  // Owned checkbox
  const ownedWrap = document.createElement("label");
  ownedWrap.style.cssText = "margin-top:10px;display:flex;gap:8px;align-items:center;user-select:none;";
  ownedWrap.className = "toggle";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = state.owned.has(u.id);
  cb.addEventListener("change", () => {
    if (cb.checked) state.owned.add(u.id);
    else state.owned.delete(u.id);
    saveOwnedSet();
    // keep leader section accurate
    renderLeaderSection();
  });

  const txt = document.createElement("span");
  txt.textContent = "Owned";

  ownedWrap.innerHTML = "";
  ownedWrap.appendChild(cb);
  ownedWrap.appendChild(txt);
  right.appendChild(ownedWrap);

  wrap.appendChild(right);
  return wrap;
}

function leaderCard(u) {
  // same as tile, but emphasizes leader skill block
  const wrap = document.createElement("div");
  wrap.className = "leader-card";
  wrap.style.cssText = "display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;background:rgba(255,255,255,0.06);margin:10px 0;";

  const img = document.createElement("img");
  img.src = u.image || "";
  img.alt = u.name || u.id || "unit";
  img.loading = "lazy";
  img.style.cssText = "width:64px;height:64px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);";
  wrap.appendChild(img);

  const right = document.createElement("div");
  right.style.cssText = "flex:1;min-width:0;";

  const top = document.createElement("div");
  top.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:space-between;";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:800;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  title.textContent = u.name || u.id || "Unknown";
  top.appendChild(title);

  const rarity = document.createElement("span");
  rarity.className = `rarity-pill ${rarityClass(u.rarity)}`;
  rarity.textContent = (u.rarity || "N").toUpperCase();
  top.appendChild(rarity);

  right.appendChild(top);

  const meta = document.createElement("div");
  meta.style.cssText = "margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:rgba(255,255,255,0.72);font-size:12px;";
  const e = document.createElement("span");
  e.className = "chip";
  e.textContent = `Element: ${u.element || "?"}`;
  meta.appendChild(e);

  const stats = document.createElement("span");
  stats.className = "chip";
  stats.textContent = `ATK ${u.atk ?? "?"} • HP ${u.hp ?? "?"} • SPD ${u.spd ?? "?"}`;
  meta.appendChild(stats);

  right.appendChild(meta);

  const leader = getLeaderText(u);
  const ls = document.createElement("div");
  ls.style.cssText = "margin-top:8px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.15);";
  ls.innerHTML = `<div style="font-weight:800;margin-bottom:4px;">Leader Skill</div><div style="color:rgba(255,255,255,0.78);font-size:13px;line-height:1.35;"></div>`;
  ls.querySelector("div:last-child").textContent = leader || "(none)";
  right.appendChild(ls);

  // Owned checkbox
  const ownedWrap = document.createElement("label");
  ownedWrap.className = "toggle";
  ownedWrap.style.cssText = "margin-top:10px;display:inline-flex;gap:8px;align-items:center;user-select:none;";

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = state.owned.has(u.id);
  cb.addEventListener("change", () => {
    if (cb.checked) state.owned.add(u.id);
    else state.owned.delete(u.id);
    saveOwnedSet();
    // keep roster tiles consistent (re-render visible list)
    renderRoster();
  });

  const txt = document.createElement("span");
  txt.textContent = "Owned";

  ownedWrap.innerHTML = "";
  ownedWrap.appendChild(cb);
  ownedWrap.appendChild(txt);
  right.appendChild(ownedWrap);

  wrap.appendChild(right);
  return wrap;
}

function matchesFilters(u) {
  const q = ($("#searchInput")?.value || "").trim().toLowerCase();
  const leadersOnly = $("#leadersOnly")?.checked || false;
  const element = $("#elementFilter")?.value || "";
  const rarity = $("#rarityFilter")?.value || "";

  if (q) {
    const hay = `${u.name || ""} ${u.id || ""} ${u.element || ""} ${(u.rarity || "")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (element) {
    if ((u.element || "").toLowerCase() !== element.toLowerCase()) return false;
  }

  if (rarity) {
    if ((u.rarity || "").toUpperCase() !== rarity.toUpperCase()) return false;
  }

  if (leadersOnly) {
    if (!getLeaderText(u)) return false;
  }

  return true;
}

function renderRoster() {
  const grid = $("#unitGrid");
  if (!grid) return;

  const filtered = state.all.filter(matchesFilters);

  grid.innerHTML = "";
  filtered.forEach(u => grid.appendChild(unitTile(u)));

  // title counts if you have one (optional)
  const count = $("#countMsg");
  if (count) count.textContent = `${filtered.length} shown`;
}

function renderLeaderSection() {
  const box = $("#leaderList");
  if (!box) return;

  // Leader section should show leader units (not "all units"),
  // but render full leader card including stats, leader skill, rarity, owned.
  const leaders = state.all.filter(u => !!getLeaderText(u));

  box.innerHTML = "";
  if (!leaders.length) {
    box.textContent = "No leader units found.";
    return;
  }
  leaders.forEach(u => box.appendChild(leaderCard(u)));
}

function wireUI() {
  $("#searchInput")?.addEventListener("input", renderRoster);
  $("#leadersOnly")?.addEventListener("change", renderRoster);
  $("#elementFilter")?.addEventListener("change", renderRoster);
  $("#rarityFilter")?.addEventListener("change", renderRoster);
}

async function main() {
  state.owned = loadOwnedSet();

  showStatus("Loading characters…");
  const raw = await fetchJson(DATA_URL);
  state.all = normalizeCatalog(raw);

  hideStatus();
  wireUI();
  renderLeaderSection();
  renderRoster();
}

main().catch(err => {
  console.error(err);
  showStatus(String(err?.message || err));
});