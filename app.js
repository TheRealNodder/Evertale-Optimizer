// app.js (module) — Roster + Drag/Drop Teams + Platoons + Save/Load + Leader bonus

let units = [];
let unitById = new Map();

// ---------- helpers ----------
const el = (id) => document.getElementById(id);
const LS_KEY = "evertale_optimizer_state_v1";

function getStat(u, key) {
  if (u?.stats && typeof u.stats === "object") return Number(u.stats[key] || 0);
  return Number(u[key] || 0);
}

function normalizeWeaponList(u) {
  if (Array.isArray(u.weapons)) return u.weapons.filter(Boolean);
  const w = [];
  if (u.weapon1) w.push(u.weapon1);
  if (Array.isArray(u.secondaryWeapons)) w.push(...u.secondaryWeapons);
  return [...new Set(w.filter(Boolean))];
}

function rarityLabel(r) {
  if (r === 5) return "SSR";
  if (r === 4) return "SR";
  if (r === 3) return "R";
  return "Other";
}

function elementLabel(e) {
  if (!e) return "Unknown";
  return String(e).trim();
}

function safeId(u) {
  // if scraper provides id use it, else derive from name
  return (u.id || u.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------- state ----------
const state = loadState();

// state structure:
// {
//   story: [unitId|null x8],
//   platoons: [[unitId|null x5] x20]
// }

function defaultState() {
  return {
    story: Array(8).fill(null),
    platoons: Array.from({ length: 20 }, () => Array(5).fill(null)),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // validate shape quickly
    if (!Array.isArray(parsed.story) || parsed.story.length !== 8) return defaultState();
    if (!Array.isArray(parsed.platoons) || parsed.platoons.length !== 20) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

// ---------- tabs ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab, .tab-content").forEach((x) => x.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// ---------- fetch units ----------
fetch("data/units.json")
  .then((r) => r.json())
  .then((data) => {
    units = Array.isArray(data) ? data : [];

    // build id map
    unitById = new Map();
    units.forEach((u) => {
      const id = safeId(u);
      u.__id = id;
      unitById.set(id, u);
    });

    renderUnitPool();
    initRosterFilters();
    renderRoster();

    renderStoryTeam();
    renderPlatoons();

    // handy: show a warning if any missing ids
    console.log(`Loaded ${units.length} units`);
  })
  .catch((err) => {
    console.error("Failed to load data/units.json", err);
    const roster = el("rosterGrid");
    if (roster) roster.innerHTML = `<div class="results">Failed to load data/units.json</div>`;
  });

// ---------- card rendering ----------
function unitCard(u, { draggable = true, onClickAdd = null } = {}) {
  const weapons = normalizeWeaponList(u);
  const rarity = Number(u.rarity ?? 0);
  const hp = getStat(u, "hp");
  const atk = getStat(u, "atk");
  const spd = getStat(u, "spd");

  const div = document.createElement("div");
  div.className = "card";
  div.dataset.unitId = u.__id;

  if (draggable) {
    div.draggable = true;
    div.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.setData("text/plain", u.__id);
    });
  }

  // Mobile-friendly: click to add to story team first empty slot
  div.addEventListener("click", () => {
    if (typeof onClickAdd === "function") onClickAdd(u.__id);
  });

  div.innerHTML = `
    <div class="cardTop">
      <div class="name">${u.name ?? "Unknown"}</div>
      <div class="badges">
        <span class="badge accent">${elementLabel(u.element)}</span>
        <span class="badge green">${rarityLabel(rarity)} (${rarity || "?"})</span>
      </div>
    </div>

    <div class="stats">
      <div class="statRow"><span>ATK</span><b>${atk}</b></div>
      <div class="statRow"><span>HP</span><b>${hp}</b></div>
      <div class="statRow"><span>SPD</span><b>${spd}</b></div>
      <div class="statRow"><span>Weapon</span><b>${weapons[0] ?? "-"}</b></div>
    </div>
  `;

  return div;
}

// ---------- pool ----------
function renderUnitPool() {
  const pool = el("unitPool");
  if (!pool) return;
  pool.innerHTML = "";
  units.slice(0, 80).forEach((u) => pool.appendChild(unitCard(u, { onClickAdd: addToStoryFirstEmpty })));
}

// ---------- roster filters ----------
function initRosterFilters() {
  const elemSel = el("filterElement");
  const weapSel = el("filterWeapon");

  const elements = [...new Set(units.map((u) => elementLabel(u.element)).filter(Boolean))].sort();
  const weapons = [...new Set(units.flatMap((u) => normalizeWeaponList(u)))].sort();

  elemSel.innerHTML =
    `<option value="">All Elements</option>` + elements.map((e) => `<option value="${e}">${e}</option>`).join("");
  weapSel.innerHTML =
    `<option value="">All Weapons</option>` + weapons.map((w) => `<option value="${w}">${w}</option>`).join("");

  ["search", "filterElement", "filterRarity", "filterWeapon", "sortBy"].forEach((id) => {
    const node = el(id);
    node && node.addEventListener("input", renderRoster);
    node && node.addEventListener("change", renderRoster);
  });
}

function renderRoster() {
  const grid = el("rosterGrid");
  if (!grid) return;

  const q = (el("search").value || "").trim().toLowerCase();
  const fe = el("filterElement").value;
  const fr = el("filterRarity").value;
  const fw = el("filterWeapon").value;
  const sortBy = el("sortBy").value;

  let list = units.filter((u) => {
    const name = (u.name || "").toLowerCase();
    if (q && !name.includes(q)) return false;

    const e = elementLabel(u.element);
    if (fe && e !== fe) return false;

    const r = String(Number(u.rarity ?? 0));
    if (fr && r !== fr) return false;

    const weapons = normalizeWeaponList(u);
    if (fw && !weapons.includes(fw)) return false;

    return true;
  });

  const sortKey = (u) => {
    if (sortBy === "name") return (u.name || "").toLowerCase();
    if (sortBy === "rarity") return Number(u.rarity || 0);
    return getStat(u, sortBy); // atk/hp/spd
  };

  list.sort((a, b) => {
    const A = sortKey(a);
    const B = sortKey(b);
    if (sortBy === "name") return A.localeCompare(B);
    return B - A;
  });

  grid.innerHTML = "";
  // NOTE: for performance we cap to 400 cards
  list.slice(0, 400).forEach((u) => grid.appendChild(unitCard(u, { onClickAdd: addToStoryFirstEmpty })));
}

// ---------- Story Team (8) ----------
function addToStoryFirstEmpty(unitId) {
  const idx = state.story.findIndex((x) => !x);
  if (idx === -1) return;
  // prevent duplicates in story
  if (state.story.includes(unitId)) return;
  state.story[idx] = unitId;
  saveState();
  renderStoryTeam();
}

function setStorySlot(index, unitId) {
  // prevent duplicates
  if (unitId && state.story.includes(unitId)) return;
  state.story[index] = unitId;
  saveState();
  renderStoryTeam();
}

function clearStorySlot(index) {
  state.story[index] = null;
  saveState();
  renderStoryTeam();
}

function renderStoryTeam() {
  const host = el("storyTeam");
  if (!host) return;

  host.innerHTML = "";
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement("div");
    slot.className = "slot" + (i === 0 ? " leader" : "") + (i >= 5 ? " backup" : "");
    slot.dataset.storyIndex = String(i);

    const unitId = state.story[i];
    const u = unitId ? unitById.get(unitId) : null;

    slot.innerHTML = `
      <div class="slotTitle">
        Slot ${i + 1}${i === 0 ? " (Leader)" : ""}${i >= 5 ? " (Backup)" : ""}
      </div>
      <div class="slotBody"></div>
    `;

    const body = slot.querySelector(".slotBody");

    if (!u) {
      body.innerHTML = `<div class="muted">Drop unit here</div>`;
    } else {
      const card = unitCard(u, { draggable: false });
      // add remove button
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.style.marginTop = "10px";
      btn.textContent = "Remove";
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        clearStorySlot(i);
      });

      body.appendChild(card);
      body.appendChild(btn);
    }

    // drop events
    slot.addEventListener("dragover", (ev) => ev.preventDefault());
    slot.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const id = ev.dataTransfer.getData("text/plain");
      if (!id) return;
      setStorySlot(i, id);
    });

    host.appendChild(slot);
  }
}

// ---------- Platoons (20x5) ----------
function setPlatoonSlot(pIndex, sIndex, unitId) {
  // prevent duplicates inside that platoon
  if (unitId && state.platoons[pIndex].includes(unitId)) return;
  state.platoons[pIndex][sIndex] = unitId;
  saveState();
  renderPlatoons();
}

function clearPlatoonSlot(pIndex, sIndex) {
  state.platoons[pIndex][sIndex] = null;
  saveState();
  renderPlatoons();
}

function renderPlatoons() {
  const host = el("platoonList");
  if (!host) return;
  host.innerHTML = "";

  for (let p = 0; p < 20; p++) {
    const wrap = document.createElement("div");
    wrap.className = "platoon";

    const title = document.createElement("div");
    title.className = "name";
    title.textContent = `Platoon ${p + 1}`;
    wrap.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "teamGrid";
    grid.style.marginTop = "10px";

    for (let s = 0; s < 5; s++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.platoon = String(p);
      slot.dataset.slot = String(s);

      const unitId = state.platoons[p][s];
      const u = unitId ? unitById.get(unitId) : null;

      slot.innerHTML = `
        <div class="slotTitle">Slot ${s + 1}</div>
        <div class="slotBody"></div>
      `;

      const body = slot.querySelector(".slotBody");

      if (!u) {
        body.innerHTML = `<div class="muted">Drop unit here</div>`;
      } else {
        const card = unitCard(u, { draggable: false });
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.style.marginTop = "10px";
        btn.textContent = "Remove";
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          clearPlatoonSlot(p, s);
        });

        body.appendChild(card);
        body.appendChild(btn);
      }

      slot.addEventListener("dragover", (ev) => ev.preventDefault());
      slot.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const id = ev.dataTransfer.getData("text/plain");
        if (!id) return;
        setPlatoonSlot(p, s, id);
      });

      grid.appendChild(slot);
    }

    wrap.appendChild(grid);
    host.appendChild(wrap);
  }
}

// ---------- Optimizer (now with basic leader skill bonus) ----------
function parseLeaderSkillText(text) {
  // Very simple parser:
  // Looks for element keywords + stat + % in the text.
  // Example: "Allied Fire element units have their Attack increased by 15%."
  if (!text) return null;

  const t = String(text);
  const elementMatch = t.match(/\b(Fire|Water|Earth|Light|Dark)\b/i);
  const statMatch = t.match(/\b(Attack|ATK|HP|Speed|SPD)\b/i);
  const pctMatch = t.match(/(\d+)\s*%/);

  if (!pctMatch) return null;

  const pct = Number(pctMatch[1]) / 100;
  const element = elementMatch ? elementMatch[1].toLowerCase() : null;

  let stat = null;
  if (statMatch) {
    const s = statMatch[1].toLowerCase();
    if (s === "attack" || s === "atk") stat = "atk";
    if (s === "hp") stat = "hp";
    if (s === "speed" || s === "spd") stat = "spd";
  }

  return { element, stat, pct, text };
}

function scoreUnitBase(u, mode) {
  const atk = getStat(u, "atk");
  const hp = getStat(u, "hp");
  const spd = getStat(u, "spd");

  if (mode === "PVP") return atk * 1.25 + spd * 1.55 + hp * 0.35;
  if (mode === "BOSS") return atk * 1.6 + hp * 0.85 + spd * 0.2;
  if (mode === "STORY") return atk * 1.05 + hp * 0.8 + spd * 0.55;
  return atk + hp * 0.6 + spd * 0.5; // PVE
}

function applyLeaderBonusToUnit(u, leaderParsed) {
  if (!leaderParsed) return 0;

  const unitElement = elementLabel(u.element).toLowerCase();
  if (leaderParsed.element && unitElement !== leaderParsed.element) return 0;

  if (!leaderParsed.stat) return 0;

  const baseStat = getStat(u, leaderParsed.stat);
  return baseStat * leaderParsed.pct;
}

function optimize() {
  const mode = el("mode").value;
  const size = Number(el("teamSize").value);
  const results = el("results");

  // Try each unit as leader; pick best team total score.
  // (Brute force leader choice; rest greedily chosen.)
  let best = null;

  for (const leader of units) {
    const leaderParsed = parseLeaderSkillText(leader.leaderSkill || leader?.leaderSkill?.text);

    const scored = units.map((u) => {
      const base = scoreUnitBase(u, mode);
      const leaderBonus = applyLeaderBonusToUnit(u, leaderParsed);
      return { u, score: base + leaderBonus };
    });

    // ensure leader is included
    const leaderId = leader.__id;
    const leaderEntry = scored.find((x) => x.u.__id === leaderId);
    if (!leaderEntry) continue;

    scored.sort((a, b) => b.score - a.score);

    const team = [];
    // add leader first
    team.push({ ...leaderEntry, isLeader: true });

    for (const entry of scored) {
      if (team.length >= size) break;
      if (entry.u.__id === leaderId) continue;
      team.push(entry);
    }

    const total = team.reduce((sum, x) => sum + x.score, 0);
    if (!best || total > best.total) {
      best = { leader, leaderParsed, team, total };
    }
  }

  if (!best) {
    results.innerHTML = `<div class="muted">No results.</div>`;
    return;
  }

  const leaderText = best.leaderParsed?.text
    ? `<div class="muted">Leader Skill: ${best.leaderParsed.text}</div>`
    : `<div class="muted">Leader Skill: (none detected)</div>`;

  results.innerHTML = `
    <div class="muted">Best team by ${mode} score</div>
    <div><b>Leader:</b> ${best.leader.name}</div>
    ${leaderText}
    <ul style="margin-top:10px">
      ${best.team
        .map(
          (x) =>
            `<li>${x.isLeader ? "👑 " : ""}<b>${x.u.name}</b> — ${Math.round(x.score)}</li>`
        )
        .join("")}
    </ul>
    <button class="btn primary" id="applyStory">Apply to Story Team (front slots)</button>
  `;

  // Apply into story team (slots 1..size)
  const btn = document.getElementById("applyStory");
  btn?.addEventListener("click", () => {
    // clear front slots
    for (let i = 0; i < 5; i++) state.story[i] = null;
    // assign
    const ids = best.team.map((x) => x.u.__id);
    for (let i = 0; i < Math.min(5, ids.length); i++) {
      state.story[i] = ids[i];
    }
    saveState();
    renderStoryTeam();
    // jump user to Story tab
    document.querySelectorAll(".tab, .tab-content").forEach((x) => x.classList.remove("active"));
    document.querySelector(`.tab[data-tab="story"]`)?.classList.add("active");
    document.getElementById("story")?.classList.add("active");
  });
}

window.optimize = optimize;
