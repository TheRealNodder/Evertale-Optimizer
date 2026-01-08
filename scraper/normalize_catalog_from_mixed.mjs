// scraper/normalize_catalog_from_mixed.mjs
// Input:  data/catalog.toolbox.json (messy/mixed)
// Output: data/catalog.json (clean, stable for the website)

import fs from "fs/promises";

const IN_FILE = "data/catalog.toolbox.json";
const OUT_FILE = "data/catalog.json";

const ELEMENTS = ["Fire", "Water", "Storm", "Earth", "Light", "Dark"];

function normStr(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function isHeaderRow(s) {
  const t = normStr(s).toLowerCase();
  return (
    t.includes("name rarity element cost") ||
    t === "name" ||
    t.startsWith("name rarity") ||
    t.includes("leader skill active skills passive skills")
  );
}

function guessCategory(item) {
  const cat = (item.category ?? item.type ?? "").toString().toLowerCase().trim();
  if (cat) return cat;

  const img = (item.image ?? item.imageUrl ?? item.img ?? item.icon ?? "").toString();
  const u = img.toLowerCase();

  if (u.includes("/weapons/")) return "weapon";
  if (u.includes("/accessories/")) return "accessory";
  if (u.includes("/monsters/")) {
    // Toolbox uses /monsters/ for many things; default to character.
    return "character";
  }
  return "unknown";
}

function absUrl(u) {
  if (!u) return null;
  const s = String(u);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return s;
}

function pickStatsHeuristic(nums) {
  // We want: cost (1-99), atk (100-99999), hp (100-999999), spd (1-99)
  // The mixed string often contains many digits; we’ll search for a plausible 4-tuple.
  const n = nums.map(x => Number(x)).filter(Number.isFinite);
  if (n.length < 4) return { cost: null, atk: null, hp: null, spd: null };

  let best = null;

  for (let i = 0; i <= n.length - 4; i++) {
    const a = n[i], b = n[i+1], c = n[i+2], d = n[i+3];

    const costOk = a >= 1 && a <= 99;
    const atkOk  = b >= 100 && b <= 99999;
    const hpOk   = c >= 100 && c <= 999999;
    const spdOk  = d >= 1 && d <= 99;

    const score =
      (costOk ? 2 : 0) +
      (atkOk ? 2 : 0) +
      (hpOk ? 2 : 0) +
      (spdOk ? 2 : 0) -
      (a > 200 ? 2 : 0) -
      (d > 200 ? 2 : 0);

    if (!best || score > best.score) {
      best = { score, cost: costOk ? a : null, atk: atkOk ? b : null, hp: hpOk ? c : null, spd: spdOk ? d : null };
    }
  }

  // Fallback: take last 4 numbers
  if (!best || best.score < 4) {
    const tail = n.slice(-4);
    const [cost, atk, hp, spd] = tail;
    return {
      cost: cost >= 1 && cost <= 99 ? cost : null,
      atk: atk >= 100 && atk <= 99999 ? atk : null,
      hp: hp >= 100 && hp <= 999999 ? hp : null,
      spd: spd >= 1 && spd <= 99 ? spd : null,
    };
  }

  return { cost: best.cost, atk: best.atk, hp: best.hp, spd: best.spd };
}

function parseFromMixedString(mixed) {
  // Example mixed string:
  // "Rizette Cerulean Valkyrie 341,7198,105409Light HP Up Allied Light..."
  //
  // We do:
  // 1) find element word
  // 2) everything before element: extract digits and name
  // 3) name = leading words before first digit sequence
  const s = normStr(mixed);
  if (!s) return null;

  // Find element
  let element = null;
  let elementIdx = -1;
  for (const el of ELEMENTS) {
    const idx = s.indexOf(el);
    if (idx !== -1 && (elementIdx === -1 || idx < elementIdx)) {
      element = el;
      elementIdx = idx;
    }
  }

  const head = elementIdx !== -1 ? s.slice(0, elementIdx) : s;

  // Name = head until first digit
  const m = head.match(/^(.+?)(\d)/);
  let name = null;
  if (m) name = normStr(m[1]);
  else name = s; // no digits at all, treat whole as name

  // Pull digits from head (often contains cost/atk/hp/spd stuck together)
  const nums = head.match(/\d+/g) ?? [];
  const stats = pickStatsHeuristic(nums);

  return {
    name,
    element,
    ...stats,
  };
}

function cleanIdFromName(name) {
  return normStr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function run() {
  const rawText = await fs.readFile(IN_FILE, "utf8").catch(() => null);
  if (!rawText) {
    throw new Error(`Missing ${IN_FILE}. Generate/commit it first.`);
  }

  const raw = JSON.parse(rawText);
  const items =
    Array.isArray(raw) ? raw :
    Array.isArray(raw.items) ? raw.items :
    Array.isArray(raw.catalog?.items) ? raw.catalog.items :
    [];

  if (!items.length) throw new Error(`No items found in ${IN_FILE} (items array empty).`);

  const out = [];
  const seen = new Set();

  for (const it of items) {
    const mixedName = it.name ?? it.id ?? "";
    const s = normStr(mixedName);

    if (!s || isHeaderRow(s)) continue;

    const cat = guessCategory(it);
    const img = absUrl(it.image ?? it.imageUrl ?? it.img ?? it.icon ?? null);

    let name = normStr(it.name ?? "");
    let element = it.element ?? null;
    let cost = it.cost ?? null;
    let atk = it.atk ?? null;
    let hp = it.hp ?? null;
    let spd = it.spd ?? null;

    // If it looks like the bad “everything in one string” row, parse it
    const looksMixed = name.split(" ").length > 8 && /\d/.test(name);
    if (looksMixed || !element || cost == null || atk == null || hp == null || spd == null) {
      const parsed = parseFromMixedString(name);
      if (parsed?.name) name = parsed.name;
      if (parsed?.element) element = parsed.element;
      if (cost == null) cost = parsed?.cost ?? null;
      if (atk == null) atk = parsed?.atk ?? null;
      if (hp == null) hp = parsed?.hp ?? null;
      if (spd == null) spd = parsed?.spd ?? null;
    }

    name = normStr(name);
    if (!name) continue;

    const id = normStr(it.id ?? cleanIdFromName(name));
    if (!id) continue;

    // Dedup by id
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      name,
      category: cat,
      element: element ?? null,
      cost: cost != null ? Number(cost) : null,
      atk: atk != null ? Number(atk) : null,
      hp: hp != null ? Number(hp) : null,
      spd: spd != null ? Number(spd) : null,
      image: img,
      url: it.url ?? "https://evertaletoolbox2.runasp.net/Explorer",
    });
  }

  // Sort for stability
  out.sort((a, b) => (a.category.localeCompare(b.category) || a.name.localeCompare(b.name)));

  const payload = {
    generatedAt: new Date().toISOString(),
    generatedFrom: IN_FILE,
    count: out.length,
    items: out,
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Wrote ${OUT_FILE} items=${out.length}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});