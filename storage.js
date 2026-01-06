function saveTeams(data) {
  localStorage.setItem("teams", JSON.stringify(data));
}

function loadTeams() {
  return JSON.parse(localStorage.getItem("teams")) || {
    story: [],
    platoons: Array(20).fill([])
  };
}
