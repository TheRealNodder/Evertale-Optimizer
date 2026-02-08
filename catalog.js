/* catalog.js — WHOLE FILE
   Catalog (no Owned):
   - Shows Characters, Weapons, Accessories, Bosses in one unified grid.
   - Search supports:
     - normal substring search
     - paste list (multi-line / comma-separated) => filters to only those items
   - Uses same view toggle as roster: body.mobile-compact / body.mobile-detailed
*/

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='100%' height='100%' fill='%23121522'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23aab1d6' font-family='Arial' font-size='14'>No Image</text></svg>";

const BAD_IMG_CACHE_KEY = "evertale_bad_img_urls_v1";
const BAD_IMG_CACHE = new Set(safeJsonParse(localStorage.getItem(BAD_IMG_CACHE_KEY), []));
function markBadImgUrl(url){
  try{
    if(!url) return;
    BAD_IMG_CACHE.add(url);
    localStorage.setItem(BAD_IMG_CACHE_KEY, JSON.stringify(Array.from(BAD_IMG_CACHE)));
  }catch{}
}
function isBadImgUrl(url){
  try{ return !!url && BAD_IMG_CACHE.has(url); }catch{ return false; }
}

const DATA = {
  characters: "./data/characters.json",
  weapons: "./data/weapons.json",
  accessories: "./data/accessories.json",
  bosses: "./data/bosses.json",
};

const LS_MOBILE_VIEW_KEY = "evertale_mobile_view_v1"; // shared with roster

const state = {
  items: [], // { kind, id, name, subtitle, rarity, element, stats, image, extraText }
  q: "",
  type: "all",
  listTokens: null,
};

const $ = (id) => document.getElementById(id);

function safeJsonParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function getMobileViewPref() {
  const v = localStorage.getItem(LS_MOBILE_VIEW_KEY);
  return (v === "detailed" || v === "compact") ? v : "compact";
}
function setMobileViewPref(v) {
  localStorage.setItem(LS_MOBILE_VIEW_KEY, v);
}
function applyMobileViewClass(view) {
  document.body.classList.add("page-catalog");
  document.body.classList.remove("mobile-compact", "mobile-detailed");
  document.body.classList.add(view === "detailed" ? "mobile-detailed" : "mobile-compact");
}
function syncViewToggleText() {
  const btn = $("viewToggle");
  if (!btn) return;
  const v = getMobileViewPref();
  btn.textContent = `View: ${v === "compact" ? "Compact" : "Detailed"}`;
}

function safeText(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function parseListTokens(text) {
  const raw = String(text ?? "");
  const parts = raw
    .split(/[\n\r,;\t]+/g)
    .map(s => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) return null;

  const tokens = [];
  const seen = new Set();
  for (const p of parts) {
    const k = normKey(p);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    tokens.push(k);
  }
  return tokens.length ? tokens : null;
}

function matchesTokens(item, tokens) {
  const id = normKey(item.id);
  const name = normKey(item.name);
  const sub = normKey(item.subtitle);
  for (const t of tokens) {
    if (!t) continue;
    if (t === id || t === name || t === sub) return true;
    if (t.length >= 4) {
      if (name.includes(t) || sub.includes(t)) return true;
    }
  }
  return false;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.json();
}

function toArray(json, keyGuess) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json[keyGuess])) return json[keyGuess];
  if (json && Array.isArray(json.items)) return json.items;
  return [];
}

function pickFirst(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return "";
}

function normalizeCharacters(arr) {
  // Deduplicate by id (keep first occurrence)
  const seen = new Set();
  const out = [];
  for (const u of arr) {
    const id = String(u?.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const atk = u.atk ?? u.stats?.atk ?? "";
    const hp  = u.hp  ?? u.stats?.hp  ?? "";
    const spd = u.spd ?? u.stats?.spd ?? "";
    const cost= u.cost?? u.stats?.cost?? "";

    out.push({
      kind: "characters",
      id,
      name: pickFirst(u.name, id),
      subtitle: pickFirst(u.title, ""),
      rarity: pickFirst(u.rarity, ""),
      element: pickFirst(u.element, ""),
      stats: { atk, hp, spd, cost },
      image: pickFirst(u.image, ""),
      imagesLarge: Array.isArray(u.imagesLarge) ? u.imagesLarge : (u.image ? [u.image] : []),
      leaderSkillName: pickFirst(u.leaderSkill?.name, ""),
      leaderSkillDesc: pickFirst(u.leaderSkill?.description, ""),
      extraText: "",
    });
  }
  return out;
}

function normalizeWeapons(arr) {
  return arr.map(w => ({
    kind: "weapons",
    id: String(w?.id ?? ""),
    name: pickFirst(w?.name, ""),
    subtitle: pickFirst(w?.weaponType, w?.category, ""),
    rarity: pickFirst(w?.rarity, ""),
    element: "", // weapons may not have element
    stats: { atk: pickFirst(w?.atk, ""), hp: pickFirst(w?.hp, ""), spd: "", cost: "" },
    image: pickFirst(w?.image, ""),
    extraText: pickFirst(w?.effect, w?.source, ""),
  })).filter(x => x.id && x.name);
}

function normalizeAccessories(arr) {
  return arr.map(a => ({
    kind: "accessories",
    id: String(a?.id ?? ""),
    name: pickFirst(a?.name, ""),
    subtitle: pickFirst(a?.category, ""),
    rarity: pickFirst(a?.rarity, a?.stars, ""),
    element: pickFirst(a?.element, ""),
    stats: { atk: pickFirst(a?.atk, ""), hp: pickFirst(a?.hp, ""), spd: pickFirst(a?.spd, ""), cost: pickFirst(a?.cost, "") },
    image: pickFirst(a?.image, ""),
    extraText: pickFirst(a?.profile, ""),
  })).filter(x => x.id && x.name);
}

function normalizeBosses(arr) {
  return arr.map(b => ({
    kind: "bosses",
    id: String(b?.id ?? ""),
    name: pickFirst(b?.name, ""),
    subtitle: pickFirst(b?.weaponType, b?.category, ""),
    rarity: pickFirst(b?.rarity, b?.stars, ""),
    element: pickFirst(b?.element, ""),
    stats: { atk: pickFirst(b?.atk, ""), hp: pickFirst(b?.hp, ""), spd: pickFirst(b?.spd, ""), cost: "" },
    image: pickFirst(b?.image, ""),
    extraText: "", // keep clean
  })).filter(x => x.id && x.name);
}

function kindLabel(kind) {
  if (kind === "characters") return "Character";
  if (kind === "weapons") return "Weapon";
  if (kind === "accessories") return "Accessory";
  if (kind === "bosses") return "Boss";
  return kind;
}

function renderCard(item) {
  const imgsRaw = (item.kind==="characters" && Array.isArray(item.imagesLarge) && item.imagesLarge.length)
    ? item.imagesLarge
    : (item.image ? [item.image] : []);
  const imgs = (imgsRaw || []).filter(u => u && !isBadImgUrl(u));

  const img = imgs.length
    ? `<img src="${safeText(imgs[0])}" data-imgs="${safeText(encodeURIComponent(JSON.stringify(imgs)))}" data-state="0" alt="${safeText(item.name)}" onerror="markBadImgUrl(this.src);this.onerror=null;this.src=PLACEHOLDER_IMG;">`
    : `<div class="ph">?</div>`;

  // Element class only applies to characters
  const elClass = (item.kind==="characters" && item.element) ? ` el-${safeText(String(item.element).toLowerCase())}` : "";

  // Right-side badges
  // Strict classes so CSS can place them:
  //   .tag.kind   => Character / Weapon / Accessory / Boss
  //   .tag.element=> Element (characters only)
  //   .tag.rarity => SSR/SR/R/etc
  const chips = [];
  chips.push(`<span class="tag kind">${safeText(kindLabel(item.kind))}</span>`);
  if (item.element) chips.push(`<span class="tag element">${safeText(item.element)}</span>`);
  if (item.rarity)  chips.push(`<span class="tag rarity">${safeText(item.rarity)}</span>`);

  const { atk, hp, spd, cost } = item.stats || {};
  const statParts = [];
  if (atk !== "" && atk != null) statParts.push(`<div class="stat"><span class="statLabel">ATK</span><span class="statVal">${safeText(atk)}</span></div>`);
  if (hp !== "" && hp != null) statParts.push(`<div class="stat"><span class="statLabel">HP</span><span class="statVal">${safeText(hp)}</span></div>`);
  if (spd !== "" && spd != null) statParts.push(`<div class="stat"><span class="statLabel">SPD</span><span class="statVal">${safeText(spd)}</span></div>`);
  if (cost !== "" && cost != null) statParts.push(`<div class="stat"><span class="statLabel">COST</span><span class="statVal">${safeText(cost)}</span></div>`);

  // For compact mode, panels are hidden via CSS; this keeps markup consistent
  const extra = item.extraText
    ? `<div class="panel"><div class="panelTitle">Info</div><div class="muted" style="white-space:pre-wrap">${safeText(item.extraText)}</div></div>`
    : "";

  return `
    <div class="unitCard${elClass}" data-kind="${safeText(item.kind)}" data-id="${safeText(item.id)}">
      <div class="unitLeft">
        <div class="unitThumb">${img}</div>
        ${item.kind==="characters" ? stateRowHtml(imgs) : ""}
      </div>

      <div class="meta">
        <div class="metaHeader">
          <div class="nameBlock">
            <div class="unitName">${safeText(item.name)}</div>
            <div class="unitTitle">${safeText(item.subtitle || "")}</div>
          </div>
          <div class="chipCol">${chips.join("")}</div>
        </div>

        <div class="unitDetails">
          ${statParts.length ? `<div class="statLine">${statParts.join("")}</div>` : ""}
          ${
            item.kind === "characters" && (item.leaderSkillName || item.leaderSkillDesc)
              ? `<div class="leaderBlock">
                   <div class="leaderName">${safeText(item.leaderSkillName || "No Leader Skill")}</div>
                   <div class="leaderDesc">${safeText(item.leaderSkillDesc || "This unit does not provide a leader skill.")}</div>
                 </div>`
              : ""
          }
          ${extra}
        </div>
      </div>
    </div>
  `;
}

function render() {
  const grid = $("catalogGrid");
  const status = $("statusText");
  if (!grid) return;

  const q = (state.q || "").toLowerCase();
  const tokens = state.listTokens;

  let items = state.items;

  if (state.type !== "all") items = items.filter(i => i.kind === state.type);

  items = items.filter(i => {
    if (tokens && tokens.length) return matchesTokens(i, tokens);

    if (!q) return true;
    const hay = `${i.name} ${i.subtitle} ${i.rarity} ${i.element} ${i.kind}`.toLowerCase();
    return hay.includes(q);
  });

  if (status) {
    status.textContent = tokens?.length
      ? `${items.length} matched from pasted list`
      : `${items.length} items shown`;
  }

  grid.innerHTML = items.map(renderCard).join("");
}


function stateRowHtml(imgs){
  if(!Array.isArray(imgs) || imgs.length < 2) return "";
  const enc = encodeURIComponent(JSON.stringify(imgs));
  const btns = imgs.map((_,i)=>`<button type="button" class="stateBtn ${i===0?"active":""}" data-idx="${i}" aria-label="State ${i+1}"></button>`).join("");
  return `<div class="stateRow" data-imgs="${enc}">${btns}</div>`;
}

function attachStateHandlers(root){
  // Button click: jump to state
  root.addEventListener("click",(e)=>{
    const btn = e.target.closest(".stateBtn");
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const row = btn.closest(".stateRow");
    const enc = row?.getAttribute("data-imgs") || "";
    let imgs=[];
    try{ imgs = JSON.parse(decodeURIComponent(enc)); }catch{}
    if(!imgs.length) return;

    const card = btn.closest(".unitCard");
    const imgEl = card?.querySelector(".unitThumb img");
    if(!imgEl) return;

    const idx = parseInt(btn.getAttribute("data-idx")||"0",10);
    if(!Number.isFinite(idx) || idx<0 || idx>=imgs.length) return;

    imgEl.src = imgs[idx];
    imgEl.setAttribute("data-state", String(idx));
    row.querySelectorAll(".stateBtn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
  });

  // Image click: cycle state
  root.addEventListener("click",(e)=>{
    const img = e.target.closest(".unitThumb img");
    if(!img) return;
    const card = img.closest(".unitCard");
    if(!card) return;

    const enc = img.getAttribute("data-imgs") || card.querySelector(".stateRow")?.getAttribute("data-imgs") || "";
    let imgs=[];
    try{ imgs = JSON.parse(decodeURIComponent(enc)); }catch{}
    if(!Array.isArray(imgs) || imgs.length < 2) return;

    e.preventDefault();
    e.stopPropagation();

    const cur = parseInt(img.getAttribute("data-state")||"0",10);
    const next = (Number.isFinite(cur) ? (cur+1) : 1) % imgs.length;

    img.src = imgs[next];
    img.setAttribute("data-state", String(next));

    const row = card.querySelector(".stateRow");
    if(row){
      row.querySelectorAll(".stateBtn").forEach((b,i)=>b.classList.toggle("active", i===next));
    }
  });
}


async function init() {
  applyMobileViewClass(getMobileViewPref());
  syncViewToggleText();

  const [charsJson, weaponsJson, accJson, bossesJson] = await Promise.all([
    fetchJson(DATA.characters),
    fetchJson(DATA.weapons),
    fetchJson(DATA.accessories),
    fetchJson(DATA.bosses),
  ]);

  const charsArr = toArray(charsJson, "characters");
  const weaponsArr = toArray(weaponsJson, "weapons");
  const accArr = toArray(accJson, "accessories");
  const bossesArr = toArray(bossesJson, "bosses");

  state.items = [
    ...normalizeCharacters(charsArr),
    ...normalizeWeapons(weaponsArr),
    ...normalizeAccessories(accArr),
    ...normalizeBosses(bossesArr),
  ];

  // Controls
  const search = $("catalogSearch");
  const typeSel = $("catalogType");
  const viewBtn = $("viewToggle");

  search?.addEventListener("input", () => {
    const v = search.value || "";
    const maybeList = parseListTokens(v);
    state.listTokens = maybeList;
    state.q = maybeList ? "" : v;
    render();
  });

  search?.addEventListener("paste", (e) => {
    const pasted = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    setTimeout(() => {
      const tokens = parseListTokens(pasted);
      if (tokens) {
        state.listTokens = tokens;
        state.q = "";
        render();
      }
    }, 0);
  });

  typeSel?.addEventListener("change", () => {
    state.type = String(typeSel.value || "all");
    render();
  });

  viewBtn?.addEventListener("click", () => {
    const cur = getMobileViewPref();
    const next = (cur === "compact") ? "detailed" : "compact";
    setMobileViewPref(next);
    applyMobileViewClass(next);
    syncViewToggleText();
  });

  window.addEventListener("resize", () => {
    applyMobileViewClass(getMobileViewPref());
  });

  render();

  // enable state toggles
  const grid = $("catalogGrid");
  if (grid) attachStateHandlers(grid);
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error(err);
    const status = $("statusText");
    if (status) status.textContent = `Error: ${String(err.message || err)}`;
  });
});
