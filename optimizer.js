const DATA_CHARACTERS = "./data/characters.json";
const LS_OWNED_KEY = "evertale_owned_units_v2";

const $ = (s) => document.querySelector(s);

function safeStr(v, fb=""){ return v==null ? fb : String(v); }

function leaderText(u) {
  const ls = u?.leaderSkill || u?.leader_skill || null;
  const name =
    safeStr(ls?.name ?? u?.leaderSkillName ?? u?.leader_name ?? "", "").trim();
  const desc =
    safeStr(ls?.description ?? u?.leaderSkillDescription ?? u?.leader_desc ?? "", "").trim();
  return `${name} ${desc}`.toLowerCase();
}

function rarityScore(r) {
  const x = safeStr(r,"").toUpperCase();
  if (x === "SSR") return 40;
  if (x === "SR") return 25;
  if (x === "R") return 10;
  if (x === "N") return 3;
  return 0;
}

function normalizeUnit(raw, i) {
  return {
    ...raw,
    id: safeStr(raw.id, raw.unitId ?? raw.key ?? `unit_${i}`),
    name: safeStr(raw.name,""),
    secondaryName: safeStr(raw.secondaryName ?? raw.title ?? raw.handle ?? "", ""),
    element: safeStr(raw.element,"Unknown"),
    rarity: safeStr(raw.rarity ?? raw.rank ?? "SSR","SSR"),
    image: safeStr(raw.image ?? raw.imageUrl ?? raw.img ?? "", ""),
  };
}

async function loadCharacters() {
  const res = await fetch(DATA_CHARACTERS, { cache: "no-store" });
  if (!res.ok) throw new Error(`characters.json HTTP ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : (Array.isArray(json.characters) ? json.characters : []);
  if (!Array.isArray(arr)) throw new Error("characters.json is not an array");
  return arr;
}

function loadOwnedIds() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function cardHtml(u) {
  const img = u.image
    ? `<img src="${u.image}" alt="${u.name}" loading="lazy">`
    : `<div class="ph">${(u.name||"?").slice(0,1).toUpperCase()}</div>`;

  const leader = (u.leaderSkill?.name && u.leaderSkill?.name !== "None")
    ? `${u.leaderSkill.name}: ${u.leaderSkill.description || ""}`
    : (u.leader_skill?.name && u.leader_skill?.name !== "None")
      ? `${u.leader_skill.name}: ${u.leader_skill.description || ""}`
      : "";

  return `
    <div class="unitCard">
      <div class="unitThumb">${img}</div>
      <div class="meta">
        <div class="unitName">${u.name}</div>
        <div class="unitTitle">${u.secondaryName || ""}</div>
        <div class="tags">
          <span class="tag rarity">${u.rarity}</span>
          <span class="tag element">${u.element}</span>
        </div>
        <div class="leaderBlock">
          <div class="leaderDesc">${leader || "—"}</div>
        </div>
      </div>
    </div>
  `;
}

function computeScore(u, cfg) {
  let score = 0;

  score += rarityScore(u.rarity);

  const lt = leaderText(u);

  // Theme scoring
  if (cfg.theme !== "none") {
    if (lt.includes(cfg.theme)) score += 50;
  }

  // Mono element scoring
  if (cfg.buildType === "mono") {
    if (safeStr(u.element).toLowerCase() === cfg.monoElement.toLowerCase()) score += 30;
    // Bonus if leader text mentions the same element
    if (lt.includes(cfg.monoElement.toLowerCase())) score += 15;
  }

  // Bonus for common “best LS” patterns
  if (lt.includes("attack increased by 10%") || lt.includes("attack increased by 15%")) score += 20;
  if (lt.includes("max hp increased by 7%") || lt.includes("max hp increased by 10%")) score += 10;

  return score;
}

function buildTeam(ownedUnits, cfg) {
  const teamSize = cfg.teamMode === "platoon" ? 5 : 7;

  const ranked = ownedUnits
    .map(u => ({ ...u, _score: computeScore(u, cfg) }))
    .sort((a,b) => b._score - a._score);

  // v1: just pick top N
  return ranked.slice(0, teamSize);
}

async function main() {
  const raw = await loadCharacters();
  const all = raw.map(normalizeUnit);

  const ownedIds = loadOwnedIds();
  const ownedUnits = all.filter(u => ownedIds.has(u.id));

  $("#ownedCount").textContent = `Owned selected: ${ownedUnits.length}`;

  $("#ownedGrid").innerHTML = ownedUnits.map(cardHtml).join("");

  function run() {
    const cfg = {
      teamMode: $("#teamMode").value,
      buildType: $("#buildType").value,
      monoElement: $("#monoElement").value,
      theme: $("#theme").value,
    };

    // If rainbow, monoElement is irrelevant (but we keep it)
    const team = buildTeam(ownedUnits, cfg);
    $("#teamGrid").innerHTML = team.map(cardHtml).join("");
  }

  $("#runOpt").addEventListener("click", run);

  // UI toggles
  $("#buildType").addEventListener("change", () => {
    const isMono = $("#buildType").value === "mono";
    $("#monoElement").style.display = isMono ? "" : "none";
  });

  // initial run
  $("#buildType").dispatchEvent(new Event("change"));
  run();
}

main().catch(err => {
  console.error(err);
  $("#teamGrid").textContent = `ERROR: ${err.message}`;
});