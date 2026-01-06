let units = [];
let dragged = null;

fetch("units.json")
  .then(res => res.json())
  .then(data => {
    units = data;
    renderPool();
  });

function renderPool() {
  const pool = document.getElementById("unitPool");
  units.forEach(u => {
    const div = document.createElement("div");
    div.className = "unit";
    div.textContent = u.name;
    div.draggable = true;
    div.ondragstart = () => dragged = u;
    pool.appendChild(div);
  });
}
