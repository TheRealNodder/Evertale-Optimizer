/* optimizer.js — FULL, FIXED (Story=8) */

const DATA_CHARACTERS = "./data/characters.json";

/**
 * IMPORTANT:
 * This MUST match the key used in app.js on the roster page.
 * If your roster app.js uses a different key, change it there OR here so they match.
 */
const LS_OWNED_KEY = "evertale_owned_units_v2";

const $ = (s) => document.querySelector(s);

function safeStr(v, fb = "") {
  return v == null ? fb : String(v);
}

function rarityScore(r) {
  const x = safeStr(r, "").toUpperCase();
  if (x === "SSR") return 40;
  if (x === "SR") return 25;
  if (x === "R") return 10;
  if (x === "N") return 3;
  return 0;
}

/** Load characters.json (supports [] or {characters: []}) */
async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`characters.json HTTP ${res.status}`);
  const json = await res.json();

  const arr = Array.isArray(json)
    ? json
    : (Array.isArray(json.characters) ? json.characters : null);

  if (!Array.isArray(arr)) throw new Error("ERROR LOADING characters.json is not an array");
  return arr;
}

/** Owned IDs set from roster page */
function loadOwnedIds() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

/**
 * Normalize a unit minimally while preserving all original fields (leader skill fields included).
 * Also ensures we have an id/name/image/secondaryName/rarity/element consistently.
 */
function normalizeUnit(raw, i) {
  const id = safeStr(raw.id, raw.unitId ?? raw.key ?? `unit_${i}`);
  const name = safeStr(raw.name, "");
  const secondaryName = safeStr(
    raw.secondaryName ?? raw.title ?? raw.handle ?? raw.subName ?? "",
    ""
  );

  const element = safeStr(raw.element ?? raw.elem ?? "Unknown", "Unknown");
  const rarity = safeStr(raw.rarity ?? raw.rank ?? raw.tier ?? "SSR", "SSR");
  const image = safeStr(raw.image ?? raw.imageUrl ?? raw.img ?? raw.icon ?? "", "");

  return {
    ...raw,
    id,
    name,
    secondaryName,
    element,
    rarity,
    image,
  };
}

/**
 * Robust leader skill getter for all the formats we’ve seen.
 * Returns { name, description } where name/description can be "None".
 */
function getLeaderSkill(u) {
  // Common object forms
  const obj =
    u.leaderSkill ??
    u.leader_skill ??
    u.leader ??
    u.leaderSkillRaw ??
    null;

  if (obj && typeof obj === "object") {
    const name = safeStr(obj.name ?? obj.title ?? "", "").trim();
    const description = safeStr(obj.description ?? obj.desc ?? obj.text ?? "", "").trim();
    if (name || description) return { name: name || "None", description: description || "None" };
  }

  // Flat fields
  const nameFlat = safeStr(
    u.leaderSkillName ?? u.leader_name ?? u.leaderName ?? "",
    ""
  ).trim();

  const descFlat = safeStr(
    u.leaderSkillDescription ?? u.leader_desc ?? u.leaderDescription ?? "",
    ""
  ).trim();

  if (nameFlat || descFlat) return { name: nameFlat || "None", description: descFlat || "None" };

  return { name: "None", description: "None" };
}

function leaderText(u) {
  const ls = getLeaderSkill(u);
  return `${ls.name} ${ls.description}`.toLowerCase();
}

function cardHtml(u) {
  const img = u.image
    ? `<img src="${u.image}" alt="${u.name}" loading="lazy">`
    : `<div class="ph">${(u.name || "?").slice(0, 1).toUpperCase()}</div>`;

  const ls = getLeaderSkill(u);
  const hasLeader = ls.name && ls.name !== "None" && ls.name !== "No Leader Skill";

  const leaderName = hasLeader ? ls.name : "No Leader Skill";
  const leaderDesc = hasLeader
    ? (ls.description && ls.description !== "None" ? ls.description : "")
    : "This unit does not provide a leader skill.";

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

        <div class="leaderBlock">
          <div class="leaderName">${leaderName}</div>
          <div class="leaderDesc">${leaderDesc || "—"}</div>
        </div>
      </div>
    </div>
  `;
}

function computeScore(u, cfg) {
  let score = 0;

  // Rarity baseline
  score += rarityScore(u.rarity);

  const lt = leaderText(u);

  // Theme scoring (burn/freeze/poison/stun/sleep)
  if (cfg.theme !== "none") {
    if (lt.includes(cfg.theme)) score += 50;
  }

  // Mono element scoring
  if (cfg.buildType === "mono") {
    if (safeStr(u.element).toLowerCase() === cfg.monoElement.toLowerCase()) score += 30;
    if (lt.includes(cfg.monoElement.toLowerCase())) score += 15;
  }

  // Bonus for common LS patterns (tunable)
  if (lt.includes("attack increased by 10%") || lt.includes("attack increased by 15%")) score += 20;
  if (lt.includes("max hp increased by 7%") || lt.includes("max hp increased by 10%")) score += 10;

  return score;
}

function buildTeam(units, cfg) {
  // YOUR CONFIRMED SIZES:
  // Story: 5 main + 3 backup = 8
  // Platoon: 5
  const teamSize = cfg.teamMode === "platoon" ? 5 : 8;

  const ranked = units
    .map(u => ({ ...u, _score: computeScore(u, cfg) }))
    .sort((a, b) => b._score - a._score);

  return ranked.slice(0, teamSize);
}

async function main() {
  const raw = await loadCharacters();
  const all = raw.map(normalizeUnit);

  const ownedIds = loadOwnedIds();
  const owned = all.filter(u => ownedIds.has(u.id));

  // Diagnostics on-page
  const ownedCountEl = $("#ownedCount");
  if (ownedCountEl) {
    ownedCountEl.textContent =
      `Owned IDs saved: ${ownedIds.size} • Owned matched in characters.json: ${owned.length} • Total units loaded: ${all.length}`;
  }

  // Show owned list
  const ownedGrid = $("#ownedGrid");
  if (ownedGrid) {
    ownedGrid.innerHTML = owned.map(cardHtml).join("") || `<div class="muted">No owned units found. Go to Roster and check “Owned”.</div>`;
  }

  function run() {
    const cfg = {
      teamMode: $("#teamMode").value,
      buildType: $("#buildType").value,
      monoElement: $("#monoElement").value,
      theme: $("#theme").value,
    };

    // If owned is empty, don’t pretend it worked—show a real message.
    const pool = owned.length ? owned : [];
    if (!pool.length) {
      $("#teamGrid").innerHTML = `<div class="muted">No owned units available to optimize. Go to Roster → check Owned → come back.</div>`;
      return;
    }

    const team = buildTeam(pool, cfg);
    $("#teamGrid").innerHTML = team.map(cardHtml).join("");
  }

  $("#runOpt")?.addEventListener("click", run);

  // Build-type toggle: hide mono element dropdown when rainbow
  $("#buildType")?.addEventListener("change", () => {
    const isMono = $("#buildType").value === "mono";
    const el = $("#monoElement");
    if (el) el.style.display = isMono ? "" : "none";
  });

  // init UI state + initial run
  $("#buildType")?.dispatchEvent(new Event("change"));
  run();
}

main().catch(err => {
  console.error(err);
  const tg = $("#teamGrid");
  if (tg) tg.textContent = `ERROR: ${err.message}`;
});