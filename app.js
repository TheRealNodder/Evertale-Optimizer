// app.js (MODULE)

let units = [];
let draggedUnit = null;

// Load units
fetch("units.json")
  .then(res => res.json())
  .then(data => {
    units = data;
    renderUnitPool();
  })
  .catch(err => console.error(err));

// Render unit pool
function renderUnitPool() {
  const pool = document.getElementById("unitPool");
  pool.innerHTML = "";

  units.forEach(unit => {
    const div = document.createElement("div");
    div.className = "unit";
    div.textContent = unit.name;
    div.draggable = true;

    div.addEventListener("dragstart", () => {
      draggedUnit = unit;
    });

    pool.appendChild(div);
  });
}

// OPTIMIZER FUNCTION
function optimize() {
  const mode = document.getElementById("mode").value;
  const teamSize = Number(document.getElementById("teamSize").value);
  const results = document.getElementById("results");

  if (!units.length) {
    results.textContent = "No units loaded.";
    return;
  }

  const scored = units.map(u => {
    let score = 0;

    if (mode === "PVE") score = u.atk + u.hp * 0.6 + u.spd * 0.5;
    if (mode === "PVP") score = u.atk * 1.2 + u.spd * 1.5;
    if (mode === "BOSS") score = u.atk * 1.6 + u.hp * 0.8;
    if (mode === "STORY") score = u.atk + u.hp + u.spd;

    return { ...u, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const team = scored.slice(0, teamSize);

  results.innerHTML = `
    <h3>Optimized ${mode} Team</h3>
    <ul>
      ${team.map(u => `<li>${u.name} — ${Math.round(u.score)}</li>`).join("")}
    </ul>
  `;
}

// 🔥 THIS IS THE CRITICAL LINE 🔥
window.optimize = optimize;
