let units = [];
let draggedUnit = null;

// Load units
fetch("units.json")
  .then(response => response.json())
  .then(data => {
    units = data;
    renderUnitPool();
  })
  .catch(err => console.error("Unit load failed:", err));

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

// ✅ OPTIMIZER FUNCTION (NOW GUARANTEED TO LOAD)
function optimize() {
  const mode = document.getElementById("mode").value;
  const teamSize = parseInt(document.getElementById("teamSize").value);
  const results = document.getElementById("results");

  if (!units.length) {
    results.textContent = "No units loaded.";
    return;
  }

  const scoredUnits = units.map(u => {
    let score = 0;

    switch (mode) {
      case "PVE":
        score = u.atk + u.hp * 0.6 + u.spd * 0.5;
        break;
      case "PVP":
        score = u.atk * 1.2 + u.spd * 1.5 + u.hp * 0.4;
        break;
      case "BOSS":
        score = u.atk * 1.6 + u.hp * 0.8;
        break;
      case "STORY":
        score = u.atk + u.hp + u.spd;
        break;
    }

    return { ...u, score };
  });

  scoredUnits.sort((a, b) => b.score - a.score);
  const team = scoredUnits.slice(0, teamSize);

  results.innerHTML = `
    <h3>Optimized ${mode} Team</h3>
    <ul>
      ${team.map(u => `<li>${u.name} — ${Math.round(u.score)}</li>`).join("")}
    </ul>
  `;
}
