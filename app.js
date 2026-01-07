let units = [];

const el = (id) => document.getElementById(id);

function getStat(u, key){
  // supports both shapes:
  // {atk,hp,spd} or {stats:{atk,hp,spd}}
  if (u?.stats && typeof u.stats === "object") return Number(u.stats[key] || 0);
  return Number(u[key] || 0);
}

function normalizeWeaponList(u){
  // supports: weapons:[] or weapon1/secondaryWeapons
  if (Array.isArray(u.weapons)) return u.weapons.filter(Boolean);
  const w = [];
  if (u.weapon1) w.push(u.weapon1);
  if (Array.isArray(u.secondaryWeapons)) w.push(...u.secondaryWeapons);
  return [...new Set(w.filter(Boolean))];
}

function rarityLabel(r){
  if (r === 5) return "SSR";
  if (r === 4) return "SR";
  if (r === 3) return "R";
  return "Other";
}

function elementLabel(e){
  if (!e) return "Unknown";
  return String(e).trim();
}

function unitCard(u){
  const weapons = normalizeWeaponList(u);
  const rarity = Number(u.rarity ?? u?.rarity);
  const hp = getStat(u, "hp");
  const atk = getStat(u, "atk");
  const spd = getStat(u, "spd");

  const div = document.createElement("div");
  div.className = "card";
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

// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab, .tab-content").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// Fetch units from workflow output
fetch("data/units.json")
  .then(r => r.json())
  .then(data => {
    units = Array.isArray(data) ? data : [];
    renderUnitPool();
    initRosterFilters();
    renderRoster();
    initStorySlots();
    initPlatoonsShell();
  })
  .catch(err => {
    console.error("Failed to load data/units.json", err);
    const roster = el("rosterGrid");
    if (roster) roster.innerHTML = `<div class="results">Failed to load data/units.json</div>`;
  });

// Optimizer (basic for now)
function scoreUnit(u, mode){
  const atk = getStat(u,"atk");
  const hp  = getStat(u,"hp");
  const spd = getStat(u,"spd");

  if (mode === "PVP") return atk*1.25 + spd*1.55 + hp*0.35;
  if (mode === "BOSS") return atk*1.6 + hp*0.85 + spd*0.2;
  if (mode === "STORY") return atk*1.05 + hp*0.8 + spd*0.55;
  return atk + hp*0.6 + spd*0.5; // PVE
}

function optimize(){
  const mode = el("mode").value;
  const size = Number(el("teamSize").value);
  const results = el("results");

  const scored = units
    .map(u => ({...u, __score: scoreUnit(u, mode)}))
    .sort((a,b) => b.__score - a.__score)
    .slice(0, size);

  results.innerHTML = `
    <div class="muted">Top ${size}
