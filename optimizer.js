// optimizer.js
const DATA_URL = "./data/characters.json";
const OWNED_KEY = "ownedUnitIds";

const $ = (sel) => document.querySelector(sel);

function showStatus(msg) {
  $("#status").classList.remove("hidden");
  $("#statusMsg").textContent = msg;
}
function hideStatus() {
  $("#status").classList.add("hidden");
}

function loadOwnedSet() {
  try {
    const raw = localStorage.getItem(OWNED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function getLeaderText(u) {
  // supports multiple shapes
  if (typeof u.leaderSkill === "string") return u.leaderSkill;
  if (u.leaderSkill && typeof u.leaderSkill.text === "string") return u.leaderSkill.text;
  if (u.leaderSkill && typeof u.leaderSkill.description === "string") return u.leaderSkill.description;
  if (typeof u.leaderSkillText === "string") return u.leaderSkillText;
  return "";
}

function rarityClass(r) {
  const x = String(r || "").toUpperCase();
  if (x === "SSR") return "rarity-ssr";
  if (x === "SR") return "rarity-sr";
  if (x === "R") return "rarity-r";
  return "rarity-n";
}

function unitCard(u) {
  const leader = getLeaderText(u);

  const wrap = document.createElement("div");
  wrap.className = "leader-card";
  wrap.style.cssText = "display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;background:rgba(255,255,255,0.06);margin:10px 0;";

  const img = document.createElement("img");
  img.src = u.image || "";
  img.alt = u.name || u.id || "unit";
  img.loading = "lazy";
  img.style.cssText = "width:64px;height:64px;border-radius:12px;object-fit:cover;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);";
  wrap.appendChild(img);

  const right = document.createElement("div");
  right.style.cssText = "flex:1;min-width:0;";

  const top = document.createElement("div");
  top.style.cssText = "display:flex;gap:8px;align-items:center;justify-content:space-between;";

  const title = document.createElement("div");
  title.style.cssText = "font-weight:800;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
  title.textContent = u.name || u.id || "Unknown";
  top.appendChild(title);

  const rarity = document.createElement("span");
  rarity.className = `rarity-pill ${rarityClass(u.rarity)}`;
  rarity.textContent = (u.rarity || "N").toUpperCase();
  top.appendChild(rarity);

  right.appendChild(top);

  const meta = document.createElement("div");
  meta.style.cssText = "margin-top:6px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:rgba(255,255,255,0.72);font-size:12px;";
  const e = document.createElement("span");
  e.className = "chip";
  e.textContent = `Element: ${u.element || "?"}`;
  meta.appendChild(e);

  const stats = document.createElement("span");
  stats.className = "chip";
  stats.textContent = `ATK ${u.atk ?? "?"} • HP ${u.hp ?? "?"} • SPD ${u.spd ?? "?"}`;
  meta.appendChild(stats);

  right.appendChild(meta);

  if (leader) {
    const ls = document.createElement("div");
    ls.style.cssText = "margin-top:8px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.15);";
    ls.innerHTML = `<div style="font-weight:800;margin-bottom:4px;">Leader Skill</div><div style="color:rgba(255,255,255,0.78);font-size:13px;line-height:1.35;"></div>`;
    ls.querySelector("div:last-child").textContent = leader;
    right.appendChild(ls);
  }

  wrap.appendChild(right);
  return wrap;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return await res.json();
}

function normalizeCatalog(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.characters)) return raw.characters;
  if (raw && Array.isArray(raw.items)) return raw.items;
  return [];
}

function scoreLeader(u, monoOnly, monoElement, keyword) {
  let s = 0;

  const r = String(u.rarity || "").toUpperCase();
  if (r === "SSR") s += 30;
  else if (r === "SR") s += 20;
  else if (r === "R") s += 10;

  const lt = getLeaderText(u).toLowerCase();
  if (lt) s += 10;

  if (monoOnly && monoElement) {
    if ((u.element || "").toLowerCase() === monoElement.toLowerCase()) s += 25;
    else s -= 10;
  }

  if (keyword) {
    const k = keyword.toLowerCase().trim();
    if (k && lt.includes(k)) s += 25;
  }

  // Prefer buffs that mention attack/hp (simple heuristic)
  if (lt.includes("attack")) s += 8;
  if (lt.includes("hp")) s += 6;
  if (lt.includes("increased")) s += 4;

  return s;
}

async function main() {
  showStatus("Loading characters…");
  const raw = await fetchJson(DATA_URL);
  const all = normalizeCatalog(raw);

  const owned = loadOwnedSet();
  const ownedUnits = all.filter(u => owned.has(u.id));

  // Owned grid (all owned units)
  const ownedGrid = $("#ownedGrid");
  ownedGrid.innerHTML = "";
  ownedUnits.forEach(u => ownedGrid.appendChild(unitCard(u)));

  // Leader candidates
  const monoOnly = $("#monoOnly");
  const monoElement = $("#monoElement");
  const keyword = $("#keyword");

  function renderLeaders() {
    const mono = monoOnly.checked;
    const el = monoElement.value;
    const kw = keyword.value;

    const leaders = ownedUnits
      .filter(u => !!getLeaderText(u))
      .map(u => ({ u, s: scoreLeader(u, mono, el, kw) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 50)
      .map(x => x.u);

    const box = $("#leaderCandidates");
    box.innerHTML = "";
    if (!leaders.length) {
      box.textContent = "No owned units with leader skills found.";
      return;
    }
    leaders.forEach(u => box.appendChild(unitCard(u)));
  }

  monoOnly.addEventListener("change", renderLeaders);
  monoElement.addEventListener("change", renderLeaders);
  keyword.addEventListener("input", renderLeaders);

  renderLeaders();
  hideStatus();
}

main().catch(err => {
  console.error(err);
  showStatus(String(err?.message || err));
});