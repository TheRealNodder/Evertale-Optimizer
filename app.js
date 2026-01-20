/* app.js — Roster + Optimizer (FULL, SAFE for your characters.json structure) */

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v2"; // bump key so old bad data doesn't conflict

const state = {
  units: [],
  owned: new Set(),
  tab: "roster", // "roster" | "optimizer"
  filters: {
    q: "",
    element: "all",
    rarity: "all",
    ownedOnly: false,
  },
  optimizer: {
    mode: "story", // "story" | "platoons"
    story: { main: Array(5).fill(""), backup: Array(3).fill("") },
    platoons: Array.from({ length: 20 }, () => Array(5).fill("")),
  },
};

/* ---------------- Helpers ---------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function txt(v, fallback = "") {
  return v === undefined || v === null ? fallback : String(v);
}

function toInt(v, fallback = 0) {
  const n = Number(String(v).replaceAll(",", "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function normKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim()
    .replaceAll(/\s+/g, " ");
}

function loadOwned() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveOwned() {
  localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
}

/* ---------------- Data load + normalize ---------------- */
async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_CHARACTERS} (${res.status})`);
  const json = await res.json();

  // Your file is: { generatedAt, source, characters: [...] }
  let arr = [];
  if (Array.isArray(json)) arr = json;
  else if (Array.isArray(json.characters)) arr = json.characters;
  else throw new Error("ERROR LOADING characters.json is not an array (expected json.characters[])");

  // Normalize units to be safe for rendering/optimizer
  return arr
    .filter((u) => u && u.category === "character")
    .map((u, idx) => {
      const id = txt(u.id, `unit_${idx}`);
      const name = txt(u.name, "");
      const title = txt(u.title, "");
      const fullName = title ? `${name} ${title}` : name;

      const element = txt(u.element, "Unknown");
      const rarity = txt(u.rarity, "Unknown");

      const cost = toInt(u.cost, 0);
      const atk = toInt(u.atk, 0);
      const hp = toInt(u.hp, 0);
      const spd = toInt(u.spd, 0);

      const image = txt(u.image, "");

      const leaderName = txt(u.leaderSkill?.name, "None");
      const leaderDesc = txt(u.leaderSkill?.description, "None");

      const activeSkillDetails = Array.isArray(u.activeSkillDetails) ? u.activeSkillDetails : [];
      const passiveSkillDetails = Array.isArray(u.passiveSkillDetails) ? u.passiveSkillDetails : [];

      // fallback arrays (some builds have these instead)
      const activeSkills = Array.isArray(u.activeSkills) ? u.activeSkills : [];
      const passiveSkills = Array.isArray(u.passiveSkills) ? u.passiveSkills : [];

      return {
        ...u,
        id,
        name,
        title,
        fullName,
        element,
        rarity,
        cost,
        atk,
        hp,
        spd,
        image,
        leaderSkill: {
          name: leaderName,
          description: leaderDesc,
        },
        activeSkillDetails,
        passiveSkillDetails,
        activeSkills,
        passiveSkills,
        _normFullName: normKey(fullName),
        _normId: normKey(id),
      };
    });
}

/* ---------------- Tabs ---------------- */
function setTab(tab) {
  state.tab = tab;
  $("#pageRoster")?.classList.toggle("hidden", tab !== "roster");
  $("#pageOptimizer")?.classList.toggle("hidden", tab !== "optimizer");

  $$(".tab").forEach((b) => b.classList.remove("active"));
  if (tab === "roster") $("#tabRoster")?.classList.add("active");
  if (tab === "optimizer") $("#tabOptimizer")?.classList.add("active");

  if (tab === "optimizer") renderOptimizer();
}

/* ---------------- Roster rendering ---------------- */
function unitMatchesFilters(u) {
  const q = state.filters.q.trim().toLowerCase();
  if (q) {
    const hay = `${u.fullName} ${u.element} ${u.rarity} ${u.weaponType ?? ""}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (state.filters.element !== "all" && u.element !== state.filters.element) return false;
  if (state.filters.rarity !== "all" && u.rarity !== state.filters.rarity) return false;
  if (state.filters.ownedOnly && !state.owned.has(u.id)) return false;
  return true;
}

function renderUnitCard(u) {
  const leaderHas =
    u.leaderSkill &&
    u.leaderSkill.name &&
    u.leaderSkill.name !== "None" &&
    u.leaderSkill.description &&
    u.leaderSkill.description !== "None";

  const leaderName = leaderHas ? u.leaderSkill.name : "No Leader Skill";
  const leaderDesc = leaderHas ? u.leaderSkill.description : "This unit does not provide a leader skill.";

  const imgHtml = u.image
    ? `<img src="${escapeHtml(u.image)}" alt="${escapeHtml(u.fullName)}">`
    : `<div class="ph">?</div>`;

  const checked = state.owned.has(u.id) ? "checked" : "";

  return `
  <div class="unitCard" data-unit-id="${escapeHtml(u.id)}">
    <div class="unitThumb">${imgHtml}</div>

    <div class="meta">
      <div class="topRow">
        <div>
          <div class="unitName">${escapeHtml(u.name)}</div>
          <div class="unitTitle">${escapeHtml(u.title)}</div>
        </div>

        <div class="tags">
          <span class="tag rarity">${escapeHtml(u.rarity)}</span>
          <span class="tag element">${escapeHtml(u.element)}</span>
        </div>
      </div>

      <div class="statLine">
        <div class="stat"><strong>ATK</strong> ${escapeHtml(String(u.atk))}</div>
        <div class="stat"><strong>HP</strong> ${escapeHtml(String(u.hp))}</div>
        <div class="stat"><strong>SPD</strong> ${escapeHtml(String(u.spd))}</div>
        <div class="stat"><strong>COST</strong> ${escapeHtml(String(u.cost))}</div>
      </div>

      <!-- LEADER SKILL: ALWAYS RENDERED -->
      <div class="leaderBlock">
        <div class="leaderName">${escapeHtml(leaderName)}</div>
        <div class="leaderDesc">${escapeHtml(leaderDesc)}</div>
      </div>

      <label class="ownedRow">
        <input class="ownedCheck" type="checkbox" data-owned-id="${escapeHtml(u.id)}" ${checked}>
        <span class="ownedLabel">Owned</span>
      </label>
    </div>
  </div>
  `;
}

function renderRoster() {
  const grid = $("#unitGrid");
  if (!grid) return;

  const list = state.units.filter(unitMatchesFilters);

  grid.innerHTML = list.map(renderUnitCard).join("");

  // wire owned toggles
  $$("#unitGrid input[data-owned-id]").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = e.target.getAttribute("data-owned-id");
      if (!id) return;
      if (e.target.checked) state.owned.add(id);
      else state.owned.delete(id);
      saveOwned();

      // If ownedOnly filter is enabled, refresh
      if (state.filters.ownedOnly) renderRoster();
      // optimizer needs refresh too
      renderOptimizerSummary();
      renderOptimizerOwnedPool();
    });
  });

  renderOptimizerSummary();
}

/* ---------------- Optimizer UI ---------------- */
function getOwnedUnits() {
  return state.units.filter((u) => state.owned.has(u.id));
}

function renderOptimizerSummary() {
  const el = $("#ownedCount");
  if (!el) return;
  el.textContent = `${getOwnedUnits().length} owned`;
}

function optionList(units) {
  const opts = [`<option value="">(empty)</option>`];
  for (const u of units) {
    opts.push(`<option value="${escapeHtml(u.id)}">${escapeHtml(u.fullName)}</option>`);
  }
  return opts.join("");
}

function renderSlotSelect(slotId, units, selectedId) {
  const opts = optionList(units);
  return `
    <select class="slotPick" data-slot="${escapeHtml(slotId)}">
      ${opts}
    </select>
  `.replace(
    `value="${escapeHtml(selectedId)}"`,
    `value="${escapeHtml(selectedId)}" selected`
  );
}

function renderPickedUnitMini(u) {
  if (!u) return `<div class="muted">Empty</div>`;
  const leaderHas =
    u.leaderSkill?.name && u.leaderSkill.name !== "None" &&
    u.leaderSkill?.description && u.leaderSkill.description !== "None";

  return `
    <div style="display:flex; gap:10px; align-items:flex-start;">
      <div style="width:52px; height:52px; border-radius:10px; overflow:hidden; background:rgba(255,255,255,0.06); flex:0 0 auto;">
        ${u.image ? `<img src="${escapeHtml(u.image)}" alt="${escapeHtml(u.fullName)}" style="width:100%;height:100%;object-fit:cover;display:block;">` : ""}
      </div>
      <div style="min-width:0;">
        <div style="font-weight:900; line-height:1.2;">${escapeHtml(u.name)}</div>
        <div style="color:var(--muted); font-size:12px; line-height:1.2;">${escapeHtml(u.title)}</div>
        <div style="margin-top:6px; font-weight:800; font-size:12px;">
          ATK ${escapeHtml(String(u.atk))} • ${escapeHtml(u.element)} • ${escapeHtml(u.rarity)}
        </div>
        <div style="margin-top:6px; color:var(--muted); font-size:12px; line-height:1.25;">
          <strong style="color:var(--text);">Leader:</strong>
          ${leaderHas ? escapeHtml(u.leaderSkill.name) : "None"}
        </div>
      </div>
    </div>
  `;
}

function renderOptimizerOwnedPool() {
  const wrap = $("#ownedPool");
  if (!wrap) return;

  const owned = getOwnedUnits();
  if (owned.length === 0) {
    wrap.innerHTML = `<div class="muted">No owned units selected yet. Go to the Roster tab and check “Owned”.</div>`;
    return;
  }

  // lightweight view: name + stats
  wrap.innerHTML = `
    <div class="muted" style="margin-bottom:8px;">Owned pool (used for auto-build):</div>
    <div style="display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:8px;">
      ${owned
        .slice(0, 1200)
        .map(
          (u) => `
        <div class="panel" style="padding:10px;">
          <div style="font-weight:900; line-height:1.15;">${escapeHtml(u.fullName)}</div>
          <div class="muted" style="margin-top:4px;">ATK ${escapeHtml(
            String(u.atk)
          )} • ${escapeHtml(u.element)} • ${escapeHtml(u.rarity)}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function setOptimizerMode(mode) {
  state.optimizer.mode = mode;
  $$(".pill").forEach((p) => p.classList.remove("active"));
  if (mode === "story") $("#pillStory")?.classList.add("active");
  if (mode === "platoons") $("#pillPlatoons")?.classList.add("active");
  renderOptimizer();
}

function renderOptimizer() {
  const root = $("#optimizerRoot");
  if (!root) return;

  const ownedUnits = getOwnedUnits();
  const ownedOpts = optionList(ownedUnits);

  const mode = state.optimizer.mode;

  let html = `
    <div class="panel">
      <div class="optHeader">
        <div>
          <div class="panelTitle">Optimizer</div>
          <div class="muted" id="ownedCount"></div>
        </div>
        <div class="optMode">
          <button class="pill ${mode === "story" ? "active" : ""}" id="pillStory" type="button">Story (5+3)</button>
          <button class="pill ${mode === "platoons" ? "active" : ""}" id="pillPlatoons" type="button">Platoons (20x5)</button>
        </div>
      </div>

      <div class="panelRow">
        <div>
          <div class="panelTitle">Auto build</div>
          <div class="muted">Uses Owned pool + leader skills + element + ATK baseline.</div>
        </div>
        <button class="btn" id="btnBuildBest" type="button">Build Best Team</button>
      </div>
    </div>
  `;

  if (mode === "story") {
    html += `
      <div class="panel teamBlock">
        <div class="panelTitle">Story Team</div>
        <div class="muted" style="margin-top:4px;">Main lineup (5) + Backup (3)</div>

        <div class="teamSubTitle" style="margin-top:12px;">Main</div>
        <div class="slotGrid">
          ${state.optimizer.story.main
            .map((id, i) => {
              return `
                <div class="slot">
                  <div class="slotTitle">Main ${i + 1}</div>
                  <select class="slotPick" data-story="main" data-index="${i}">
                    ${ownedOpts}
                  </select>
                  <div class="panel" style="padding:10px; background:rgba(255,255,255,0.03);">
                    ${renderPickedUnitMini(state.units.find((u) => u.id === id))}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <div class="teamSubTitle" style="margin-top:12px;">Backup</div>
        <div class="slotGrid">
          ${state.optimizer.story.backup
            .map((id, i) => {
              return `
                <div class="slot">
                  <div class="slotTitle">Backup ${i + 1}</div>
                  <select class="slotPick" data-story="backup" data-index="${i}">
                    ${ownedOpts}
                  </select>
                  <div class="panel" style="padding:10px; background:rgba(255,255,255,0.03);">
                    ${renderPickedUnitMini(state.units.find((u) => u.id === id))}
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="panel teamBlock">
        <div class="panelTitle">Platoons</div>
        <div class="muted" style="margin-top:4px;">20 platoons, 5 units each (lightweight view).</div>

        ${state.optimizer.platoons
          .map((slots, pIdx) => {
            return `
              <div class="panel" style="margin-top:12px;">
                <div class="panelTitle">Platoon ${pIdx + 1}</div>
                <div class="slotGrid">
                  ${slots
                    .map((id, sIdx) => {
                      const u = state.units.find((x) => x.id === id);
                      return `
                        <div class="slot" style="min-height: 120px;">
                          <div class="slotTitle">Slot ${sIdx + 1}</div>
                          <select class="slotPick" data-platoon="${pIdx}" data-index="${sIdx}">
                            ${ownedOpts}
                          </select>
                          <div class="muted" style="margin-top:6px; font-weight:800;">
                            ${u ? escapeHtml(u.fullName) : "Empty"}
                          </div>
                        </div>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  html += `
    <div class="panel" style="margin-top:12px;">
      <div class="panelTitle">Owned Pool</div>
      <div id="ownedPool"></div>
    </div>
  `;

  root.innerHTML = html;

  // wiring
  $("#pillStory")?.addEventListener("click", () => setOptimizerMode("story"));
  $("#pillPlatoons")?.addEventListener("click", () => setOptimizerMode("platoons"));
  $("#btnBuildBest")?.addEventListener("click", () => autoBuildBest());

  $$("#optimizerRoot select.slotPick").forEach((sel) => {
    // set correct current selection (because we generated raw options)
    const storyKind = sel.getAttribute("data-story");
    const platoonIdx = sel.getAttribute("data-platoon");
    const index = toInt(sel.getAttribute("data-index"), 0);

    let current = "";
    if (storyKind === "main") current = state.optimizer.story.main[index] || "";
    if (storyKind === "backup") current = state.optimizer.story.backup[index] || "";
    if (platoonIdx !== null) current = state.optimizer.platoons[toInt(platoonIdx, 0)][index] || "";

    // mark selected option
    const opts = Array.from(sel.options);
    for (const o of opts) {
      if (o.value === current) o.selected = true;
    }

    sel.addEventListener("change", (e) => {
      const val = e.target.value || "";
      const sk = e.target.getAttribute("data-story");
      const p = e.target.getAttribute("data-platoon");
      const idx = toInt(e.target.getAttribute("data-index"), 0);

      if (sk === "main") state.optimizer.story.main[idx] = val;
      else if (sk === "backup") state.optimizer.story.backup[idx] = val;
      else if (p !== null) state.optimizer.platoons[toInt(p, 0)][idx] = val;

      // re-render to update minis
      renderOptimizer();
    });
  });

  renderOptimizerSummary();
  renderOptimizerOwnedPool();
}

/* ---------------- Auto build logic (baseline) ----------------
   Goal: pick a mono-element squad when possible by choosing:
   - best leader bonus for an element (leader skill text contains element)
   - higher ATK units prioritized
   This is a baseline; you can improve synergy scoring later.
--------------------------------------------------------------*/

function leaderElementHint(leaderName, leaderDesc) {
  const s = `${leaderName} ${leaderDesc}`.toLowerCase();
  const elems = ["fire", "water", "storm", "light", "dark", "earth"];
  for (const e of elems) {
    if (s.includes(`allied ${e} element`) || s.includes(`${e} element units`)) return e[0].toUpperCase() + e.slice(1);
  }
  return null;
}

function leaderPowerScore(leaderName, leaderDesc) {
  // quick parse: +10% atk is very valuable, +7/10% hp also helps
  const s = `${leaderName} ${leaderDesc}`.toLowerCase();
  let score = 0;

  // very simple weight
  if (s.includes("attack increased by 10%")) score += 100;
  if (s.includes("attack increased by 5%")) score += 50;

  if (s.includes("max hp increased by 10%")) score += 60;
  if (s.includes("max hp increased by 7%")) score += 45;

  // fallback: any leader skill exists
  if (leaderName && leaderName !== "None") score += 10;
  return score;
}

function autoBuildBest() {
  const owned = getOwnedUnits();
  if (owned.length === 0) {
    alert("No owned units selected. Go to Roster and mark Owned units first.");
    return;
  }

  // determine best mono element target based on leader strength + atk pool
  const byElem = new Map();
  for (const u of owned) {
    if (!byElem.has(u.element)) byElem.set(u.element, []);
    byElem.get(u.element).push(u);
  }

  let bestElem = null;
  let bestElemScore = -1;

  for (const [elem, list] of byElem.entries()) {
    // best leader within this element
    let bestLeader = null;
    let bestLeaderScore = -1;
    for (const u of list) {
      const ln = u.leaderSkill?.name || "None";
      const ld = u.leaderSkill?.description || "";
      const score = leaderPowerScore(ln, ld);

      // optionally require the leader to match the element hint
      const hint = leaderElementHint(ln, ld);
      const matchesElem = !hint || hint === elem;

      if (matchesElem && score > bestLeaderScore) {
        bestLeaderScore = score;
        bestLeader = u;
      }
    }

    // overall element score: leader score + sum of top atk
    const topAtk = [...list].sort((a, b) => b.atk - a.atk).slice(0, 8);
    const atkScore = topAtk.reduce((acc, u) => acc + u.atk, 0);

    const total = bestLeaderScore * 5 + atkScore; // leader matters
    if (total > bestElemScore) {
      bestElemScore = total;
      bestElem = elem;
    }
  }

  // Build story team from best element if we can, else top ATK overall
  let pool = owned;
  if (bestElem && byElem.get(bestElem)?.length >= 5) pool = byElem.get(bestElem);

  // Prefer a good leader first, then fill by ATK
  const sorted = [...pool].sort((a, b) => b.atk - a.atk);
  let leader = null;
  let leaderScore = -1;
  for (const u of pool) {
    const ln = u.leaderSkill?.name || "None";
    const ld = u.leaderSkill?.description || "";
    const hint = leaderElementHint(ln, ld);
    const matchesElem = !bestElem || !hint || hint === bestElem;
    const s = leaderPowerScore(ln, ld) + (matchesElem ? 20 : 0);
    if (s > leaderScore) {
      leaderScore = s;
      leader = u;
    }
  }

  const pickIds = [];
  if (leader) pickIds.push(leader.id);

  for (const u of sorted) {
    if (pickIds.length >= 8) break;
    if (!pickIds.includes(u.id)) pickIds.push(u.id);
  }

  // Assign to story layout
  state.optimizer.mode = "story";
  state.optimizer.story.main = pickIds.slice(0, 5);
  state.optimizer.story.backup = pickIds.slice(5, 8);

  setTab("optimizer");
  renderOptimizer();
}

/* ---------------- Init wiring ---------------- */
function populateFilters() {
  // Elements + Rarity from data
  const elSel = $("#elementSelect");
  const rarSel = $("#raritySelect");
  if (!elSel || !rarSel) return;

  const elements = Array.from(new Set(state.units.map((u) => u.element))).sort();
  const rarities = Array.from(new Set(state.units.map((u) => u.rarity))).sort((a, b) => {
    const order = { N: 0, R: 1, SR: 2, SSR: 3 };
    return (order[a] ?? 99) - (order[b] ?? 99);
  });

  elSel.innerHTML = `<option value="all">All Elements</option>` + elements.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
  rarSel.innerHTML = `<option value="all">All Rarities</option>` + rarities.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");

  elSel.value = state.filters.element;
  rarSel.value = state.filters.rarity;

  elSel.addEventListener("change", (e) => {
    state.filters.element = e.target.value;
    renderRoster();
  });
  rarSel.addEventListener("change", (e) => {
    state.filters.rarity = e.target.value;
    renderRoster();
  });
}

async function init() {
  state.owned = loadOwned();

  // tabs
  $("#tabRoster")?.addEventListener("click", () => setTab("roster"));
  $("#tabOptimizer")?.addEventListener("click", () => setTab("optimizer"));

  // filters
  $("#searchInput")?.addEventListener("input", (e) => {
    state.filters.q = e.target.value;
    renderRoster();
  });

  $("#ownedOnly")?.addEventListener("change", (e) => {
    state.filters.ownedOnly = !!e.target.checked;
    renderRoster();
  });

  try {
    state.units = await loadCharacters();
    populateFilters();
    renderRoster();
    renderOptimizer(); // build structure now
    setTab("roster");
  } catch (err) {
    console.error(err);
    const grid = $("#unitGrid");
    if (grid) grid.textContent = `Failed to load characters.json: ${err.message}`;
  }
}

document.addEventListener("DOMContentLoaded", init);