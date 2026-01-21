/* =========================================================
   optimizer.js — OWNED SYNC + TAB-OPEN REFRESH (DROP-IN)
   =========================================================
   Goal:
   - Optimizer always reflects owned units stored in:
       localStorage["evertale_owned_units_v1"]
   - Works whether optimizer is on optimizer.html OR a tab/section
   - Safe: no data mutation, no assumptions about HTML beyond
     optional element IDs/classes (it will no-op gracefully)
   --------------------------------------------------------- */

/* ---------- Storage keys (must match roster/app.js) ---------- */
const OWNED_KEY = "evertale_owned_units_v1";
const LAYOUT_KEY = "evertale_team_layout_v1";

/* ---------- Team format constants (locked) ---------- */
const STORY_MAIN = 5;
const STORY_BACK = 3;
const PLATOON_COUNT = 20;
const PLATOON_SIZE = 5;

/* ---------- Globals used by optimizer rendering ---------- */
window.__allCharacters = window.__allCharacters || [];
window.__optimizerOwnedUnits = window.__optimizerOwnedUnits || [];

/* =========================================================
   1) SAFE HELPERS
   ========================================================= */
function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getOwnedIdsArray() {
  const raw = localStorage.getItem(OWNED_KEY);
  const arr = safeJsonParse(raw || "[]", []);
  return Array.isArray(arr) ? arr : [];
}

function getOwnedIdsSet() {
  return new Set(getOwnedIdsArray());
}

/* =========================================================
   2) LOAD CHARACTERS (supports both shapes)
   - If your optimizer.js already has a loader, keep yours.
   - This is safe to use as a complete loader.
   ========================================================= */
async function loadCharactersForOptimizer() {
  // If already loaded, reuse
  if (Array.isArray(window.__allCharacters) && window.__allCharacters.length) {
    return window.__allCharacters;
  }

  const res = await fetch("./data/characters.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load characters.json (${res.status})`);
  const data = await res.json();

  const characters = Array.isArray(data) ? data : (data && Array.isArray(data.characters) ? data.characters : []);
  window.__allCharacters = characters;
  return characters;
}

/* =========================================================
   3) OWNED REFRESH — THIS IS THE “TRANSLATION” FIX
   Call this whenever:
   - user switches to Optimizer tab
   - page loads optimizer.html
   ========================================================= */
function refreshOptimizerFromOwned() {
  const ownedIds = getOwnedIdsSet();

  // Update owned count label if present
  // Supports either #ownedCount or [data-owned-count]
  const ownedCountEl =
    document.getElementById("ownedCount") ||
    document.querySelector("[data-owned-count]");

  if (ownedCountEl) {
    ownedCountEl.textContent = `${ownedIds.size} selected`;
  }

  // Build owned units array for optimizer use
  const all = Array.isArray(window.__allCharacters) ? window.__allCharacters : [];
  window.__optimizerOwnedUnits = all.filter(u => ownedIds.has(u.id));

  // If your optimizer rendering functions exist, rerun them
  if (typeof window.renderStory === "function") window.renderStory();
  if (typeof window.renderPlatoons === "function") window.renderPlatoons();

  // If you have a function that rebuilds dropdown options, call it too
  if (typeof window.rebuildAllSelectOptions === "function") window.rebuildAllSelectOptions();
}

/* =========================================================
   4) OPTIONAL: AUTO-HOOK WHEN OPTIMIZER SECTION BECOMES VISIBLE
   If you have a tabbed single-page index.html, and the optimizer
   is a section that is hidden/shown, this observer auto-refreshes
   when it becomes visible.
   - It looks for an element with id="optimizerSection" OR
     any element with [data-optimizer-root]
   ========================================================= */
function installOptimizerVisibilityObserver() {
  const root =
    document.getElementById("optimizerSection") ||
    document.querySelector("[data-optimizer-root]");

  if (!root) return;

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  let lastVisible = isVisible(root);

  const obs = new MutationObserver(() => {
    const nowVisible = isVisible(root);
    if (nowVisible && !lastVisible) {
      refreshOptimizerFromOwned();
    }
    lastVisible = nowVisible;
  });

  obs.observe(root, { attributes: true, attributeFilter: ["class", "style", "hidden"] });
}

/* =========================================================
   5) INIT
   - Runs on both optimizer.html and index.html (if loaded)
   ========================================================= */
async function initOptimizerOwnedSync() {
  await loadCharactersForOptimizer();
  refreshOptimizerFromOwned();
  installOptimizerVisibilityObserver();
}

document.addEventListener("DOMContentLoaded", () => {
  // Do not throw if optimizer DOM isn't present — just sync owned arrays
  initOptimizerOwnedSync().catch((err) => console.error("[optimizer] init failed:", err));
});

/* =========================================================
   END of OWNED SYNC DROP-IN
   ========================================================= */