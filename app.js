let units = [];
let dragged = null;

// Load units
fetch("units.json")
  .then(res => res.json())
  .then(data => {
    units = data;
    renderPool();
  });

// Render unit pool
function renderPool() {
  const pool = document.getElementById("unitPool");
  pool.innerHTML = "";

  units.forEach(u => {
    const div = document.createElement("div");
    div.className = "unit";
    div.textContent = u.name;
    div.draggable = true;

    div.ondragstart = () => dragged = u;

    pool.appendChild(div);
  });
}

// ✅ THIS IS THE MISSING FUNCTION
function optimize() {
  const mode = document.getElementById("mode").value;
  const teamSize = parseInt(document.getElementById("teamSize").value);
  const results = document.getElementById("results");

  if (units.length === 0) {
    results.textContent = "No units loaded.";
    return;
  }

  // Simple optimization: top stats
  const scored = units.map(u => {
    let score = 0;
    if (mode === "PVE") score = u.atk + u.spd + u.
