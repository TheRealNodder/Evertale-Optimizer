let units = [];

// Load data
fetch("units.json")
  .then(r => r.json())
  .then(data => {
    units = data;
    renderUnitPool();
    renderRoster();
  });

// Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab, .tab-content")
      .forEach(el => el.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// Unit pool
function renderUnitPool() {
  const pool = document.getElementById("unitPool");
  pool.innerHTML = "";

  units.forEach(u => {
    pool.appendChild(unitCard(u));
  });
}

// Full roster
function renderRoster() {
  const roster = document.getElementById("rosterGrid");
  roster.innerHTML = "";

  units.forEach(u => {
    roster.appendChild(unitCard(u, true));
  });
}

// Card
function unitCard(u, detailed = false) {
  const div = document.createElement("div");
  div.className = "card";

  div.innerHTML = `
    <div class="name">${u.name}</div>
    <div class="element">${u.element}</div>
    <div>ATK ${u.atk}</div>
    <div>HP ${u.hp}</div>
    <div>SPD ${u.spd}</div>
    ${detailed ? `<div>Rarity ★${u.rarity}</div>` : ""}
  `;
  return div;
}

// Optimizer
function optimize() {
  const mode = document.getElementById("mode").value;
  const size = Number(document.getElementById("teamSize").value);
  const results = document.getElementById("results");

  const scored = units.map(u => ({
    ...u,
    score:
      mode === "PVP" ? u.atk * 1.3 + u.spd * 1.5 :
      mode === "BOSS" ? u.atk * 1.6 + u.hp * 0.8 :
      u.atk + u.hp + u.spd
  }));

  scored.sort((a, b) => b.score - a.score);
  const team = scored.slice(0, size);

  results.innerHTML = `
    <ul>
      ${team.map(u => `<li>${u.name}</li>`).join("")}
    </ul>
  `;
}

window.optimize = optimize;
