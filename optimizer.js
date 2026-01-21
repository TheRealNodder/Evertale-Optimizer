/* optimizer.js — layouts + simple heuristics (locked layout generation) */
const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v1";
const LS_TEAM_KEY = "evertale_team_layout_v1"; // stores ids

const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

const $ = (s) => document.querySelector(s);

function safeText(v, f="") { return v == null ? f : String(v); }

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.characters)) return json.characters;
  throw new Error("characters.json must be an array");
}

function loadOwned() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]")); }
  catch { return new Set(); }
}

function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_TEAM_KEY) || "{}");
    return {
      storyMain: Array.isArray(raw.storyMain) ? raw.storyMain : Array(STORY_MAIN).fill(""),
      storyBack: Array.isArray(raw.storyBack) ? raw.storyBack : Array(STORY_BACK).fill(""),
      platoons: Array.isArray(raw.platoons) ? raw.platoons : Array.from({length:PLATOON_COUNT}, () => Array(PLATOON_SIZE).fill("")),
      mode: raw.mode === "platoons" ? "platoons" : "story",
    };
  } catch {
    return {
      storyMain: Array(STORY_MAIN).fill(""),
      storyBack: Array(STORY_BACK).fill(""),
      platoons: Array.from({length:PLATOON_COUNT}, () => Array(PLATOON_SIZE).fill("")),
      mode: "story",
    };
  }
}
function saveLayout(layout) {
  localStorage.setItem(LS_TEAM_KEY, JSON.stringify(layout));
}

function leaderFrom(unit) {
  const ls = unit.leaderSkill;
  if (!ls) return null;
  if (typeof ls === "string") return ls.trim() || null;
  const name = safeText(ls.name).trim();
  const desc = safeText(ls.description).trim();
  const bad = (s) => !s || s.toLowerCase() === "none" || s.toLowerCase() === "null";
  return (!bad(name) || !bad(desc)) ? { name: bad(name) ? "Leader Skill" : name, description: bad(desc) ? "" : desc } : null;
}

function getImage(unit) {
  const img = unit.image || unit.icon || unit.portrait;
  return img ? String(img) : "";
}

function buildUnitOption(u) {
  const t = safeText(u.title);
  return `${safeText(u.name)}${t ? " — " + t : ""}`;
}

function slotCard(unit) {
  if (!unit) return `<div class="slotCard empty"><div class="muted">Empty</div></div>`;
  const img = getImage(unit);
  const t = safeText(unit.title);
  const ls = leaderFrom(unit);
  return `
    <div class="slotCard">
      <div class="slotThumb">${img ? `<img loading="lazy" src="${img}" alt="${safeText(unit.name)}">` : `<div class="ph">${safeText(unit.name,"?")[0]}</div>`}</div>
      <div class="slotMeta">
        <div class="slotName">${safeText(unit.name)}</div>
        <div class="slotTitle">${t}</div>
        <div class="slotTags">
          ${unit.rarity ? `<span class="tag rarity">${unit.rarity}</span>` : ""}
          ${unit.element ? `<span class="tag element">${unit.element}</span>` : ""}
        </div>
        ${ls ? `<div class="slotLeader"><div class="leaderName">${safeText(ls.name)}</div><div class="leaderDesc">${safeText(ls.description)}</div></div>` : ""}
      </div>
    </div>`;
}

function renderSlots(container, count, labelPrefix, layoutArr, ownedUnits, onChange) {
  container.innerHTML = "";
  for (let i=0;i<count;i++) {
    const curId = safeText(layoutArr[i]);
    const wrap = document.createElement("div");
    wrap.className = "slot";
    wrap.innerHTML = `
      <div class="slotTitle">${labelPrefix} ${i+1}</div>
      <select class="slotPick">
        <option value="">(empty)</option>
        ${ownedUnits.map(u => `<option value="${safeText(u.id)}">${escapeHtml(buildUnitOption(u))}</option>`).join("")}
      </select>
      <div class="slotView"></div>
    `;
    const sel = wrap.querySelector(".slotPick");
    sel.value = curId || "";
    const view = wrap.querySelector(".slotView");
    view.innerHTML = slotCard(ownedUnitsById.get(curId));

    sel.addEventListener("change", () => {
      layoutArr[i] = sel.value || "";
      view.innerHTML = slotCard(ownedUnitsById.get(layoutArr[i]));
      onChange();
    });

    container.appendChild(wrap);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

let allUnits = [];
let ownedUnits = [];
let ownedUnitsById = new Map();
let layout = null;

function setMode(mode) {
  layout.mode = mode === "platoons" ? "platoons" : "story";
  $("#modeSelect").value = layout.mode;
  $("#storySection").classList.toggle("hidden", layout.mode !== "story");
  $("#platoonsSection").classList.toggle("hidden", layout.mode !== "platoons");
  saveLayout(layout);
  renderAll();
}

function computeStorageIds() {
  const used = new Set();
  layout.storyMain.forEach(id => id && used.add(id));
  layout.storyBack.forEach(id => id && used.add(id));
  layout.platoons.forEach(team => team.forEach(id => id && used.add(id)));
  return ownedUnits.filter(u => !used.has(String(u.id))).map(u => String(u.id));
}

function renderStorage() {
  const grid = $("#storageGrid");
  const ids = computeStorageIds();
  const frag = document.createDocumentFragment();
  grid.innerHTML = "";
  for (const id of ids) {
    const u = ownedUnitsById.get(id);
    const card = document.createElement("div");
    card.innerHTML = `
      <div class="miniCard">
        <div class="miniThumb">${getImage(u) ? `<img loading="lazy" src="${getImage(u)}" alt="${safeText(u.name)}">` : `<div class="ph">${safeText(u.name,"?")[0]}</div>`}</div>
        <div class="miniText">
          <div class="unitName">${safeText(u.name)}</div>
          <div class="unitTitle">${safeText(u.title)}</div>
        </div>
      </div>`;
    frag.appendChild(card.firstElementChild);
  }
  grid.appendChild(frag);
}

function renderPlatoons() {
  const root = $("#platoonsGrid");
  root.innerHTML = "";
  for (let p=0;p<PLATOON_COUNT;p++) {
    const block = document.createElement("section");
    block.className = "platoonBlock";
    block.innerHTML = `<div class="teamSubTitle">Platoon ${p+1}</div><div class="slotGrid platoonSlots"></div>`;
    const grid = block.querySelector(".platoonSlots");
    renderSlots(grid, PLATOON_SIZE, "Slot", layout.platoons[p], ownedUnits, () => { saveLayout(layout); renderStorage(); });
    root.appendChild(block);
  }
}

function renderStory() {
  renderSlots($("#storyMain"), STORY_MAIN, "Main", layout.storyMain, ownedUnits, () => { saveLayout(layout); renderStorage(); });
  renderSlots($("#storyBack"), STORY_BACK, "Back", layout.storyBack, ownedUnits, () => { saveLayout(layout); renderStorage(); });
}

function renderAll() {
  renderStory();
  renderPlatoons();
  renderStorage();
}


// -------------------------
// Optimizer Engine (v1 final)
// -------------------------
// Goals (per project memory):
// - characters.json is canonical (read-only)
// - leader skills + skill text drive scoring
// - accuracy > speed (but must run in-browser)
// - supports Story (5+3) and Platoons (20×5)
// - avoids duplicate usage across Story/Platoons
//
// Implementation notes:
// - We build "profiles" for owned units (derived tags/roles/normalized stats)
// - We score TEAMS (not just units) with leader/element/synergy/coverage
// - We construct teams via a small candidate pool + beam search

const OPT_CFG = {
  // Candidate + search
  candidateOverall: 70,
  candidatePerElement: 14,
  candidatePerRole: 14,
  beamWidthStory: 140,
  beamWidthPlatoon: 90,
  expandPerState: 18, // consider top N additions per beam state

  // Strategy preference: "auto" | "mono" | "rainbow"
  elementPreference: "auto",

  // Team composition soft targets (Story team)
  storyTargets: { dps: 2, sustain: 1, control: 1 },

  // Core weights (sum ≈ 1.0 before leader multiplier)
  w: {
    power: 0.62,
    coverage: 0.18,
    synergy: 0.12,
    element: 0.08,
  },

  // Stat weights inside "power"
  stat: {
    atk: 0.62,
    spd: 0.20,
    hp: 0.12,
    eff: 0.06, // atk/cost
  },

  // Status/keyword importance (from project memory doc)
  tagWeight: {
    poison: 5,
    burn: 5,
    turn: 5,
    sleep: 4,
    stun: 4,
    heal: 4,
    atkBuff: 3,
    hpBuff: 3,
    cleanse: 3,
    shield: 2,
    revive: 4,
    debuff: 2,
  },

  // Small constants
  eps: 1e-9,
};

function norm01(x, min, max) {
  const a = Number(min), b = Number(max);
  const v = Number(x);
  if (!Number.isFinite(v) || !Number.isFinite(a) || !Number.isFinite(b)) return 0;
  if (Math.abs(b - a) < OPT_CFG.eps) return 0;
  return (v - a) / (b - a);
}

function joinUnitText(u) {
  // NOTE: read-only access; do not mutate.
  const parts = [];
  const ls = u.leaderSkill || {};
  parts.push(ls.name || "", ls.description || "");
  const act = u.activeSkillDetails || u.activeSkills || [];
  const pas = u.passiveSkillDetails || u.passiveSkills || [];
  try { parts.push(JSON.stringify(act)); } catch (_) {}
  try { parts.push(JSON.stringify(pas)); } catch (_) {}
  return parts.join(" ").toLowerCase();
}

const TAG_DEFS = [
  { tag: "poison",  re: [/\bpoison\b/i, /\btoxic\b/i, /\bvenom\b/i, /\bmega poison\b/i] },
  { tag: "burn",    re: [/\bburn\b/i, /\bignite\b/i, /\bflame\b/i, /\binferno\b/i] },
  { tag: "sleep",   re: [/\bsleep\b/i, /\bdream\b/i, /\bslumber\b/i] },
  { tag: "stun",    re: [/\bstun\b/i, /\bshock\b/i, /\bparalyz/i, /\bfreeze\b/i, /\bsilence\b/i] },
  { tag: "heal",    re: [/\bheal\b/i, /\brestore\b/i, /\bregen/i, /\brecover\b/i, /\blife\b/i] },
  { tag: "revive",  re: [/\brevive\b/i, /\bresurrect\b/i, /\brevive\b/i] },
  { tag: "shield",  re: [/\bshield\b/i, /\bbarrier\b/i, /\bward\b/i] },
  { tag: "cleanse", re: [/\bcleanse\b/i, /\bpurify\b/i, /\bcure\b/i, /\bremove (?:all )?status\b/i, /\bimmunity\b/i] },
  { tag: "atkBuff", re: [/\batk\b.*\bincrease\b/i, /\battack\b.*\bincrease\b/i, /\battack up\b/i, /\bdamage up\b/i, /\bcrit\b.*\bincrease\b/i] },
  { tag: "hpBuff",  re: [/\bhp\b.*\bincrease\b/i, /\bmax hp\b.*\bincrease\b/i, /\bmax hp up\b/i] },
  { tag: "debuff",  re: [/\battack down\b/i, /\bdef(?:ense)? down\b/i, /\bweaken\b/i, /\bslow\b/i, /\btaunt\b/i, /\bcurse\b/i] },
  { tag: "turn",    re: [/\btu\b/i, /\bturn\b.*\bmanip/i, /\bextra turn\b/i, /\bpush back\b/i, /\btime\b.*\bstrike\b/i, /\baccelerat/i] },
];

function extractTags(u) {
  const text = joinUnitText(u);
  const tags = new Set();
  const counts = {};
  for (const def of TAG_DEFS) {
    let hit = false;
    for (const r of def.re) {
      const m = text.match(r);
      if (m) {
        hit = true;
        counts[def.tag] = (counts[def.tag] || 0) + 1;
      }
    }
    if (hit) tags.add(def.tag);
  }
  return { tags, counts, text };
}

function deriveRoles(profile) {
  const t = profile.tags;
  const roles = new Set();

  // Role signals (simple, stable heuristics)
  if (t.has("heal") || t.has("revive")) roles.add("sustain");
  if (t.has("sleep") || t.has("stun")) roles.add("control");
  if (t.has("cleanse")) roles.add("cleanse");
  if (t.has("atkBuff") || t.has("hpBuff")) roles.add("buffer");
  if (t.has("debuff")) roles.add("debuffer");
  if (t.has("shield") || t.has("hpBuff")) roles.add("tank");
  if (t.has("poison") || t.has("burn")) roles.add("dot");

  // DPS is partly stats-driven; mark later after stats normalization.
  return roles;
}

function parseLeaderEffect(u) {
  const ls = u.leaderSkill || {};
  const txt = (safeText(ls.name) + " " + safeText(ls.description)).toLowerCase();

  let scope = { type: "all", element: null, tag: null };
  const elMatch = txt.match(/\b(fire|water|earth|light|dark|storm)\b/);
  if (elMatch && /\b(allies|units|friends|team)\b/.test(txt)) {
    scope = { type: "element", element: elMatch[1][0].toUpperCase() + elMatch[1].slice(1), tag: null };
  } else if (/\b(all allies|all units|all friends|all teammates)\b/.test(txt)) {
    scope = { type: "all", element: null, tag: null };
  }

  const pct = (re) => {
    const m = txt.match(re);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };

  // Best-effort parsing (percentages are optional)
  const atkPct = pct(/(\d{1,3})\s*%\s*(?:to\s*)?(?:atk|attack)/);
  const hpPct  = pct(/(\d{1,3})\s*%\s*(?:to\s*)?(?:hp|max hp)/);
  const spdPct = pct(/(\d{1,3})\s*%\s*(?:to\s*)?(?:spd|speed)/);

  return { scope, atkPct, hpPct, spdPct, rawText: txt };
}

function buildProfiles(units) {
  // Compute min/max across owned units
  const nums = (k) => units.map(u => Number(u.stats?.[k] ?? u[k] ?? 0) || 0);
  const atkArr = nums("atk"), hpArr = nums("hp"), spdArr = nums("spd");
  const costArr = nums("cost");
  const minmax = (arr) => ({ min: Math.min(...arr), max: Math.max(...arr) });

  const mmAtk = minmax(atkArr);
  const mmHp = minmax(hpArr);
  const mmSpd = minmax(spdArr);

  const effArr = units.map(u => {
    const atk = Number(u.stats?.atk ?? u.atk ?? 0) || 0;
    const cost = Number(u.stats?.cost ?? u.cost ?? 0) || 0;
    return cost > 0 ? atk / cost : atk;
  });
  const mmEff = minmax(effArr);

  const out = [];
  for (const u of units) {
    const id = String(u.id);
    const element = safeText(u.element, "Unknown");
    const atk = Number(u.stats?.atk ?? u.atk ?? 0) || 0;
    const hp = Number(u.stats?.hp ?? u.hp ?? 0) || 0;
    const spd = Number(u.stats?.spd ?? u.spd ?? 0) || 0;
    const cost = Number(u.stats?.cost ?? u.cost ?? 0) || 0;
    const eff = (cost > 0) ? (atk / cost) : atk;

    const tagInfo = extractTags(u);
    const roles = deriveRoles(tagInfo);

    const atkN = norm01(atk, mmAtk.min, mmAtk.max);
    const hpN = norm01(hp, mmHp.min, mmHp.max);
    const spdN = norm01(spd, mmSpd.min, mmSpd.max);
    const effN = norm01(eff, mmEff.min, mmEff.max);

    // Stats-driven DPS hint
    if (atkN >= 0.55) roles.add("dps");
    if (atkN >= 0.78) roles.add("carry");

    const leader = parseLeaderEffect(u);

    // Base (individual) score for candidate pool ranking
    let tagScore = 0;
    for (const t of tagInfo.tags) {
      tagScore += (OPT_CFG.tagWeight[t] || 0);
    }
    // Normalize tagScore to a small range
    const tagScoreN = Math.min(tagScore / 18, 1.0);

    const baseScore =
      OPT_CFG.stat.atk * atkN +
      OPT_CFG.stat.spd * spdN +
      OPT_CFG.stat.hp * hpN +
      OPT_CFG.stat.eff * effN +
      0.18 * tagScoreN +
      (leader.scope.type !== "all" ? 0.02 : 0.00);

    out.push({
      id,
      unit: u,
      element,
      atk, hp, spd, cost, eff,
      atkN, hpN, spdN, effN,
      tags: tagInfo.tags,
      tagCounts: tagInfo.counts,
      roles,
      leader,
      baseScore,
    });
  }
  return out;
}

function leaderScore(leaderProfile, teamProfiles) {
  if (!leaderProfile) return 0;
  const ef = leaderProfile.leader;
  const n = teamProfiles.length || 1;

  const match = (p) => {
    if (ef.scope.type === "all") return true;
    if (ef.scope.type === "element") return p.element === ef.scope.element;
    return false;
  };

  const matching = teamProfiles.filter(match);
  const ratio = matching.length / n;

  // Baseline: leader that matches more of the team matters more
  let s = 0.10 * ratio;

  // If we parsed percent values, incorporate them with diminishing impact
  const avg = (arr, key) => arr.length ? (arr.reduce((a,b)=>a+(b[key]||0),0) / arr.length) : 0;

  if (ef.atkPct != null) s += (ef.atkPct / 100) * avg(matching, "atkN") * 0.65;
  if (ef.hpPct  != null) s += (ef.hpPct  / 100) * avg(matching, "hpN")  * 0.25;
  if (ef.spdPct != null) s += (ef.spdPct / 100) * avg(matching, "spdN") * 0.35;

  // Clamp; we use as multiplier component later
  return Math.max(0, Math.min(s, 0.55));
}

function scoreCoverage(teamProfiles, isStory) {
  const roles = { dps: 0, sustain: 0, control: 0, cleanse: 0, tank: 0, buffer: 0, debuffer: 0, dot: 0 };
  for (const p of teamProfiles) {
    for (const r of p.roles) {
      if (roles[r] != null) roles[r] += 1;
    }
  }

  if (!isStory) {
    // Platoon (5): soft constraints
    const dpsOk = Math.min(roles.dps / 1, 1);
    const utilOk = Math.min((roles.sustain + roles.control + roles.cleanse) / 1, 1);
    const variety = Math.min((new Set(teamProfiles.flatMap(p => [...p.roles])).size) / 4, 1);
    return 0.55*dpsOk + 0.30*utilOk + 0.15*variety;
  }

  const tgt = OPT_CFG.storyTargets;
  const dps = Math.min(roles.dps / tgt.dps, 1);
  const sustain = Math.min(roles.sustain / tgt.sustain, 1);
  const control = Math.min(roles.control / tgt.control, 1);

  // Bonus for extra safety tools
  const safety = Math.min((roles.cleanse + roles.tank) / 2, 1);

  return 0.45*dps + 0.30*sustain + 0.20*control + 0.05*safety;
}

function scoreSynergy(teamProfiles) {
  const tags = new Set();
  for (const p of teamProfiles) for (const t of p.tags) tags.add(t);

  const has = (t) => tags.has(t);

  let s = 0;

  // Status core presence rewards (diminishing)
  const core = ["poison","burn","sleep","stun","heal","turn","atkBuff","hpBuff","cleanse","revive"];
  let coreCount = 0;
  for (const t of core) if (has(t)) coreCount += 1;
  s += Math.min(coreCount / 6, 1) * 0.28;

  // Pair/strategy synergy
  if (has("poison") && has("turn")) s += 0.10;
  if (has("burn") && has("heal")) s += 0.10; // memory: burn can enable healing via passives
  if (has("sleep") && has("turn")) s += 0.08;
  if (has("atkBuff")) {
    const avgAtkN = teamProfiles.reduce((a,p)=>a+p.atkN,0)/(teamProfiles.length||1);
    s += 0.06 * Math.min(avgAtkN / 0.75, 1);
  }
  if (has("cleanse") && has("heal")) s += 0.06;
  if (has("stun") && has("sleep")) s += 0.04;

  // Control density (helps story consistency)
  const ctrlCount = teamProfiles.filter(p => p.roles.has("control")).length;
  s += Math.min(ctrlCount / 2, 1) * 0.06;

  return Math.max(0, Math.min(s, 0.55));
}

function scoreElementStrategy(teamProfiles, bestLeaderProfile, preference) {
  const n = teamProfiles.length || 1;
  const counts = {};
  for (const p of teamProfiles) counts[p.element] = (counts[p.element] || 0) + 1;

  const elems = Object.keys(counts);
  const distinct = elems.length;
  const top = Math.max(...Object.values(counts));
  const topRatio = top / n;

  // Mono and rainbow candidates
  const mono = Math.max(0, (topRatio - 0.55) / 0.45);      // 0..1
  const rainbow = Math.max(0, (distinct / n - 0.40) / 0.60); // 0..1

  // Leader pushes mono if element-scoped and matches the dominant element
  let leaderPush = 0;
  if (bestLeaderProfile && bestLeaderProfile.leader.scope.type === "element") {
    const el = bestLeaderProfile.leader.scope.element;
    const ratio = (counts[el] || 0) / n;
    leaderPush = Math.max(0, (ratio - 0.45) / 0.55); // 0..1
  }

  const pref = preference || OPT_CFG.elementPreference;
  if (pref === "mono") return Math.min(1, mono + 0.30*leaderPush);
  if (pref === "rainbow") return Math.min(1, rainbow);
  // auto
  return Math.min(1, Math.max(mono + 0.30*leaderPush, rainbow));
}

function scoreTeam(teamProfiles, isStory, preference) {
  if (!teamProfiles.length) return { total: 0, breakdown: null, leaderId: "" };

  // Power core
  const n = teamProfiles.length;
  const avgAtk = teamProfiles.reduce((a,p)=>a+p.atkN,0)/n;
  const avgSpd = teamProfiles.reduce((a,p)=>a+p.spdN,0)/n;
  const avgHp  = teamProfiles.reduce((a,p)=>a+p.hpN,0)/n;
  const avgEff = teamProfiles.reduce((a,p)=>a+p.effN,0)/n;

  const power =
    OPT_CFG.stat.atk*avgAtk +
    OPT_CFG.stat.spd*avgSpd +
    OPT_CFG.stat.hp*avgHp +
    OPT_CFG.stat.eff*avgEff;

  const coverage = scoreCoverage(teamProfiles, isStory);
  const synergy = scoreSynergy(teamProfiles);

  // Best leader among team
  let bestLeader = null;
  let bestLeaderS = 0;
  for (const p of teamProfiles) {
    const ls = leaderScore(p, teamProfiles);
    if (ls > bestLeaderS) { bestLeaderS = ls; bestLeader = p; }
  }

  const element = scoreElementStrategy(teamProfiles, bestLeader, preference);

  // Penalties (soft)
  let pen = 0;
  if (isStory) {
    const roleCounts = { sustain:0, dps:0, control:0 };
    for (const p of teamProfiles) {
      if (p.roles.has("sustain")) roleCounts.sustain += 1;
      if (p.roles.has("dps")) roleCounts.dps += 1;
      if (p.roles.has("control")) roleCounts.control += 1;
    }
    if (roleCounts.sustain === 0) pen += 0.10;
    if (roleCounts.dps === 0) pen += 0.12;
    if (roleCounts.control === 0) pen += 0.06;
  }

  const core =
    OPT_CFG.w.power*power +
    OPT_CFG.w.coverage*coverage +
    OPT_CFG.w.synergy*synergy +
    OPT_CFG.w.element*element;

  const total = Math.max(0, core * (1 + bestLeaderS) - pen);

  return {
    total,
    leaderId: bestLeader ? bestLeader.id : "",
    breakdown: { power, coverage, synergy, element, leader: bestLeaderS, penalty: pen },
  };
}

function buildCandidatePool(profiles) {
  const byId = new Map(profiles.map(p => [p.id, p]));
  const pool = new Map();

  const takeTop = (arr, n) => arr.slice().sort((a,b)=>b.baseScore-a.baseScore).slice(0,n);

  // Overall
  for (const p of takeTop(profiles, OPT_CFG.candidateOverall)) pool.set(p.id, p);

  // Per element
  const elements = ["Fire","Water","Earth","Light","Dark","Storm"];
  for (const el of elements) {
    const list = profiles.filter(p => p.element === el);
    for (const p of takeTop(list, OPT_CFG.candidatePerElement)) pool.set(p.id, p);
  }

  // Per role
  const roles = ["dps","sustain","control","cleanse","tank","buffer","dot"];
  for (const r of roles) {
    const list = profiles.filter(p => p.roles.has(r));
    for (const p of takeTop(list, OPT_CFG.candidatePerRole)) pool.set(p.id, p);
  }

  return Array.from(pool.values());
}

function beamSearchTeam({ size, pool, lockedIds, excludeSet, isStory, preference, beamWidth }) {
  const byId = new Map(pool.map(p => [p.id, p]));
  const locked = (lockedIds || []).map(String).filter(Boolean).filter(id => byId.has(id));

  // De-dup locked in order
  const lockedUniq = [];
  const seen = new Set();
  for (const id of locked) {
    if (seen.has(id)) continue;
    if (excludeSet && excludeSet.has(id)) continue;
    seen.add(id);
    lockedUniq.push(id);
  }

  const start = { ids: lockedUniq, score: 0 };
  const startProfiles = start.ids.map(id => byId.get(id)).filter(Boolean);
  start.score = scoreTeam(startProfiles, isStory, preference).total;

  let beam = [start];

  const remainingSteps = Math.max(0, size - start.ids.length);
  if (remainingSteps === 0) return start.ids.slice(0, size);

  // Pre-sort candidates by baseScore (so expansion considers strong units first)
  const sortedPool = pool.slice().sort((a,b)=>b.baseScore-a.baseScore);

  for (let step = 0; step < remainingSteps; step++) {
    const next = [];
    for (const state of beam) {
      const used = new Set(state.ids);
      const candidates = [];
      for (const p of sortedPool) {
        if (excludeSet && excludeSet.has(p.id)) continue;
        if (used.has(p.id)) continue;
        candidates.push(p);
        if (candidates.length >= OPT_CFG.expandPerState) break;
      }

      for (const cand of candidates) {
        const ids2 = state.ids.concat([cand.id]);
        const prof2 = ids2.map(id => byId.get(id)).filter(Boolean);
        const sc = scoreTeam(prof2, isStory, preference).total;
        next.push({ ids: ids2, score: sc });
      }
    }

    // Keep top beam
    next.sort((a,b)=>b.score-a.score);
    beam = next.slice(0, Math.max(10, beamWidth || 80));
    if (!beam.length) break;
  }

  // Best full state
  beam.sort((a,b)=>b.score-a.score);
  return (beam[0]?.ids || lockedUniq).slice(0, size);
}

function assignStoryMainBack(storyIds, profilesById) {
  // Keep story size at 8; then assign 5 main + 3 backline via simple preferences.
  const ids = storyIds.filter(Boolean);
  const ps = ids.map(id => profilesById.get(id)).filter(Boolean);

  // Front prefers speed/control/tank; back prefers atk/sustain/revive.
  const frontScore = (p) =>
    0.55*p.spdN + 0.25*(p.roles.has("control") ? 1 : 0) + 0.20*(p.roles.has("tank") ? 1 : 0);

  const backScore = (p) =>
    0.55*p.atkN + 0.25*(p.roles.has("sustain") ? 1 : 0) + 0.20*(p.tags.has("revive") ? 1 : 0);

  // Greedy assign: pick top 5 front, remaining to back.
  const sorted = ps.slice().sort((a,b)=>frontScore(b)-frontScore(a));
  const main = sorted.slice(0, STORY_MAIN).map(p => p.id);
  const back = sorted.slice(STORY_MAIN).sort((a,b)=>backScore(b)-backScore(a)).slice(0, STORY_BACK).map(p => p.id);

  // Preserve any missing with blanks
  while (main.length < STORY_MAIN) main.push("");
  while (back.length < STORY_BACK) back.push("");

  return { main, back };
}

function buildBestTeams() {
  // Build Story + Platoons using team scoring + leader/element/synergy.
  // Respects any already-selected units in current layout as "locked" picks.

  if (!ownedUnits || ownedUnits.length === 0) {
    alert("No owned units found. Go back to Roster and mark units as owned.");
    return;
  }

  const profiles = buildProfiles(ownedUnits);
  const byId = new Map(profiles.map(p => [p.id, p]));

  const pool = buildCandidatePool(profiles);
  const poolById = new Map(pool.map(p => [p.id, p]));

  const used = new Set();

  // Locked story picks (preserve user's manual selections)
  const lockedStory = []
    .concat(layout.storyMain || [])
    .concat(layout.storyBack || [])
    .map(String)
    .filter(Boolean);

  // Story team (8)
  const storyIds = beamSearchTeam({
    size: STORY_MAIN + STORY_BACK,
    pool,
    lockedIds: lockedStory,
    excludeSet: used,
    isStory: true,
    preference: OPT_CFG.elementPreference,
    beamWidth: OPT_CFG.beamWidthStory,
  });

  for (const id of storyIds) if (id) used.add(id);

  const assigned = assignStoryMainBack(storyIds, poolById);
  layout.storyMain = assigned.main;
  layout.storyBack = assigned.back;

  // Platoons (20 × 5), preserving any locked picks per platoon, and avoiding duplicates globally
  layout.platoons = layout.platoons && Array.isArray(layout.platoons) ? layout.platoons : [];
  const nextPlatoons = [];

  for (let i = 0; i < PLATOON_COUNT; i++) {
    const cur = Array.isArray(layout.platoons[i]) ? layout.platoons[i] : [];
    const locked = cur.map(String).filter(Boolean).filter(id => poolById.has(id) && !used.has(id));

    const platoonIds = beamSearchTeam({
      size: PLATOON_SIZE,
      pool,
      lockedIds: locked,
      excludeSet: used,
      isStory: false,
      preference: OPT_CFG.elementPreference,
      beamWidth: OPT_CFG.beamWidthPlatoon,
    });

    // Fill blanks if not enough
    const out = platoonIds.slice(0, PLATOON_SIZE);
    while (out.length < PLATOON_SIZE) out.push("");

    for (const id of out) if (id) used.add(id);
    nextPlatoons.push(out);
  }

  layout.platoons = nextPlatoons;

  saveLayout(layout);
  renderAll();
}


function clearAll() {
  layout.storyMain = Array(STORY_MAIN).fill("");
  layout.storyBack = Array(STORY_BACK).fill("");
  layout.platoons = Array.from({length:PLATOON_COUNT}, () => Array(PLATOON_SIZE).fill(""));
  saveLayout(layout);
  renderAll();
}

async function init() {
  allUnits = await loadCharacters();
  const ownedSet = loadOwned();
  ownedUnits = allUnits.filter(u => ownedSet.has(String(u.id)));
  ownedUnitsById = new Map(ownedUnits.map(u => [String(u.id), u]));

  layout = loadLayout();

  $("#ownedCount").textContent = `${ownedUnits.length} owned units loaded from roster`;

  $("#modeSelect").addEventListener("change", (e) => setMode(e.target.value));
  $("#buildBest").addEventListener("click", buildBestTeams);
  $("#clearTeams").addEventListener("click", clearAll);

  setMode(layout.mode); // also renders
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((e) => {
    console.error(e);
    document.body.innerHTML = `<div class="page"><div class="panel"><div class="panelTitle">Optimizer failed to load</div><div class="muted">${escapeHtml(e?.message || String(e))}</div></div></div>`;
  });
});
