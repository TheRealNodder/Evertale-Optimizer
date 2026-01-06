function scoreUnit(u, mode, team) {
  let s = 0;
  if (mode === "PVE") s += u.atk + u.spd + u.hp * 0.6;
  if (mode === "PVP") s += u.atk * 1.1 + u.spd * 1.5 + u.hp * 0.4;
  if (mode === "BOSS") s += u.atk * 1.5 + u.hp * 0.8;
  if (mode === "STORY") s += u.atk + u.hp * 0.7 + u.spd * 0.5;
  return s;
}
