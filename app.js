// app.js — Full site logic + Unit Detail Modal
// Supports data/units.json shape: { updatedAt: "...", units: [...] }

let units = [];
let unitById = new Map();

const el = (id) => document.getElementById(id);
const LS_KEY = "evertale_optimizer_state_v2_toolbox";

// ---------- CONFIG ----------
const OPT_CONFIG = {
  weaponBonusPrimary: 0.03,  // +3% of base score if any weapon info exists
  weaponBonusMatchBest: 0.07 // reserved if you later add bestWeapons
};

// ---------- helpers ----------
function getStat(u, key) {
  if (u?.stats && typeof u.stats === "object") return Number(u.stats[key] || 0);
  return Number(u[key] || 0);
}

function safeId(u) {
  return (u.id || u.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function elementLabel(e) {
  if (!e) return "Unknown";
  return String(e).trim();
}

function rarityLabel(r) {
  if (r === 5) return "SSR";
  if (r === 4) return "SR";
  if (r === 3) return "R";
  return "Other";
}

function normalizeWeaponList(u) {
  // toolbox version includes weaponType (e.g. Sword, Axe, etc.)
  // keep older compatibility (weapons array) if present
  if (Array.isArray(u.weapons)) return u.weapons.filter(Boolean).map(String);
  if (u.weaponType) return [String(u.weaponType)];
  return [];
}

function normalizeBestWeaponList(u) {
  if (Array.isArray(u.bestWeapons)) return u.bestWeapons.filter(Boolean).map(String);
  return [];
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// ---------- state ----------
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
    if (!Array.isArray(parsed.story) || parsed.story.length !== 8) return defaultState();
    if (!Array.isArray(parsed.platoons) || parsed.platoons.length !== 20) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

const state = loadState();

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

// ---------- Modal (Unit Details) ----------
let currentModalUnitId = null;

function initUnitModal() {
  const overlay = document.getElementById("unitModal");
  const close1 = document.getElementById("unitModalClose");
  const close2 = document.getElementById("unitModalClose2");

  function close() { closeUnitModal(); }

  close1?.addEventListener("click", close);
  close2?.addEventListener("click", close);

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  document.getElementById("unitModalAddStory")?.addEventListener("click", () => {
    if (!currentModalUnitId) return;
    addToStoryFirstEmpty(currentModalUnitId);
    closeUnitModal();
  });
}

function openUnitModal(unitId) {
  const u = unitById.get(unitId);
  if (!u) return;

  currentModalUnitId = unitId;

  const title = document.getElementById("unitModalTitle");
  const subtitle = document.getElementById("unitModalSubtitle");
  const badges = document.getElementById("unitModalBadges");

  const costEl = document.getElementById("unitModalCost");
  const atkEl = document.getElementById("unitModalAtk");
  const hpEl = document.getElementById("unitModalHp");
  const spdEl = document.getElementById("unitModalSpd");

  const leaderEl = document.getElementById("unitModalLeader");
  const activeEl = document.getElementById("unitModalActive");
  const passiveEl = document.getElementById("unitModalPassive");

  title.textContent = u.name || "Unknown";
  subtitle.textContent = u.title || "";

  // badges
  badges.innerHTML = "";
  const b1 = document.createElement("span");
  b1.className = "badge accent";
  b1.textContent = elementLabel(u.element);
  badges.appendChild(b1);

  const b2 = document.createElement("span");
  b2.className = "badge green";
  const r = Number(u.rarity || 0);
  b2.textContent = `${rarityLabel(r)} (${r || "?"})`;
  badges.appendChild(b2);

  // stats
  costEl.textContent = (u.cost ?? "-");
  atkEl.textContent = (u?.stats?.atk ?? getStat(u, "atk") ?? 0);
  hpEl.textContent = (u?.stats?.hp ?? getStat(u, "hp") ?? 0);
  spdEl.textContent = (u?.stats?.spd ?? getStat(u, "spd") ?? 0);

  // leader
  const leader = [
    u.leaderSkillName ? u.leaderSkillName : null,
    u.leaderSkillText ? u.leaderSkillText : (u.leaderSkill || null)
  ].filter(Boolean).join("\n");
  leaderEl.textContent = leader || "-";

  // skills
  activeEl.innerHTML = "";
  (Array.isArray(u.activeSkills) ? u.activeSkills : []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    activeEl.appendChild(li);
  });
  if (!activeEl.children.length) activeEl.innerHTML = `<li class="muted">-</li>`;

  passiveEl.innerHTML = "";
  (Array.isArray(u.passiveSkills) ? u.passiveSkills : []).forEach((s) => {
    const li = document.createElement("li");
    li.textContent = s;
    passiveEl.appendChild(li);
  });
  if (!passiveEl.children.length) passiveEl.innerHTML = `<li class="muted">-</li>`;

  // open
  const overlay = document.getElementById("unitModal");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

function closeUnitModal() {
  currentModalUnitId = null;
  const overlay = document.getElementById("unitModal");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
}

// ---------- load units (NEW FORMAT) ----------
fetch("data/units.toolbox.json")
  .then((r) => r.json())
  .then((data) => {
    units = Array.isArray(data?.units) ? data.units : [];

    unitById = new Map();
    units.forEach((u) => {
      u.__id = safeId(u);
      unitById.set(u.__id, u);
    });

    // init modal once DOM + data are ready
    initUnitModal();

    renderUnitPool();
    initRosterFilters();
    renderRoster();

    renderStoryTeam();
    renderPlatoons();

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

  // Click card => open modal
  div.addEventListener("click", () => openUnitModal(u.__id));

  div.innerHTML = `
    <div class="cardTop" style="display:flex; gap:10px; align-items:flex-start;">
      <div style="min-width:0;">
        <div class="name">${u.name ?? "Unknown"}</div>
        <div class="badges">
          <span class="badge accent">${elementLabel(u.element)}</span>
          <span class="badge green">${rarityLabel(rarity)} (${rarity || "?"})</span>
        </div>
      </div>
      ${onClickAdd ? `<button class="miniAdd" title="Add to Story Team">➕</button>` : ``}
    </div>

    <div class="stats">
      <div class="statRow"><span>ATK</span><b>${atk ?? 0}</b></div>
      <div class="statRow"><span>HP</span><b>${hp ?? 0}</b></div>
      <div class="statRow"><span>SPD</span><b>${spd ?? 0}</b></div>
      <div class="statRow"><span>Weapon</span><b>${weapons[0] ?? "-"}</b></div>
    </div>
  `;

  // Wire the mini add button (stop modal open)
  if (onClickAdd) {
    const addBtn = div.querySelector(".miniAdd");
    addBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      onClickAdd(u.__id);
    });
  }

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
  list.slice(0, 400).forEach((u) => grid.appendChild(unitCard(u, { onClickAdd: addToStoryFirstEmpty })));
}

// ---------- Story Team (8 slots) ----------
function addToStoryFirstEmpty(unitId) {
  const idx = state.story.findIndex((x) => !x);
  if (idx === -1) return;
  if (state.story.includes(unitId)) return;
  state.story[idx] = unitId;
  saveState();
  renderStoryTeam();
}

function setStorySlot(index, unitId) {
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
      body.appendChild(unitCard(u, { draggable: false }));
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.style.marginTop = "10px";
      btn.textContent = "Remove";
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        clearStorySlot(i);
      });
      body.appendChild(btn);
    }

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

// ---------- Platoons (20 × 5) ----------
function setPlatoonSlot(pIndex, sIndex, unitId) {
  if (unitId && state.platoons[pIndex].includes(unitId)) return; // no duplicates within platoon
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

      const unitId = state.platoons[p][s];
      const u = unitId ? unitById.get(unitId) : null;

      slot.innerHTML = `<div class="slotTitle">Slot ${s + 1}</div><div class="slotBody"></div>`;
      const body = slot.querySelector(".slotBody");

      if (!u) {
        body.innerHTML = `<div class="muted">Drop unit here</div>`;
      } else {
        body.appendChild(unitCard(u, { draggable: false }));
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.style.marginTop = "10px";
        btn.textContent = "Remove";
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          clearPlatoonSlot(p, s);
        });
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

// ---------- Optimizer (Leader parsing + weapon bonus) ----------
function scoreUnitBase(u, mode) {
  const atk = getStat(u, "atk");
  const hp = getStat(u, "hp");
  const spd = getStat(u, "spd");

  if (mode === "PVP") return atk * 1.25 + spd * 1.55 + hp * 0.35;
  if (mode === "BOSS") return atk * 1.6 + hp * 0.85 + spd * 0.2;
  if (mode === "STORY") return atk * 1.05 + hp * 0.8 + spd * 0.55;
  return atk + hp * 0.6 + spd * 0.5; // PVE
}

function parseLeaderSkill(text) {
  if (!text) return null;
  const t = String(text).replace(/\s+/g, " ").trim();

  const elementMatch = t.match(/\b(Fire|Water|Earth|Light|Dark|Storm)\b/i);
  const element = elementMatch ? elementMatch[1].toLowerCase() : "all";

  let stat = null;
  if (/\b(Attack|ATK)\b/i.test(t)) stat = "atk";
  else if (/\bHP\b/i.test(t)) stat = "hp";
  else if (/\b(Speed|SPD)\b/i.test(t)) stat = "spd";

  const pctMatch = t.match(/(\d+)\s*%/);
  if (!pctMatch || !stat) return null;
  const pct = Number(pctMatch[1]) / 100;

  const confidence = clamp(
    (/\b(allied|all allies|all)\b/i.test(t) ? 0.5 : 0.25) +
      (element !== "all" ? 0.25 : 0.1) +
      (pct ? 0.25 : 0),
    0,
    1
  );

  return { element, stat, pct, text: t, confidence };
}

function leaderBonusForUnit(unit, leaderParsed) {
  if (!leaderParsed) return 0;

  if (leaderParsed.element !== "all") {
    const ue = elementLabel(unit.element).toLowerCase();
    if (ue !== leaderParsed.element) return 0;
  }

  const baseStat = getStat(unit, leaderParsed.stat);
  return baseStat * leaderParsed.pct;
}

function weaponBonus(unit, baseScore) {
  const weapons = normalizeWeaponList(unit);
  const best = normalizeBestWeaponList(unit);

  if (!weapons.length && !best.length) return 0;

  if (best.length) {
    const set = new Set(weapons.map((x) => x.toLowerCase()));
    const match = best.some((b) => set.has(String(b).toLowerCase()));
    if (match) return baseScore * OPT_CONFIG.weaponBonusMatchBest;
  }

  if (weapons.length) return baseScore * OPT_CONFIG.weaponBonusPrimary;

  return 0;
}

function optimize() {
  const mode = el("mode").value;
  const size = Number(el("teamSize").value);
  const results = el("results");

  let best = null;

  for (const leader of units) {
    const leaderParsed = parseLeaderSkill(leader.leaderSkillText || leader.leaderSkill);

    const scored = units.map((u) => {
      const base = scoreUnitBase(u, mode);
      const lb = leaderBonusForUnit(u, leaderParsed);
      const wb = weaponBonus(u, base);
      return { u, score: base + lb + wb, leaderBonus: lb, weaponBonus: wb };
    });

    const leaderId = leader.__id;
    const leaderEntry = scored.find((x) => x.u.__id === leaderId);
    if (!leaderEntry) continue;

    scored.sort((a, b) => b.score - a.score);

    const team = [];
    team.push({ ...leaderEntry, isLeader: true });

    for (const entry of scored) {
      if (team.length >= size) break;
      if (entry.u.__id === leaderId) continue;
      team.push(entry);
    }

    const total = team.reduce((sum, x) => sum + x.score, 0);
    if (!best || total > best.total) best = { leader, leaderParsed, team, total };
  }

  if (!best) {
    results.innerHTML = `<div class="muted">No results.</div>`;
    return;
  }

  const lp = best.leaderParsed;
  const leaderLine = lp
    ? `<div class="muted">Leader Skill (${Math.round(lp.confidence * 100)}% match): ${lp.text}</div>`
    : `<div class="muted">Leader Skill: (none parsed)</div>`;

  results.innerHTML = `
    <div class="muted">Best team by ${mode} score (Leader+Weapon bonuses)</div>
    <div><b>Leader:</b> ${best.leader.name}</div>
    ${leaderLine}
    <ul style="margin-top:10px">
      ${best.team
        .map((x) => {
          const tags = x.isLeader ? "👑 " : "";
          const lb = x.leaderBonus ? `LS +${Math.round(x.leaderBonus)}` : "";
          const wb = x.weaponBonus ? `W +${Math.round(x.weaponBonus)}` : "";
          const extras = [lb, wb].filter(Boolean).join(" · ");
          return `<li>${tags}<b>${x.u.name}</b> — ${Math.round(x.score)}${extras ? ` <span class="muted">(${extras})</span>` : ""}</li>`;
        })
        .join("")}
    </ul>
    <button class="btn primary" id="applyStory">Apply to Story Team (front slots)</button>
  `;

  document.getElementById("applyStory")?.addEventListener("click", () => {
    for (let i = 0; i < 5; i++) state.story[i] = null;
    const ids = best.team.map((x) => x.u.__id);
    for (let i = 0; i < Math.min(5, ids.length); i++) state.story[i] = ids[i];
    saveState();
    renderStoryTeam();

    document.querySelectorAll(".tab, .tab-content").forEach((x) => x.classList.remove("active"));
    document.querySelector(`.tab[data-tab="story"]`)?.classList.add("active");
    document.getElementById("story")?.classList.add("active");
  });
}

window.optimize = optimize;
