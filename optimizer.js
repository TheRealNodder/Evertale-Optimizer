/* optimizer.js — FULL Optimizer Engine (Story 5+3, Platoons 20x5)
   - Reads owned from localStorage evertale_owned_units_v1
   - Uses characters.json as canonical (no mutation)
   - Renders slot grids + dropdowns
   - Build best teams using tag/role/leader/stat scoring + greedy+beam-lite
*/

const DATA_CHARACTERS = "./data/characters.json";
const OWNED_KEY = "evertale_owned_units_v1";
const LAYOUT_KEY = "evertale_team_layout_v1";

const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

const state = {
  all: [],
  ownedIds: new Set(),
  ownedUnits: [],
  layout: null,
  mode: "story", // "story" | "platoons"
};

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function getOwnedIds() {
  const arr = safeJsonParse(localStorage.getItem(OWNED_KEY) || "[]", []);
  return new Set(Array.isArray(arr) ? arr : []);
}

function saveLayout() {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(state.layout));
}

function loadLayout() {
  const empty = {
    storyMain: Array(STORY_MAIN).fill(""),
    storyBack: Array(STORY_BACK).fill(""),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
  };
  const obj = safeJsonParse(localStorage.getItem(LAYOUT_KEY) || "null", null);
  if (!obj) return empty;

  // sanitize
  if (!Array.isArray(obj.storyMain)) obj.storyMain = empty.storyMain;
  if (!Array.isArray(obj.storyBack)) obj.storyBack = empty.storyBack;
  if (!Array.isArray(obj.platoons)) obj.platoons = empty.platoons;

  obj.storyMain = obj.storyMain.slice(0, STORY_MAIN).concat(Array(STORY_MAIN).fill("")).slice(0, STORY_MAIN);
  obj.storyBack = obj.storyBack.slice(0, STORY_BACK).concat(Array(STORY_BACK).fill("")).slice(0, STORY_BACK);

  obj.platoons = obj.platoons.slice(0, PLATOON_COUNT);
  while (obj.platoons.length < PLATOON_COUNT) obj.platoons.push(Array(PLATOON_SIZE).fill(""));
  obj.platoons = obj.platoons.map(row => {
    const r = Array.isArray(row) ? row : [];
    return r.slice(0, PLATOON_SIZE).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE);
  });

  return obj;
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${DATA_CHARACTERS}: ${res.status}`);
  const json = await res.json();
  const chars = Array.isArray(json) ? json : (json && Array.isArray(json.characters) ? json.characters : []);
  return chars;
}

function textBlob(u) {
  const parts = [];
  if (u.leaderSkill?.name) parts.push(u.leaderSkill.name);
  if (u.leaderSkill?.description) parts.push(u.leaderSkill.description);

  const act = Array.isArray(u.activeSkillDetails) ? u.activeSkillDetails : (Array.isArray(u.activeSkills) ? u.activeSkills : []);
  for (const s of act) {
    if (s?.name) parts.push(s.name);
    if (s?.description) parts.push(s.description);
  }

  const pas = Array.isArray(u.passiveSkillDetails) ? u.passiveSkillDetails : [];
  for (const p of pas) {
    if (p?.name) parts.push(p.name);
    if (p?.description) parts.push(p.description);
  }

  return parts.join(" ").toLowerCase();
}

const TAGS = [
  ["poison", [/poison/i, /toxic/i, /venom/i]],
  ["burn", [/burn/i, /ignite/i]],
  ["sleep", [/sleep/i, /dream/i]],
  ["stun", [/stun/i, /freeze/i, /silence/i]],
  ["heal", [/heal/i, /regen/i, /recovery/i, /revive/i, /resurrect/i]],
  ["buff_atk", [/attack up/i, /atk up/i, /attack increased/i, /damage up/i]],
  ["buff_hp", [/max hp/i, /hp increased/i, /damage reduction/i, /shield/i, /barrier/i]],
  ["turn", [/tu/i, /turn/i, /push back/i, /time strike/i]],
  ["cleanse", [/cleanse/i, /purify/i, /remove.*debuff/i, /immunity/i]],
];

function tagUnit(u) {
  const blob = textBlob(u);
  const tags = new Set();
  for (const [name, regs] of TAGS) {
    if (regs.some(r => r.test(blob))) tags.add(name);
  }
  return { blob, tags };
}

function stats(u) {
  const s = u.stats || {};
  const atk = s.atk ?? u.atk ?? 0;
  const hp = s.hp ?? u.hp ?? 0;
  const spd = s.spd ?? u.spd ?? 0;
  const cost = s.cost ?? u.cost ?? 1;
  return { atk: +atk || 0, hp: +hp || 0, spd: +spd || 0, cost: +cost || 1 };
}

function leaderScope(u) {
  const desc = (u.leaderSkill?.description || "").toLowerCase();
  const el = (u.element || "").toLowerCase();

  // simple detectable patterns
  const elements = ["fire", "water", "storm", "earth", "light", "dark"];
  for (const e of elements) {
    if (desc.includes(e)) return { type: "element", value: e };
  }
  // tag-based leader
  if (desc.includes("sleep")) return { type: "tag", value: "sleep" };
  if (desc.includes("poison")) return { type: "tag", value: "poison" };
  if (desc.includes("burn")) return { type: "tag", value: "burn" };
  if (desc.includes("stun")) return { type: "tag", value: "stun" };

  // fallback: all allies
  return { type: "all", value: el || "all" };
}

function parsePercentBonus(desc) {
  // capture simple “+XX%” mentions; if none, return 0
  const m = String(desc || "").match(/(\d{1,3})\s*%/);
  if (!m) return 0;
  const v = Math.max(0, Math.min(100, parseInt(m[1], 10)));
  return v;
}

/* -------- Team scoring weights (from your memory doc) -------- */
const STATUS_WEIGHT = {
  poison: 5,
  burn: 5,
  sleep: 4,
  stun: 4,
  heal: 4,
  buff_atk: 3,
  buff_hp: 3,
  turn: 5,
  cleanse: 3,
};

function unitBaseScore(u) {
  const { atk, hp, spd, cost } = stats(u);
  const { tags } = u.__opt;

  // ATK heavy, but tempo + hp matters; efficiency helps low-cost units
  let score = 0;
  score += atk * 1.0;
  score += spd * 0.35;
  score += hp * 0.12;
  score += (atk / Math.max(1, cost)) * 0.35;

  for (const t of tags) {
    score += (STATUS_WEIGHT[t] || 0) * 900; // big enough to matter vs raw stats
  }
  return score;
}

function teamElementProfile(team) {
  const counts = new Map();
  for (const u of team) {
    const e = (u.element || "Unknown");
    counts.set(e, (counts.get(e) || 0) + 1);
  }
  const entries = [...counts.entries()].sort((a,b)=>b[1]-a[1]);
  const top = entries[0] || ["Unknown", 0];
  const distinct = counts.size;
  return { counts, topElement: top[0], topCount: top[1], distinct };
}

function leaderTeamScore(leader, team) {
  const scope = leaderScope(leader);
  const bonusPct = parsePercentBonus(leader.leaderSkill?.description || "");

  let match = 0;
  for (const u of team) {
    if (scope.type === "all") match++;
    else if (scope.type === "element" && (u.element || "").toLowerCase() === scope.value) match++;
    else if (scope.type === "tag" && u.__opt.tags.has(scope.value)) match++;
  }

  const ratio = match / Math.max(1, team.length);

  // base leader value: matching matters most; % bonus (if found) adds more
  let v = 0.18 * ratio;
  if (bonusPct > 0) v += (bonusPct / 100) * 0.22 * ratio;
  return v; // used as multiplier later
}

function synergyScore(team) {
  // reward coverage + key pairs
  const tagCounts = new Map();
  for (const u of team) {
    for (const t of u.__opt.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }

  let score = 0;

  // coverage (cap)
  const distinct = tagCounts.size;
  score += Math.min(6, distinct) * 0.8;

  // pair synergies
  const has = (t) => (tagCounts.get(t) || 0) > 0;
  if (has("sleep") && has("turn")) score += 1.6;
  if (has("poison") && has("turn")) score += 1.2;
  if (has("burn") && has("heal")) score += 1.2;
  if (has("heal") && has("buff_hp")) score += 1.0;
  if (has("buff_atk") && team.some(u => stats(u).atk > 4000)) score += 1.0;

  // role-ish constraints (soft)
  const dps = team.filter(u => stats(u).atk > 3500).length;
  const sustain = team.filter(u => u.__opt.tags.has("heal")).length;
  const control = team.filter(u => u.__opt.tags.has("sleep") || u.__opt.tags.has("stun")).length;

  if (dps < 2) score -= 1.6;
  if (sustain < 1) score -= 1.4;
  if (control < 1) score -= 0.8;

  return score;
}

function elementStrategyScore(team, leader) {
  const prof = teamElementProfile(team);
  const topRatio = prof.topCount / Math.max(1, team.length);

  // auto mode:
  // - prefer mono if leader mentions an element and team leans that way
  // - otherwise slight preference for having 3+ elements
  const leaderDesc = (leader?.leaderSkill?.description || "").toLowerCase();
  const leaderIsElemental = ["fire","water","storm","earth","light","dark"].some(e => leaderDesc.includes(e));

  let score = 0;
  if (topRatio >= 0.75) score += leaderIsElemental ? 1.4 : 0.7; // mono
  if (prof.distinct >= 4) score += 0.8; // rainbow-ish
  return score;
}

function scoreTeam(team) {
  // base power: average unit base score (normalized-ish)
  const base = team.reduce((a,u)=>a + u.__opt.base, 0) / Math.max(1, team.length);

  // choose best leader among team
  let bestLeaderMult = 0;
  let bestLeader = null;
  for (const l of team) {
    const v = leaderTeamScore(l, team);
    if (v > bestLeaderMult) { bestLeaderMult = v; bestLeader = l; }
  }

  const syn = synergyScore(team);
  const elem = elementStrategyScore(team, bestLeader);

  const total = (base / 6000) + syn + elem; // scale base down
  const final = total * (1 + bestLeaderMult);

  return { final, bestLeaderId: bestLeader?.id || "", breakdown: { base, syn, elem, leaderMult: bestLeaderMult } };
}

/* ---------------- Team builders ---------------- */

function takeTopCandidates(units, limit = 70) {
  // include top overall + per element diversity
  const sorted = [...units].sort((a,b)=>b.__opt.base - a.__opt.base);
  const pool = [];
  const seen = new Set();

  function add(u) {
    if (!u || seen.has(u.id)) return;
    seen.add(u.id);
    pool.push(u);
  }

  sorted.slice(0, Math.min(limit, sorted.length)).forEach(add);

  const byEl = new Map();
  for (const u of sorted) {
    const e = u.element || "Unknown";
    if (!byEl.has(e)) byEl.set(e, []);
    byEl.get(e).push(u);
  }
  for (const [_, arr] of byEl.entries()) {
    arr.slice(0, 12).forEach(add);
  }

  return pool;
}

function buildBestStoryTeam(units, lockedIds = []) {
  const locked = lockedIds.map(id => units.find(u=>u.id===id)).filter(Boolean);
  const lockedSet = new Set(locked.map(u=>u.id));

  const pool = takeTopCandidates(units, 80).filter(u => !lockedSet.has(u.id));

  // beam-lite: keep top partial teams
  const target = STORY_MAIN + STORY_BACK;
  const beamWidth = 120;

  let beam = [{ team: [...locked], score: locked.length ? scoreTeam(locked).final : 0 }];

  for (let i = locked.length; i < target; i++) {
    const next = [];
    for (const b of beam) {
      for (const u of pool) {
        if (b.team.some(x => x.id === u.id)) continue;
        const t = [...b.team, u];
        const s = scoreTeam(t).final;
        next.push({ team: t, score: s });
      }
    }
    next.sort((a,b)=>b.score - a.score);
    beam = next.slice(0, beamWidth);
  }

  const best = beam[0]?.team || locked;
  const bestScore = scoreTeam(best);
  // assign main/back: frontline prefers speed/control, back prefers atk/heal
  const scored = best.map(u => {
    const st = stats(u);
    const front = st.spd * 0.8 + (u.__opt.tags.has("sleep")||u.__opt.tags.has("stun") ? 1200 : 0) + st.hp * 0.15;
    const back = st.atk * 0.7 + (u.__opt.tags.has("heal") ? 1200 : 0);
    return { u, front, back };
  });

  scored.sort((a,b)=>b.front - a.front);
  const main = scored.slice(0, STORY_MAIN).map(x=>x.u.id);
  const back = scored.slice(STORY_MAIN).sort((a,b)=>b.back - a.back).slice(0, STORY_BACK).map(x=>x.u.id);

  return { main, back, leaderId: bestScore.bestLeaderId };
}

function buildBestPlatoons(units, usedIds = new Set()) {
  const remaining = units.filter(u => !usedIds.has(u.id));
  const pool = takeTopCandidates(remaining, 140);

  const platoons = [];

  for (let p = 0; p < PLATOON_COUNT; p++) {
    // greedy build 5 using incremental team scoring
    let team = [];
    for (let k = 0; k < PLATOON_SIZE; k++) {
      let best = null;
      let bestS = -Infinity;
      for (const u of pool) {
        if (usedIds.has(u.id)) continue;
        if (team.some(x=>x.id===u.id)) continue;
        const t = [...team, u];
        const s = scoreTeam(t).final;
        if (s > bestS) { bestS = s; best = u; }
      }
      if (!best) break;
      team.push(best);
      usedIds.add(best.id);
    }
    platoons.push(team.map(u=>u.id).concat(Array(PLATOON_SIZE).fill("")).slice(0, PLATOON_SIZE));
  }

  return platoons;
}

/* ---------------- Rendering ---------------- */

function el(id) { return document.getElementById(id); }

function optionList(units) {
  const opts = [`<option value="">(empty)</option>`];
  for (const u of units) {
    opts.push(`<option value="${u.id}">${u.name} (${u.element} ${u.rarity})</option>`);
  }
  return opts.join("");
}

function renderSlotCard(slotId, idx, currentId, units, onChange) {
  const u = units.find(x=>x.id===currentId);
  const img = u?.image ? `<img src="${u.image}" alt="">` : `<div class="ph">?</div>`;
  const title = u ? `${u.name}` : `Empty`;
  const sub = u ? `${u.title || ""}` : `Select a unit`;
  const chips = u ? `
    <div class="slotMetaRow">
      <span class="slotChip">${u.rarity || ""}</span>
      <span class="slotChip">${u.element || ""}</span>
    </div>
  ` : "";

  const select = `
    <select class="slotSelect" data-slot="${slotId}" data-idx="${idx}">
      ${optionList(units)}
    </select>
  `;

  return `
    <div class="slotCard ${u ? "" : "empty"}">
      <div class="slotTop">
        <div class="slotImg">${img}</div>
        <div>
          <div class="slotName">${title}</div>
          <div class="slotSub">${sub}</div>
        </div>
      </div>
      ${chips}
      ${select}
    </div>
  `;
}

function wireSelects(units) {
  document.querySelectorAll("select.slotSelect").forEach(sel => {
    const slot = sel.getAttribute("data-slot");
    const idx = parseInt(sel.getAttribute("data-idx"), 10);

    // set current
    let current = "";
    if (slot === "storyMain") current = state.layout.storyMain[idx] || "";
    else if (slot === "storyBack") current = state.layout.storyBack[idx] || "";
    else if (slot.startsWith("platoon_")) {
      const p = parseInt(slot.split("_")[1], 10);
      current = state.layout.platoons[p][idx] || "";
    }
    sel.value = current;

    sel.addEventListener("change", () => {
      const v = sel.value || "";
      if (slot === "storyMain") state.layout.storyMain[idx] = v;
      else if (slot === "storyBack") state.layout.storyBack[idx] = v;
      else if (slot.startsWith("platoon_")) {
        const p = parseInt(slot.split("_")[1], 10);
        state.layout.platoons[p][idx] = v;
      }
      saveLayout();
      renderAll(); // keep storage in sync
    });
  });
}

function renderStory(units) {
  const storyMain = el("storyMain");
  const storyBack = el("storyBack");
  if (!storyMain || !storyBack) return;

  storyMain.innerHTML = state.layout.storyMain.map((id, i) => renderSlotCard("storyMain", i, id, units)).join("");
  storyBack.innerHTML = state.layout.storyBack.map((id, i) => renderSlotCard("storyBack", i, id, units)).join("");
}

function renderPlatoons(units) {
  const grid = el("platoonsGrid");
  if (!grid) return;

  grid.innerHTML = state.layout.platoons.map((row, p) => {
    const slots = row.map((id, i) => renderSlotCard(`platoon_${p}`, i, id, units)).join("");
    return `
      <div class="panel platoonPanel">
        <div class="panelTitle">Platoon ${p + 1}</div>
        <div class="slotGrid platoonSlots">${slots}</div>
      </div>
    `;
  }).join("");
}

function renderStorage(units) {
  const grid = el("storageGrid");
  if (!grid) return;

  const used = new Set([
    ...state.layout.storyMain.filter(Boolean),
    ...state.layout.storyBack.filter(Boolean),
    ...state.layout.platoons.flat().filter(Boolean),
  ]);

  const remaining = units.filter(u => !used.has(u.id));

  grid.innerHTML = remaining.map(u => {
    const img = u.image ? `<img src="${u.image}" alt="">` : `<div class="ph">?</div>`;
    return `
      <div class="slotCard">
        <div class="slotTop">
          <div class="slotImg">${img}</div>
          <div>
            <div class="slotName">${u.name}</div>
            <div class="slotSub">${u.title || ""}</div>
          </div>
        </div>
        <div class="slotMetaRow">
          <span class="slotChip">${u.rarity || ""}</span>
          <span class="slotChip">${u.element || ""}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderAll() {
  // owned count
  const ownedCountEl = el("ownedCount");
  if (ownedCountEl) ownedCountEl.textContent = `${state.ownedUnits.length} selected`;

  // mode sections
  const modeSel = el("modeSelect");
  if (modeSel) state.mode = modeSel.value;

  const storySection = el("storySection");
  const platoonsSection = el("platoonsSection");
  if (storySection && platoonsSection) {
    if (state.mode === "story") {
      storySection.classList.remove("hidden");
      platoonsSection.classList.add("hidden");
    } else {
      storySection.classList.add("hidden");
      platoonsSection.classList.remove("hidden");
    }
  }

  renderStory(state.ownedUnits);
  renderPlatoons(state.ownedUnits);
  renderStorage(state.ownedUnits);
  wireSelects(state.ownedUnits);
}

function clearTeams() {
  state.layout = {
    storyMain: Array(STORY_MAIN).fill(""),
    storyBack: Array(STORY_BACK).fill(""),
    platoons: Array.from({ length: PLATOON_COUNT }, () => Array(PLATOON_SIZE).fill("")),
  };
  saveLayout();
  renderAll();
}

function buildBestTeams() {
  // locked = whatever user already selected in story slots
  const lockedStory = [...state.layout.storyMain, ...state.layout.storyBack].filter(Boolean);

  const story = buildBestStoryTeam(state.ownedUnits, lockedStory);

  // write story
  state.layout.storyMain = story.main;
  state.layout.storyBack = story.back;

  // build platoons from remaining, avoiding story duplicates
  const used = new Set([...story.main, ...story.back].filter(Boolean));
  state.layout.platoons = buildBestPlatoons(state.ownedUnits, used);

  saveLayout();
  renderAll();
}

async function init() {
  state.all = await loadCharacters();
  // attach optimizer tags + base
  for (const u of state.all) {
    u.__opt = tagUnit(u);
    u.__opt.base = unitBaseScore(u);
  }

  state.ownedIds = getOwnedIds();
  state.ownedUnits = state.all.filter(u => state.ownedIds.has(u.id));

  state.layout = loadLayout();

  // UI events
  el("modeSelect")?.addEventListener("change", () => renderAll());
  el("clearTeams")?.addEventListener("click", clearTeams);
  el("buildBest")?.addEventListener("click", buildBestTeams);

  renderAll();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error(err);
    const ownedCountEl = el("ownedCount");
    if (ownedCountEl) ownedCountEl.textContent = `Error: ${String(err.message || err)}`;
  });
});