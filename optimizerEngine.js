/* optimizerEngine.js — Uses derivedTags from characters.json
   Presets use derived tags + auto-preset selection.
   Exposes: window.OptimizerEngine.run(ownedUnits, options)
*/

(function () {
  "use strict";

  const normId = (v) => (v == null || v === "" ? "" : String(v));
  const lc = (s) => String(s || "").trim().toLowerCase();

  // ---------- DOCTRINE MERGE ----------
  function structuredCloneSafe(obj) {
    try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj || {})); }
  }
  function deepMerge(target, src) {
    if (!src || typeof src !== "object") return target;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      if (sv && typeof sv === "object" && !Array.isArray(sv)) {
        if (!target[k] || typeof target[k] !== "object" || Array.isArray(target[k])) target[k] = {};
        deepMerge(target[k], sv);
      } else {
        target[k] = sv;
      }
    }
    return target;
  }
  function getDoctrineMerged(options) {
    const baseWrap = window.OPTIMIZER_DOCTRINE || {};
    const base = baseWrap.OPTIMIZER_DOCTRINE || baseWrap || {};
    const overrides = (options && options.doctrineOverrides) ? options.doctrineOverrides : {};
    return deepMerge(structuredCloneSafe(base), overrides);
  }

  // ---------- TAGS ----------
  // Prefer derivedTags from characters.json. Fall back to unit.tags if present.
  function getUnitTags(u) {
    const dt = Array.isArray(u.derivedTags) ? u.derivedTags : null;
    if (dt && dt.length) return new Set(dt.map(String));
    const t = Array.isArray(u.tags) ? u.tags : null;
    if (t && t.length) return new Set(t.map(String));
    return new Set();
  }

  // Preset definitions based on your derivedTags schema
  // "include" = qualifies strongly for preset
  // "soft" = extra helpful tags for tie-break / scoring
  // "exclude" = hurts the preset (negative/conditional interactions)
  const PRESET_DEFS = {
    burn: {
      include: ["burn_apply", "burn_synergy", "frostburn_apply", "burn_tier_healing", "burn_tier_mega_healing"],
      soft: ["status_spread", "infect", "tu_manip", "purify", "ward_burn"],
      exclude: ["burn_anti"]
    },
    poison: {
      include: ["poison_apply", "poison_synergy", "poison_tier_lethal", "poison_tier_mega", "poison_tier_super"],
      soft: ["status_spread", "infect", "tu_manip", "purify", "ward_poison"],
      exclude: ["poison_anti"]
    },
    sleep: {
      include: ["sleep_apply", "sleep_synergy", "frostburn_apply"],
      soft: ["tu_manip", "ward_sleep", "purify"],
      exclude: ["sleep_anti"]
    },
    stun: {
      include: ["stun_apply", "stun_synergy"],
      soft: ["tu_manip", "ward_stun", "purify"],
      exclude: ["stun_anti"]
    },

    // Non-status presets (mapped to derived tags you currently generate)
    heal: {
      include: ["heal", "revive", "purify"],
      soft: ["damage_reduction"],
      exclude: []
    },
    turn: {
      include: ["tu_manip"],
      soft: ["sleep_apply", "stun_apply"],
      exclude: []
    },
    cleanse: {
      include: ["purify"],
      soft: ["ward_burn", "ward_poison", "ward_sleep", "ward_stun"],
      exclude: []
    },

    // If you later add explicit atkBuff/hpBuff tags, plug them here.
    // For now, hpBuff maps to damage_reduction; atkBuff has no strong derived tag yet.
    hpBuff: {
      include: ["damage_reduction"],
      soft: ["heal", "purify"],
      exclude: []
    },
    atkBuff: {
      include: [],   // no reliable derived tag yet
      soft: [],
      exclude: []
    }
  };

  const PRESET_KEYS = Object.keys(PRESET_DEFS);

  function anyTag(tags, list) {
    for (const t of list) if (tags.has(t)) return true;
    return false;
  }

  function scoreUnitForPreset(tags, presetKey) {
    const def = PRESET_DEFS[presetKey];
    if (!def) return 0;

    // strong include tags
    let score = 0;
    for (const t of def.include) if (tags.has(t)) score += 3;

    // soft support tags
    for (const t of def.soft) if (tags.has(t)) score += 1;

    // exclude tags
    for (const t of def.exclude) if (tags.has(t)) score -= 4;

    return score;
  }

  // Auto-preset selection: pick the preset with the most "strong support" in owned pool
  function chooseAutoPreset(units) {
    // If atkBuff has no signal, ignore it in auto
    const candidates = PRESET_KEYS.filter(k => k !== "atkBuff");

    let best = { key: "", score: -Infinity, strongCount: 0 };
    for (const key of candidates) {
      const def = PRESET_DEFS[key];
      let total = 0;
      let strong = 0;

      for (const u of units) {
        const tags = u.__opt.tags;
        const s = scoreUnitForPreset(tags, key);
        total += s;
        if (anyTag(tags, def.include)) strong += 1;
      }

      // Primary: strong count, then total score
      if (strong > best.strongCount || (strong === best.strongCount && total > best.score)) {
        best = { key, score: total, strongCount: strong };
      }
    }

    return best.key || "burn"; // fallback (arbitrary) if pool is empty
  }

  // ---------- STATS ----------
  function stats(u) {
    const s = u.stats || {};
    return {
      atk: +((s.atk ?? u.atk) || 0),
      hp: +((s.hp ?? u.hp) || 0),
      spd: +((s.spd ?? u.spd) || 0),
      cost: +((s.cost ?? u.cost) || 1),
    };
  }

  // ---------- ELEMENT HELPERS ----------
  function getElement(u) {
    // prefer derived element tags if present (elem_fire, etc.)
    if (u.__opt.tags) {
      for (const t of u.__opt.tags) {
        if (t.startsWith("elem_")) return t.slice(5);
      }
    }
    return lc(u.element);
  }

  function elementProfile(team) {
    const counts = new Map();
    for (const u of team) {
      const e = getElement(u) || "unknown";
      counts.set(e, (counts.get(e) || 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a,b)=>b[1]-a[1]);
    const top = sorted[0] || ["unknown", 0];
    return { distinct: counts.size, topCount: top[1], topElement: top[0] };
  }

  // ---------- SCORING ----------
  function unitBase(doctrine, u, options) {
    const w = doctrine.scoringModel?.baseStats || {};
    const { atk, hp, spd, cost } = stats(u);
    const eff = atk / Math.max(1, cost);

    let score =
      atk * (w.atkWeight ?? 0.42) +
      spd * (w.spdWeight ?? 0.28) +
      hp  * (w.hpWeight  ?? 0.20) +
      eff * (w.efficiencyAtkPerCostWeight ?? 0.10);

    // Preset-aware unit bonus: strongly prefer units that match preset include tags
    const presetKey = options?.presetKey || "";
    if (presetKey && PRESET_DEFS[presetKey]) {
      score += scoreUnitForPreset(u.__opt.tags, presetKey) * 1500;
    }

    return score;
  }

  function teamScore(doctrine, team, options) {
    const add = doctrine.scoringModel?.teamAdditives || {};
    const base = team.reduce((a,u)=>a + u.__opt.base, 0) / Math.max(1, team.length);

    // coverage: number of distinct "include tags" across the team for current preset
    const presetKey = options?.presetKey || "";
    let presetCohesion = 0;
    if (presetKey && PRESET_DEFS[presetKey]) {
      const def = PRESET_DEFS[presetKey];
      let strongCount = 0;
      let antiCount = 0;
      for (const u of team) {
        if (anyTag(u.__opt.tags, def.include)) strongCount++;
        if (anyTag(u.__opt.tags, def.exclude)) antiCount++;
      }
      // reward matching, penalize anti
      presetCohesion += strongCount * 1.2;
      presetCohesion -= antiCount * 2.5;
    }

    // mono/rainbow behavior
    const prof = elementProfile(team);
    const monoRatio = prof.topCount / Math.max(1, team.length);
    const selMode = doctrine.monoVsRainbow?.selectionMode || "auto";

    let elemScore = 0;
    if (selMode === "force_mono") {
      elemScore += (prof.distinct === 1) ? 5.0 : -9999; // HARD mono for the chosen element pool
    } else if (selMode === "force_rainbow") {
      const minDistinct = doctrine.monoVsRainbow?.rainbowThreshold?.storyDistinctElementsMin ?? 4;
      elemScore += (prof.distinct >= minDistinct) ? 2.5 : -4.0;
    } else {
      if (monoRatio >= 0.75) elemScore += 0.8;
      if (prof.distinct >= 4) elemScore += 0.6;
    }

    return (base / 5000) +
      (presetCohesion * (add.pairSynergyWeight ?? 0.35)) +
      (elemScore * (add.elementStrategyWeight ?? 0.4));
  }

  // ---------- SELECTION ----------
  function topCandidates(units, limit) {
    const sorted = [...units].sort((a,b)=>b.__opt.base - a.__opt.base);
    return sorted.slice(0, Math.min(limit, sorted.length));
  }

  // Beam story
  function buildStoryBeam(doctrine, pool, options) {
    const beamWidth = doctrine.optimizerSearch?.beamWidthStory ?? 120;
    const target = 8;

    let beam = [{ team: [], score: -Infinity }];

    for (let step = 0; step < target; step++) {
      const next = [];
      for (const b of beam) {
        for (const u of pool) {
          if (b.team.some(x => normId(x.id) === normId(u.id))) continue;
          const t = b.team.concat([u]);
          const s = teamScore(doctrine, t, options);
          next.push({ team: t, score: s });
        }
      }
      next.sort((a,b)=>b.score - a.score);
      beam = next.slice(0, beamWidth);
    }

    const best = beam[0]?.team || [];
    // Assign main/back: fast/control front; atk/support back (simple heuristic)
    const scored = best.map(u => {
      const st = stats(u);
      const tags = u.__opt.tags;
      const control = (tags.has("sleep_apply") || tags.has("stun_apply") || tags.has("tu_manip")) ? 1 : 0;
      const sustain = (tags.has("heal") || tags.has("revive") || tags.has("purify")) ? 1 : 0;

      const front = st.spd * 0.6 + control * 2000 + st.hp * 0.1;
      const back  = st.atk * 0.6 + sustain * 2000;

      return { u, front, back };
    });

    scored.sort((a,b)=>b.front - a.front);
    const main = scored.slice(0,5).map(x => normId(x.u.id));
    const rest = scored.slice(5);

    rest.sort((a,b)=>b.back - a.back);
    const back = rest.slice(0,3).map(x => normId(x.u.id));

    return { main, back, used: new Set(main.concat(back).filter(Boolean)) };
  }

  // HARD mono story: try each element pool and pick best mono result
  function buildStory(doctrine, units, options) {
    const poolSize = doctrine.optimizerSearch?.candidatePoolSize ?? 80;
    const presetKey = options.presetKey || "";

    if (doctrine.monoVsRainbow?.selectionMode === "force_mono") {
      const byElem = new Map();
      for (const u of units) {
        const e = getElement(u) || "unknown";
        if (!byElem.has(e)) byElem.set(e, []);
        byElem.get(e).push(u);
      }

      let best = null;

      for (const [elem, list] of byElem.entries()) {
        if (list.length < 8) continue;

        // preset hard: try to avoid anti tags by filtering, but fall back if too few
        let pool = topCandidates(list, poolSize);
        if (presetKey && PRESET_DEFS[presetKey]) {
          const def = PRESET_DEFS[presetKey];
          const filtered = pool.filter(u => !anyTag(u.__opt.tags, def.exclude));
          if (filtered.length >= 8) pool = filtered;
        }

        const story = buildStoryBeam(doctrine, pool, options);
        const teamObjs = list.filter(u => story.used.has(normId(u.id)));
        const score = teamScore(doctrine, teamObjs, options);
        if (!best || score > best.score) best = { elem, story, score };
      }

      // If no element can fill 8, fall back to normal (best possible)
      if (best) return best.story;
    }

    // Non-mono: base pool from top candidates
    let pool = topCandidates(units, poolSize);

    // Preset hard behavior:
    // Prefer units that match preset includes; avoid excludes if possible
    if (presetKey && PRESET_DEFS[presetKey]) {
      const def = PRESET_DEFS[presetKey];

      const positives = pool.filter(u => anyTag(u.__opt.tags, def.include));
      const safePositives = positives.filter(u => !anyTag(u.__opt.tags, def.exclude));

      // If enough safe preset units to build 8, restrict to them
      if (safePositives.length >= 8) pool = safePositives;
      else if (positives.length >= 8) pool = positives;
      // else leave pool alone (not enough preset units)
    }

    return buildStoryBeam(doctrine, pool, options);
  }

  // Greedy platoons: also respects preset include/exclude when possible
  function buildPlatoons(doctrine, units, used, options) {
    const presetKey = options.presetKey || "";
    const def = presetKey ? PRESET_DEFS[presetKey] : null;

    const remaining = units.filter(u => !used.has(normId(u.id)));
    const poolAll = topCandidates(remaining, Math.max(remaining.length, 200));

    const platoons = [];
    const consumed = new Set([...used]);

    for (let p = 0; p < 20; p++) {
      const team = [];

      // try to fill with preset include tags first
      if (def) {
        const candidates = poolAll
          .filter(u => !consumed.has(normId(u.id)))
          .filter(u => anyTag(u.__opt.tags, def.include));

        const safe = candidates.filter(u => !anyTag(u.__opt.tags, def.exclude));
        const takeFrom = safe.length ? safe : candidates;

        for (const u of takeFrom) {
          if (team.length >= 5) break;
          team.push(u);
          consumed.add(normId(u.id));
        }
      }

      // fill remaining slots with best base
      for (const u of poolAll) {
        if (team.length >= 5) break;
        if (consumed.has(normId(u.id))) continue;
        team.push(u);
        consumed.add(normId(u.id));
      }

      platoons.push({ units: team.map(u => normId(u.id)) });
    }

    return platoons;
  }

  // ---------- RUN ----------
  function run(ownedUnits, options) {
    const doctrine = getDoctrineMerged(options || {});
    const opts = options || {};

    // Build unit views with tags + base score
    const units = (ownedUnits || []).map(u => {
      const clone = Object.assign({}, u);
      clone.id = normId(u.id);
      clone.__opt = { tags: getUnitTags(u) }; // derivedTags preferred
      // Resolve presetKey:
      // - If presetTag passed (burn/poison/sleep/etc): use it
      // - If presetTag empty and presetMode = "auto": choose automatically
      return clone;
    });

    // Determine presetKey for this run
    let presetKey = lc(opts.presetTag || "");
    const presetMode = lc(opts.presetMode || "off");

    if (!presetKey && presetMode === "auto") {
      // compute using tag sets
      // Need tags available, already set above
      presetKey = chooseAutoPreset(units);
    }

    // If presetKey not recognized, disable preset behavior
    if (presetKey && !PRESET_DEFS[presetKey]) presetKey = "";

    // attach to options used in scoring
    const runOptions = Object.assign({}, opts, { presetKey });

    // compute base scores
    for (const u of units) {
      u.__opt.base = unitBase(doctrine, u, runOptions);
    }

    if (units.length === 0) return { story: { main: [], back: [] }, platoons: [] };

    const story = buildStory(doctrine, units, runOptions);
    const platoons = buildPlatoons(doctrine, units, story.used, runOptions);

    return { story: { main: story.main, back: story.back }, platoons };
  }

  window.OptimizerEngine = { run };
})();