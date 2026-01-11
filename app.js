const DATA = {
  characters: "./data/characters.json",
  weapons: "./data/weapons.json",
  accessories: "./data/accessories.json",
  enemies: "./data/enemies.json",
  bosses: "./data/bosses.json",
};

// If your JSON images look like "/files/images/....png",
// GitHub Pages will try to load them from your domain.
// This prefixes the toolbox host so images resolve.
const TOOLBOX_HOST = "https://evertaletoolbox2.runasp.net";

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

function unwrapItems(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  return [];
}

function normalizeImage(image) {
  if (!image) return null;
  if (typeof image !== "string") return null;
  // Full URL already
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  // Toolbox-relative
  if (image.startsWith("/files/")) return TOOLBOX_HOST + image;
  return image;
}

function normalizeItem(raw, forcedCategory) {
  const category = (forcedCategory || raw.category || raw.type || "unknown").toString().toLowerCase().trim();
  const id = (raw.id ?? raw.key ?? raw.slug ?? raw.name ?? "").toString().trim();
  const name = (raw.name ?? raw.title ?? raw.displayName ?? raw.id ?? "").toString().trim();

  return {
    id,
    name,
    category,
    element: raw.element ?? null,
    cost: raw.cost ?? null,
    atk: raw.atk ?? null,
    hp: raw.hp ?? null,
    spd: raw.spd ?? null,
    image: normalizeImage(raw.image ?? raw.imageUrl ?? raw.icon ?? null),
    url: raw.url ?? null,
    raw,
  };
}

async function loadSplitData() {
  const [c,w,a,e,b] = await Promise.all([
    fetchJson(DATA.characters),
    fetchJson(DATA.weapons),
    fetchJson(DATA.accessories),
    fetchJson(DATA.enemies),
    fetchJson(DATA.bosses),
  ]);

  const characters = unwrapItems(c).map(x => normalizeItem(x, "character"));
  const weapons    = unwrapItems(w).map(x => normalizeItem(x, "weapon"));
  const accessories= unwrapItems(a).map(x => normalizeItem(x, "accessory"));
  const enemies    = unwrapItems(e).map(x => normalizeItem(x, "enemy"));
  const bosses     = unwrapItems(b).map(x => normalizeItem(x, "boss"));

  return [...characters, ...weapons, ...accessories, ...enemies, ...bosses]
    .filter(x => x.id && x.name);
}