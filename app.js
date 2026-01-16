/* app.js — FULL FILE (ROSTER + FILTERS + OWNED + OPTIMIZER TAB)
   - Loads ./data/characters.json (array OR {characters:[...]})
   - Always renders leader skill block (never "hidden")
   - Handles invalid JSON with a clear on-page error
   - Encodes image URLs safely (fixes “string did not match expected pattern”)
   - Builds Element + Rarity dropdowns from data
   - Persists Owned checkboxes in localStorage
*/

(() => {
  "use strict";

  /* =======================
     CONFIG (paths + storage)
  ======================= */
  const DATA_CHARACTERS = "./data/characters.json";
  const LS_OWNED_KEY = "evertale_owned_units_v1";

  /* =======================
     STATE
  ======================= */
  const state = {
    units: [],
    owned: new Set(),
    filters: {
      q: "",
      element: "all",
      rarity: "all",
      ownedOnly: false,
    },
  };

  /* =======================
     DOM helpers
  ======================= */
  const $ = (sel) => document.querySelector(sel);

  function safeText(v, fallback = "") {
    return v == null ? fallback : String(v);
  }

  function normLower(s) {
    return safeText(s, "").toLowerCase();
  }

  // Fixes: “The string did not match the expected pattern.”
  // Some image URLs contain spaces or characters that must be encoded.
  function safeUrl(u) {
    const raw = safeText(u, "").trim();
    if (!raw) return "";
    try {
      return encodeURI(raw);
    } catch {
      return raw;
    }
  }

  function splitPrimarySecondary(name, secondaryName) {
    const sec = safeText(secondaryName, "").trim();
    if (sec) return { primary: safeText(name, ""), secondary: sec };

    const n = safeText(name, "").trim();
    const parts = n.split(" ").filter(Boolean);
    if (parts.length >= 3) {
      return { primary: parts[0], secondary: parts.slice(1).join(" ") };
    }
    return { primary: n, secondary: "" };
  }

  /* =======================
     LocalStorage (Owned)
  ======================= */
  function loadOwned() {
    try {
      const arr = JSON.parse(localStorage.getItem(LS_OWNED_KEY) || "[]");
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }

  function saveOwned() {
    try {
      localStorage.setItem(LS_OWNED_KEY, JSON.stringify([...state.owned]));
    } catch {
      // ignore
    }
  }

  /* =======================
     Data loading
  ======================= */
  async function fetchJsonRobust(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} while fetching ${url}`);
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      throw new Error(`JSON.parse failed for ${url}: ${msg}`);
    }
  }

  function coerceCharacterArray(json) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.characters)) return json.characters;
    throw new Error("characters.json is not an array (expected [] or {characters: []}).");
  }

  function normalizeUnit(u) {
    const id = safeText(u.id, u.handle || u.slug || u.name || "");
    const { primary, secondary } = splitPrimarySecondary(u.name, u.secondaryName || u.title);

    const leaderObj = u.leaderSkill || {};
    const leaderName =
      leaderObj && leaderObj.name != null ? safeText(leaderObj.name) : safeText(u.leaderSkillName);
    const leaderDesc =
      leaderObj && leaderObj.description != null
        ? safeText(leaderObj.description)
        : safeText(u.leaderSkillDescription);

    return {
      id,
      name: primary,
      secondaryName: secondary,

      rarity: safeText(u.rarity, ""),
      element: safeText(u.element, ""),

      atk: u.atk ?? u.attack ?? u.baseAttack ?? u.BaseAttack ?? u.BaseAtk ?? null,
      hp: u.hp ?? u.health ?? u.baseHP ?? u.BaseHP ?? null,
      spd: u.spd ?? u.speed ?? u.Speed ?? null,
      cost: u.cost ?? u.Cost ?? null,

      image: safeUrl(u.image || u.icon || u.imageUrl || u.portrait || ""),

      leaderSkill: {
        name: leaderName,
        description: leaderDesc,
      },
    };
  }

  async function loadCharacters() {
    const raw = await fetchJsonRobust(DATA_CHARACTERS);
    const arr = coerceCharacterArray(raw);
    return arr.map(normalizeUnit);
  }

  /* =======================
     Rendering: Unit Card (LOCKED)
  ======================= */
  function renderUnitCard(unit) {
    const leaderName =
      unit.leaderSkill?.name && unit.leaderSkill.name !== "None"
        ? unit.leaderSkill.name
        : "No Leader Skill";

    const leaderDesc =
      unit.leaderSkill?.description && unit.leaderSkill.description !== "None"
        ? unit.leaderSkill.description
        : "This unit does not provide a leader skill.";

    const imgHtml = unit.image
      ? `<img src="${unit.image}" alt="${unit.name}" loading="lazy">`
      : `<div class="ph">?</div>`;

    const atk = unit.atk ?? "-";
    const hp = unit.hp ?? "-";
    const spd = unit.spd ?? "-";
    const cost = unit.cost ?? "-";

    return `
      <article class="unitCard">
        <div class="unitThumb">
          ${imgHtml}
        </div>

        <div class="meta">
          <div class="topRow">
            <div>
              <div class="unitName">${safeText(unit.name)}</div>
              <div class="unitTitle">${safeText(unit.secondaryName)}</div>
            </div>
            <div class="tags">
              <span class="tag rarity">${safeText(unit.rarity)}</span>
              <span class="tag element">${safeText(unit.element)}</span>
            </div>
          </div>

          <div class="statLine">
            <span class="stat"><strong>ATK</strong> ${atk}</span>
            <span class="stat"><strong>HP</strong> ${hp}</span>
            <span class="stat"><strong>SPD</strong> ${spd}</span>
            <span class="stat"><strong>COST</strong> ${cost}</span>
          </div>

          <!-- LEADER SKILL (ALWAYS VISIBLE) -->
          <div class="leaderBlock">
            <div class="leaderName">Leader skill: ${leaderName}</div>
            <div class="leaderText">${leaderDesc}</div>
          </div>

          <label class="ownedRow">
            <input type="checkbox" class="ownedCheck" data-unit-id="${safeText(unit.id)}">
            <span class="ownedLabel">Owned</span>
          </label>
        </div>
      </article>
    `;
  }

  /* =======================
     Filters + Roster render
  ======================= */
  function applyFilters(list) {
    const q = normLower(state.filters.q);
    const elem = state.filters.element;
    const rar = state.filters.rarity;
    const ownedOnly = !!state.filters.ownedOnly;

    return list.filter((u) => {
      const id = safeText(u.id);

      if (ownedOnly && !state.owned.has(id)) return false;
      if (elem !== "all" && safeText(u.element) !== elem) return false;
      if (rar !== "all" && safeText(u.rarity) !== rar) return false;

      if (q) {
        const hay = normLower(
          `${u.name} ${u.secondaryName} ${u.element} ${u.rarity} ${u.leaderSkill?.name}`
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderRoster() {
    const grid = $("#unitGrid");
    if (!grid) return;

    const filtered = applyFilters(state.units);

    grid.innerHTML = filtered.map(renderUnitCard).join("");

    // Wire Owned checkboxes after render
    grid.querySelectorAll('input.ownedCheck[data-unit-id]').forEach((cb) => {
      const id = cb.getAttribute("data-unit-id") || "";
      cb.checked = state.owned.has(id);

      cb.addEventListener("change", () => {
        if (cb.checked) state.owned.add(id);
        else state.owned.delete(id);

        saveOwned();

        // If Owned-only is enabled, re-render so unchecked cards disappear immediately
        if (state.filters.ownedOnly) renderRoster();
      });
    });

    const status = $("#statusText");
    if (status) {
      status.textContent = `${filtered.length} shown • ${state.units.length} total • ${state.owned.size} owned`;
    }
  }

  /* =======================
     Dropdown population
  ======================= */
  function fillSelect(selectEl, values, allLabel) {
    if (!selectEl) return;
    const current = selectEl.value || "all";
    selectEl.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = allLabel;
    selectEl.appendChild(optAll);

    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });

    selectEl.value = values.includes(current) ? current : "all";
  }

  function rebuildFilterOptions() {
    const elements = [...new Set(state.units.map((u) => safeText(u.element)).filter(Boolean))].sort();

    const rarities = [...new Set(state.units.map((u) => safeText(u.rarity)).filter(Boolean))].sort(
      (a, b) => {
        const order = { N: 0, R: 1, SR: 2, SSR: 3 };
        return (order[a] ?? 99) - (order[b] ?? 99);
      }
    );

    fillSelect($("#elementSelect"), elements, "All elements");
    fillSelect($("#raritySelect"), rarities, "All rarities");
  }

  /* =======================
     Controls wiring
  ======================= */
  function wireControls() {
    const search = $("#searchInput");
    if (search) {
      search.addEventListener("input", (e) => {
        state.filters.q = e.target.value || "";
        renderRoster();
      });
    }

    const elSel = $("#elementSelect");
    if (elSel) {
      elSel.addEventListener("change", (e) => {
        state.filters.element = e.target.value || "all";
        renderRoster();
      });
    }

    const rSel = $("#raritySelect");
    if (rSel) {
      rSel.addEventListener("change", (e) => {
        state.filters.rarity = e.target.value || "all";
        renderRoster();
      });
    }

    const ownedOnly = $("#ownedOnly");
    if (ownedOnly) {
      ownedOnly.addEventListener("change", (e) => {
        state.filters.ownedOnly = !!e.target.checked;
        renderRoster();
      });
    }
  }

  /* =======================
     Tabs (Roster / Optimizer)
  ======================= */
  function showTab(which) {
    const pageRoster = $("#pageRoster") || $("#tab-roster");
    const pageOptimizer = $("#pageOptimizer") || $("#tab-optimizer");

    const btnRoster = $("#btnRoster") || $("#tabRoster");
    const btnOptim = $("#btnOptimizer") || $("#tabOptimizer");

    if (pageRoster && pageOptimizer) {
      if (which === "optimizer") {
        pageRoster.classList.add("hidden");
        pageOptimizer.classList.remove("hidden");
      } else {
        pageOptimizer.classList.add("hidden");
        pageRoster.classList.remove("hidden");
      }
    }

    if (btnRoster && btnOptim) {
      if (which === "optimizer") {
        btnRoster.classList.remove("active");
        btnOptim.classList.add("active");
      } else {
        btnOptim.classList.remove("active");
        btnRoster.classList.add("active");
      }
    }
  }

  function wireTabs() {
    const btnRoster = $("#btnRoster") || $("#tabRoster");
    const btnOptim = $("#btnOptimizer") || $("#tabOptimizer");

    if (btnRoster) btnRoster.addEventListener("click", () => showTab("roster"));
    if (btnOptim) btnOptim.addEventListener("click", () => showTab("optimizer"));
  }

  /* =======================
     Init
  ======================= */
  async function init() {
    state.owned = loadOwned();

    wireControls();
    wireTabs();

    try {
      state.units = await loadCharacters();
      rebuildFilterOptions();
      renderRoster();
      showTab("roster");
    } catch (err) {
      console.error(err);
      const grid = $("#unitGrid");
      if (grid) {
        grid.innerHTML = "";
        const msg = err && err.message ? err.message : String(err);
        grid.textContent = `ERROR: ${msg}`;
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();