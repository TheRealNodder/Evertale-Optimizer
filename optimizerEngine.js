/* optimizerEngine.js — Presets from derivedTags + Auto preset + Locked Leader inclusion
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
  function getUnitTags(u) {
    const dt = Array.isArray(u.derivedTags) ? u.derivedTags : null;
    if (dt && dt.length) return new Set(dt.map(String));
    const t = Array.isArray(u.tags) ? u.tags : null;
    if (t && t.length) return new Set(t.map(String));
    return new Set();
  }

  const PRESET_DEFS = {
    burn: {
      include: ["burn_apply","burn_synergy","frostburn_apply","burn_tier_healing","burn_tier_mega_healing"],
      soft: ["status_spread","infect","tu_manip","purify","ward_burn"],
      exclude: ["burn_anti"]
    },
    poison: {
      include: ["poison_apply","poison_synergy","poison_tier_lethal","poison_tier_mega","poison_tier_super"],
      soft: ["status_spread","infect","tu_manip","purify","ward_poison"],
      exclude: ["poison_anti"]
    },
    sleep: {
      include: ["sleep_apply","sleep_synergy","frostburn_apply"],
      soft: ["tu_manip","ward_sleep","purify"],
      exclude: ["sleep_anti"]
    },
    stun: {
      include: ["stun_apply","stun_synergy"],
      soft: ["tu_manip","ward_stun","purify"],
      exclude: ["stun_anti"]
    },
    heal: {
      include: ["heal","revive","purify"],
      soft: ["damage_reduction"],
      exclude: []
    },
    turn: {
      include: ["tu_manip"],
      soft: ["sleep_apply","stun_apply"],
      exclude: []
    },
    cleanse: {
      include: ["purify"],
      soft: ["ward_burn","ward_poison","ward_sleep","ward_stun"],
      exclude: []
    },
    hpBuff: {
      include: ["damage_reduction"],
      soft: ["heal","purify"],
      exclude: []
    },
    atkBuff: { include: [], soft: [], exclude: [] }
  };

  const PRESET_KEYS = Object.keys(PRESET_DEFS).filter(k => k !== "atkBuff");

  function anyTag(tags, list) {
    for (const t of list) if (tags.has(t)) return true;
    return false;
  }

  function scoreUnitForPreset(tags, presetKey) {
    const def = PRESET_DEFS[presetKey];
    if (!def) return 0;
    let score = 0;
    for (const t of def.include) if (tags.has(t)) score += 3;
    for (const t of def.soft) if (tags.has(t)) score += 1;
    for (const t of def.exclude) if (tags.has(t)) score -= 4;
    return score;
  }

  // Auto-preset: choose best supported plan; bias toward locked leader tags if present
  function chooseAutoPreset(units, lockedLeader) {
    let best = { key: "", strongCount: -1, total: -Infinity };
    for (const key of PRESET_KEYS) {
      const def = PRESET_DEFS[key];
      let strong = 0;
      let total = 0;

      for (const u of units) {
        const tags = u.__opt.tags;
        total += scoreUnitForPreset(tags, key);
        if (anyTag(tags, def.include)) strong += 1;
      }

      // bias: if locked leader supports this preset, add a big bump
      if (lockedLeader) {
        const lt = lockedLeader.__opt.tags;
        if (anyTag(lt, def.include)) {
          strong += 3;
          total += 25;
        }
        if (anyTag(lt, def.exclude)) {
          total -= 25;
        }
      }

      if (strong > best.strongCount || (strong === best.strongCount && total > best.total)) {
        best = { key, strongCount: strong, total };
      }
    }
    return best.key || "burn";
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

  // ---------- ELEMENT ----------
  function getElement(u) {
    if (u.__opt.tags) {
      for (const t of u.__opt.tags) if (t.startsWith("elem_")) return t.slice(5);
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

    const presetKey = options?.presetKey || "";
    if (presetKey && PRESET_DEFS[presetKey]) {
      score += scoreUnitForPreset(u.__opt.tags, presetKey) * 1500;
    }

    return score;
  }

  function teamScore(doctrine, team, options) {
    const add = doctrine.scoringModel?.teamAdditives || {};
    const base = team.reduce((a,u)=>a + u.__opt.base, 0) / Math.max(1, team.length);

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
      presetCohesion += strongCount * 1.2;
      presetCohesion -= antiCount * 2.5;
    }

    const prof = elementProfile(team);
    const selMode = doctrine.monoVsRainbow?.selectionMode || "auto";

    let elemScore = 0;
    if (selMode === "force_mono") {
      elemScore += (prof.distinct === 1) ? 5.0 : -9999;
    } else if (selMode === "force_rainbow") {
      const minDistinct = doctrine.monoVsRainbow?.rainbowThreshold?.storyDistinctElementsMin ?? 4;
      elemScore += (prof.distinct >= minDistinct) ? 2.5 : -4.0;
    } else {
      const monoRatio = prof.topCount / Math.max(1, team.length);
      if (monoRatio >= 0.75) elemScore += 0.8;
      if (prof.distinct >= 4) elemScore += 0.6;
    }

    return (base / 5000) +
      (presetCohesion * (add.pairSynergyWeight ?? 0.35)) +
      (elemScore * (add.elementStrategyWeight ?? 0.4));
  }

  function topCandidates(units, limit) {
    const sorted = [...units].sort((a,b)=>b.__opt.base - a.__opt.base);
    return sorted.slice(0, Math.min(limit, sorted.length));
  }

  // Beam search with optional forced-in units
  function buildStoryBeam(doctrine, pool, options, forcedUnits) {
    const beamWidth = doctrine.optimizerSearch?.beamWidthStory ?? 120;
    const target = 8;

    const forced = Array.isArray(forcedUnits) ? forcedUnits : [];
    const forcedIds = new Set(forced.map(u => normId(u.id)));
    const startTeam = forced.slice(0, target);

    let beam = [{ team: startTeam, score: teamScore(doctrine, startTeam, options) }];

    for (let step = startTeam.length; step < target; step++) {
      const next = [];
      for (const b of beam) {
        for (const u of pool) {
          const id = normId(u.id);
          if (b.team.some(x => normId(x.id) === id)) continue;
          // never add duplicates of forced
          if (forcedIds.has(id) && !b.team.some(x => normId(x.id) === id)) {
            // (already handled by duplicate check; kept for clarity)
          }
          const t = b.team.concat([u]);
          const s = teamScore(doctrine, t, options);
          next.push({ team: t, score: s });
        }
      }
      next.sort((a,b)=>b.score - a.score);
      beam = next.slice(0, beamWidth);
    }

    const best = beam[0]?.team || [];

    // Assign main/back
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

  function buildStory(doctrine, units, options, lockedLeader) {
    const poolSize = doctrine.optimizerSearch?.candidatePoolSize ?? 80;
    const presetKey = options.presetKey || "";
    const def = presetKey ? PRESET_DEFS[presetKey] : null;

    // force mono element to locked leader’s element when locked leader + force_mono
    const forceMono = doctrine.monoVsRainbow?.selectionMode === "force_mono";
    const lockedElem = lockedLeader ? getElement(lockedLeader) : "";

    // Base pool
    let basePool = topCandidates(units, poolSize);

    // If force mono + locked leader -> restrict to leader element if feasible
    if (forceMono && lockedLeader && lockedElem) {
      const monoPool = basePool.filter(u => getElement(u) === lockedElem);
      if (monoPool.length >= 8) basePool = monoPool;
    }

    // Preset hard filtering for non-locked picks:
    // Avoid exclude tags if possible, but never exclude the locked leader.
    if (def) {
      const positives = basePool.filter(u => anyTag(u.__opt.tags, def.include));
      const safePositives = positives.filter(u => !anyTag(u.__opt.tags, def.exclude));

      if (safePositives.length >= 8) basePool = safePositives;
      else if (positives.length >= 8) basePool = positives;
    }

    // If locked leader exists, force-in to beam start
    const forced = lockedLeader ? [lockedLeader] : [];
    // Ensure pool does not accidentally remove locked leader
    const pool = basePool;

    return buildStoryBeam(doctrine, pool, options, forced);
  }

  function buildPlatoons(doctrine, units, used, options) {
    const presetKey = options.presetKey || "";
    const def = presetKey ? PRESET_DEFS[presetKey] : null;

    const remaining = units.filter(u => !used.has(normId(u.id)));
    const poolAll = topCandidates(remaining, Math.max(remaining.length, 200));

    const platoons = [];
    const consumed = new Set([...used]);

    for (let p = 0; p < 20; p++) {
      const team = [];

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

  function run(ownedUnits, options) {
    const doctrine = getDoctrineMerged(options || {});
    const opts = options || {};

    const units = (ownedUnits || []).map(u => {
      const clone = Object.assign({}, u);
      clone.id = normId(u.id);
      clone.__opt = { tags: getUnitTags(u) };
      return clone;
    });

    // Locked leader resolve
    const lockedLeaderId = normId(opts.lockedLeaderId || "");
    const lockedLeader = lockedLeaderId ? units.find(u => normId(u.id) === lockedLeaderId) : null;

    // preset resolution
    let presetKey = lc(opts.presetTag || "");
    const presetMode = lc(opts.presetMode || "off");

    if (!presetKey && presetMode === "auto") {
      presetKey = chooseAutoPreset(units, lockedLeader);
    }
    if (presetKey && !PRESET_DEFS[presetKey]) presetKey = "";

    const runOptions = Object.assign({}, opts, { presetKey });

    // compute base scores
    for (const u of units) {
      u.__opt.base = unitBase(doctrine, u, runOptions);
    }

    if (units.length === 0) return { story: { main: [], back: [] }, platoons: [] };

    // Story: forced locked leader included (if present)
    const story = buildStory(doctrine, units, runOptions, lockedLeader);

    // Platoons: built from remaining (locked leader already consumed if in story)
    const platoons = buildPlatoons(doctrine, units, story.used, runOptions);

    return { story: { main: story.main, back: story.back }, platoons, presetKey };
  }

  window.OptimizerEngine = { run };
})();