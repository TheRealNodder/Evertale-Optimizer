// scraper/normalize_toolbox_items.mjs
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");
const IN_ITEMS = path.join(DATA_DIR, "toolbox.items.json");
const OUT_CLEAN = path.join(DATA_DIR, "catalog.clean.json");

const ORIGIN = "https://evertaletoolbox2.runasp.net";

function norm(s) {
  return (s ?? "").toString().replace(/\s+/g, " ").trim();
}

function absImg(u) {
  if (!u) return null;
  const s = u.toString();
  if (s.startsWith("http")) return s;
  if (s.startsWith("/")) return ORIGIN + s;
  return s;
}

function catFromAny(it) {
  const img = (it.image || it.imageUrl || it.icon || it.img || "").toString().toLowerCase();

  if (img.includes("/files/images/weapons/")) return "weapon";
  if (img.includes("/files/images/accessories/")) return "accessory";
  if (img.includes("/files/images/monsters/")) return "enemy";
  if (img.includes("/files/images/boss")) return "boss";
  if (img.includes("/files/images/units/") || img.includes("/files/images/characters/")) return "character";

  // fallback if toolbox includes type fields
  const t = norm(it.type || it.category).toLowerCase();
  if (t.includes("weapon")) return "weapon";
  if (t.includes("access")) return "accessory";
  if (t.includes("boss")) return "boss";
  if (t.includes("enemy") || t.includes("monster")) return "enemy";
  if (t.includes("unit") || t.includes("char")) return "character";

  return "unknown";
}

function toNum(v) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function makeId(it) {
  const id = norm(it.id || it.key || it.unitId);
  if (id) return id;
  const name = norm(it.name || it.title || it.label);
  return name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : null;
}

function split(items) {
  const out = { characters: [], weapons: [], accessories: [], enemies: [], bosses: [], unknown: [] };
  for (const x of items) {
    const c = x.category;
    if (c === "character") out.characters.push(x);
    else if (c === "weapon") out.weapons.push(x);
    else if (c === "accessory") out.accessories.push(x);
    else if (c === "enemy") out.enemies.push(x);
    else if (c === "boss") out.bosses.push(x);
    else out.unknown.push(x);
  }
  return out;
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it.id) continue;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function main() {
  if (!fs.existsSync(IN_ITEMS)) throw new Error(`Missing ${IN_ITEMS}. Run scrape_toolbox_items_from_ws first.`);

  const raw = JSON.parse(fs.readFileSync(IN_ITEMS, "utf8"));
  const arr = Array.isArray(raw.items) ? raw.items : [];

  if (arr.length < 50) throw new Error(`toolbox.items.json too small: ${arr.length}`);

  // Normalize very defensively (toolbox schema may vary)
  const normalized = dedupe(
    arr.map((it) => {
      const name = norm(it.name || it.Name || it.title || it.Title || it.label);
      const image = absImg(it.image || it.Image || it.imageUrl || it.Icon || it.icon);

      return {
        id: makeId(it),
        name,
        category: catFromAny({ ...it, image }),
        element: norm(it.element || it.Element) || null,
        image,
        url: it.url || it.Url || null,
        cost: toNum(it.cost || it.Cost),
        atk: toNum(it.atk || it.ATK || it.Attack),
        hp: toNum(it.hp || it.HP || it.Health),
        spd: toNum(it.spd || it.SPD || it.Speed),
        leaderSkill: norm(it.leaderSkill || it.LeaderSkill) || null
      };
    }).filter(x => x.id && x.name)
  );

  const buckets = split(normalized);

  const out = {
    generatedAt: new Date().toISOString(),
    sourceFiles: ["data/toolbox.items.json"],
    counts: {
      total: normalized.length,
      characters: buckets.characters.length,
      weapons: buckets.weapons.length,
      accessories: buckets.accessories.length,
      enemies: buckets.enemies.length,
      bosses: buckets.bosses.length,
      unknown: buckets.unknown.length
    },
    ...buckets
  };

  fs.writeFileSync(OUT_CLEAN, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${OUT_CLEAN} counts=${JSON.stringify(out.counts)}`);

  if (out.counts.characters === 0) {
    console.log("WARNING: 0 characters detected. This means the extracted dataset did not include unit images/fields.");
  }
}

main();