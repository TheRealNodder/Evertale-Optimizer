/* optimizer.js — FULL (Story=8, Platoons=20x5), Stats + Theme + LeaderSkills */

const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v2"; // MUST match roster app.js key

const $ = (s) => document.querySelector(s);
const safeStr = (v, fb = "") => (v == null ? fb : String(v));
const safeNum = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function rarityScore(r) {
  const x = safeStr(r, "").toUpperCase();
  if (x === "SSR") return 40;
  if (x === "SR") return 25;
  if (x === "R") return 10;
  if (x === "N") return 3;
  return 0;
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`characters.json HTTP ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : (Array.isArray(json.characters) ? json.characters : null);
  if (!Array.isArray(arr)) throw new Error("ERROR LOADING characters.json is not an array");
  return arr;
}

function loadOwnedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

/** Normalize unit shape (keeps original fields too) */
function normalizeUnit(raw, i) {
  const id = safeStr(raw.id, raw.unitId ?? raw.key ?? `unit_${i}`);
  const name = safeStr(raw.name, "");
  const secondaryName = safeStr(raw.secondaryName ?? raw.title ?? raw.handle ?? raw.subName ?? "", "");
  const element = safeStr(raw.element ?? raw.elem ?? "Unknown", "Unknown");
  const rarity = safeStr(raw.rarity ?? raw.rank ?? raw.tier ?? "SSR", "SSR");
  const image = safeStr(raw.image ?? raw.imageUrl ?? raw.img ?? raw.icon ?? "", "");

  // Stats (support many formats)
  const atk = safeNum(raw.atk ?? raw.stats?.atk ?? raw.ATK ?? raw.attack ?? 0);
  const hp = safeNum(raw.hp ?? raw.stats?.hp ?? raw.HP ?? 0);
  const spd = safeNum(raw.spd ?? raw.stats?.spd ?? raw.SPD ?? raw.speed ?? 0);
  const cost = safeNum(raw.cost ?? raw.stats?.cost ?? raw.COST ?? 0);

  return { ...raw, id, name, secondaryName, element, rarity, image, atk, hp, spd, cost };
}

/** Robust leader skill getter */
function getLeaderSkill(u) {
  const obj = u.leaderSkill ?? u.leader_skill ?? u.leader ?? u.leaderSkillRaw ?? null;
  if (obj && typeof obj === "object") {
    const name = safeStr(obj.name ?? obj.title ?? "", "").trim();
    const description = safeStr(obj.description ?? obj.desc ?? obj.text ?? "", "").trim();
    if (name || description) return { name: name || "None", description: description || "None" };
  }
  const nameFlat = safeStr(u.leaderSkillName ?? u.leader_name ?? u.leaderName ?? "", "").trim();
  const descFlat = safeStr(u.leaderSkillDescription ?? u.leader_desc ?? u.leaderDescription ?? "", "").trim();
  if (nameFlat || descFlat) return { name: nameFlat || "None", description: descFlat || "None" };
  return { name: "None", description: "None" };
}

/**
 * Extract “skill text” for theme matching (sleep/burn/etc.)
 * This tries common structures:
 * - u.skills: [{name, description}, ...]
 * - u.attacks: [{name, description}, ...]
 * - u.moves / u.abilities / u.passives
 * - u.rawText / u.description
 */
function getAllSkillText(u) {
  const parts = [];

  const pushObjList = (list) => {
    if (!Array.isArray(list)) return;
    for (const x of list) {
      if (!x || typeof x !== "object") continue;
      parts.push(safeStr(x.name, ""));
      parts.push(safeStr(x.title, ""));
      parts.push(safeStr(x.description, ""));
      parts.push(safeStr(x.desc, ""));
      parts.push(safeStr(x.text, ""));
    }
  };

  pushObjList(u.skills);
  pushObjList(u.attacks);
  pushObjList(u.moves);
  pushObjList(u.abilities);
  pushObjList(u.passives);

  // Sometimes the unit has a blob string
  parts.push(safeStr(u.description, ""));
  parts.push(safeStr(u.rawText, ""));

  // Always include leader skill too (so theme can come from LS)
  const ls = getLeaderSkill(u);
  parts.push(ls.name);
  parts.push(ls.description);

  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** Theme keyword map (expand later as needed) */
const THEME_KEYWORDS = {
  burn: ["burn", "ignite", "blaze", "scorch"],
  sleep: ["sleep", "slumber", "dream"],
  poison: ["poison", "toxin", "venom"],
  stun: ["stun", "paralyze", "paralysis"],
  freeze: ["freeze", "frozen", "icebound", "chill"],
  bleed: ["bleed", "bleeding"],
  blind: ["blind", "blinded"],
  rage: ["rage", "berserk"],
};

/** Return true if unit text matches a theme */
function unitHasTheme(u, theme) {
  if (!theme || theme === "none") return false;
  const t = getAllSkillText(u);
  const keys = THEME_KEYWORDS[theme] || [theme];
  return keys.some(k => t.includes(k));
}

/** Simple “leader boost” heuristic (you can tune weights later) */
function leaderBoostScore(u) {
  const t = `${getLeaderSkill(u).name} ${getLeaderSkill(u).description}`.toLowerCase();

  let s = 0;
  if (t.includes("attack increased")) s += 18;
  if (t.includes("max hp increased") || t.includes("maximum health")) s += 10;
  if (t.includes("speed increased")) s += 8;
  if (t.includes("by 10%")) s += 6;
  if (t.includes("by 15%")) s += 10;
  if (t.includes("by 20%")) s += 14;

  return s;
}

/**
 * Score unit:
 * - rarity baseline
 * - leader boost bonus
 * - theme match bonus (sleep/burn/etc.)
 * - mono element bonus + ATK priority
 * - stats
 */
function computeScore(u, cfg) {
  let score = 0;

  // Baseline
  score += rarityScore(u.rarity);

  // Stats (tune later; ATK matters more for mono build)
  const atk = safeNum(u.atk);
  const hp = safeNum(u.hp);
  const spd = safeNum(u.spd);
  const cost = safeNum(u.cost);

  const atkW = cfg.buildType === "mono" ? 0.020 : 0.012;
  const hpW = 0.004;
  const spdW = 0.020;
  const costW = 0.080; // penalty

  score += atk * atkW;
  score += hp * hpW;
  score += spd * spdW;
  score -= cost * costW;

  // Leader boost
  score += leaderBoostScore(u);

  // Theme synergy bonus (leader + attack descriptions)
  if (cfg.theme !== "none") {
    if (unitHasTheme(u, cfg.theme)) score += 60;
  }

  // Mono element synergy bonus
  if (cfg.buildType === "mono") {
    const el = safeStr(u.element, "").toLowerCase();
    const want = safeStr(cfg.monoElement, "").toLowerCase();
    if (want && want !== "all" && el === want) score += 35;

    // Bonus if leader skill/skills mention the element
    const text = getAllSkillText(u);
    if (want && want !== "all" && text.includes(want)) score += 12;
  }

  return score;
}

/** Build a single team (story=8, platoon=5) */
function buildTeam(pool, cfg) {
  const teamSize = cfg.teamMode === "platoon" ? 5 : 8;

  const ranked = pool
    .map(u => ({ ...u, _score: computeScore(u, cfg) }))
    .sort((a, b) => b._score - a._score);

  // Optional: if mono, prefer at least 4–6 matching element before fillers (simple heuristic)
  if (cfg.buildType === "mono" && cfg.monoElement && cfg.monoElement !== "all") {
    const want = cfg.monoElement.toLowerCase();
    const inEl = ranked.filter(u => safeStr(u.element, "").toLowerCase() === want);
    const outEl = ranked.filter(u => safeStr(u.element, "").toLowerCase() !== want);
    const merged = [...inEl, ...outEl];
    return merged.slice(0, teamSize);
  }

  return ranked.slice(0, teamSize);
}

/** Build 20 platoons (each size 5), no repeats unless you allow it */
function buildPlatoons(pool, cfg) {
  const PLATOONS = 20;
  const SIZE = 5;

  // Rank once
  const ranked = pool
    .map(u => ({ ...u, _score: computeScore(u, cfg) }))
    .sort((a, b) => b._score - a._score);

  const used = new Set();
  const platoons = [];

  for (let p = 0; p < PLATOONS; p++) {
    const team = [];
    for (const u of ranked) {
      if (team.length >= SIZE) break;
      if (used.has(u.id)) continue;
      team.push(u);
      used.add(u.id);
    }
    platoons.push(team);
  }

  return platoons;
}

/* ---------------- Rendering ---------------- */

function unitCardHtml(u, compact = false) {
  const img = u.image
    ? `<img src="${u.image}" alt="${u.name}" loading="lazy">`
    : `<div class="ph">${(u.name || "?").slice(0, 1).toUpperCase()}</div>`;

  const ls = getLeaderSkill(u);
  const hasLeader = ls.name && ls.name !== "None" && ls.name !== "No Leader Skill";
  const leaderName = hasLeader ? ls.name : "No Leader Skill";
  const leaderDesc = hasLeader
    ? (ls.description && ls.description !== "None" ? ls.description : "")
    : "This unit does not provide a leader skill.";

  if (compact) {
    // resource-saving: image + name only
    return `
      <div class="unitCompact">
        <div class="unitThumb">${img}</div>
        <div class="unitCompactName">${u.name}</div>
      </div>
    `;
  }

  return `
    <div class="unitCard">
      <div class="unitThumb">${img}</div>
      <div class="meta">
        <div class="unitName">${u.name}</div>
        <div class="unitTitle">${u.secondaryName || ""}</div>

        <div class="tags">
          <span class="tag rarity">${safeStr(u.rarity, "")}</span>
          <span class="tag element">${safeStr(u.element, "")}</span>
        </div>

        <div class="statLine">
          <div class="stat"><strong>ATK</strong> ${safeNum(u.atk)}</div>
          <div class="stat"><strong>HP</strong> ${safeNum(u.hp)}</div>
          <div class="stat"><strong>SPD</strong> ${safeNum(u.spd)}</div>
          <div class="stat"><strong>COST</strong> ${safeNum(u.cost)}</div>
        </div>

        <div class="leaderBlock">
          <div class="leaderName">${leaderName}</div>
          <div class="leaderDesc">${leaderDesc || "—"}</div>
        </div>
      </div>
    </div>
  `;
}

function renderOwned(gridEl, owned) {
  gridEl.innerHTML = owned.length
    ? owned.map(u => unitCardHtml(u, false)).join("")
    : `<div class="muted">No owned units found. Go to Roster and check “Owned”.</div>`;
}

function renderStoryTeam(gridEl, team) {
  gridEl.innerHTML = team.map(u => unitCardHtml(u, false)).join("");
}

function renderPlatoons(gridEl, platoons) {
  // Each platoon: compact row to save resources
  gridEl.innerHTML = platoons
    .map((team, idx) => `
      <div class="platoonBlock">
        <div class="platoonTitle">Platoon ${idx + 1}</div>
        <div class="platoonRow">
          ${team.map(u => unitCardHtml(u, true)).join("")}
        </div>
      </div>
    `)
    .join("");
}

/* ---------------- Main ---------------- */

async function main() {
  const raw = await loadCharacters();
  const all = raw.map(normalizeUnit);

  const ownedIds = loadOwnedIds();
  const owned = all.filter(u => ownedIds.has(u.id));

  $("#ownedCount") && ($("#ownedCount").textContent =
    `Owned IDs saved: ${ownedIds.size} • Owned matched: ${owned.length} • Total: ${all.length}`);

  const ownedGrid = $("#ownedGrid");
  ownedGrid && renderOwned(ownedGrid, owned);

  function run() {
    const cfg = {
      teamMode: $("#teamMode").value,      // "story" or "platoon"
      buildType: $("#buildType").value,    // "rainbow" or "mono"
      monoElement: $("#monoElement").value,// element string
      theme: $("#theme").value,            // "none" / "sleep" / "burn" etc.
    };

    const pool = owned.length ? owned : [];
    const teamGrid = $("#teamGrid");
    if (!pool.length) {
      teamGrid.innerHTML = `<div class="muted">No owned units available. Go to Roster → check Owned → come back.</div>`;
      return;
    }

    if (cfg.teamMode === "platoon") {
      const platoons = buildPlatoons(pool, cfg);
      renderPlatoons(teamGrid, platoons);
    } else {
      const team = buildTeam(pool, cfg); // story=8
      renderStoryTeam(teamGrid, team);
    }
  }

  $("#runOpt")?.addEventListener("click", run);

  $("#teamMode")?.addEventListener("change", () => {
    // Optional UI adjustments for compact display
    run();
  });

  $("#buildType")?.addEventListener("change", () => {
    const isMono = $("#buildType").value === "mono";
    const el = $("#monoElement");
    if (el) el.style.display = isMono ? "" : "none";
  });

  $("#buildType")?.dispatchEvent(new Event("change"));
  run();
}

main().catch(err => {
  console.error(err);
  const tg = $("#teamGrid");
  if (tg) tg.textContent = `ERROR: ${err.message}`;
});