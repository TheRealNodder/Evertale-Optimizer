// app.js (module) — clean catalog loader + UI

const DATA_URL = new URL("data/catalog.clean.json", document.baseURI).toString();

const $ = (sel) => document.querySelector(sel);

function showStatus(msg) {
  $("#status")?.classList.remove("hidden");
  $("#statusMsg").textContent = msg;
}

function hideStatus() {
  $("#status")?.classList.add("hidden");
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.json();
}

// Flatten the clean catalog into a single list for rendering
function flattenCatalog(cat) {
  const blocks = [
    ["character", cat.characters ?? []],
    ["weapon", cat.weapons ?? []],
    ["accessory", cat.accessories ?? []],
    ["enemy", cat.enemies ?? []],
    ["boss", cat.bosses ?? []],
    ["unknown", cat.unknown ?? []],
  ];

  const flat = [];
  for (const [category, arr] of blocks) {
    for (const it of arr) flat.push({ ...it, category: it.category ?? category });
  }
  return flat;
}

async function main() {
  try {
    showStatus("Loading catalog…");

    const cat = await fetchJson(DATA_URL);
    const flat = flattenCatalog(cat);

    // quick sanity info so you instantly know if chars are missing
    console.log("Catalog counts:", cat.counts);

    // TODO: render your UI using `flat`
    // (keep whatever render code you already have)

    hideStatus();
  } catch (e) {
    console.error(e);
    showStatus("ERROR loading data: " + (e?.message ?? String(e)));
  }
}

main();