/* optimizerEngine.js — derivedTags presets + slot locks + hard mono enforcement
   Exposes: window.OptimizerEngine.run(ownedUnits, options)
*/

(function () {
  "use strict";

  const normId = (v) => (v == null || v === "" ? "" : String(v));
  const lc = (s) => String(s || "").trim().toLowerCase();

  // ---------- DOCTRINE ----------
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
    burn:   { include:["burn_apply","burn_synergy","frostburn_apply","burn_tier_healing","burn_tier_mega_healing"], soft:["status_spread","infect","tu_manip","purify","ward_burn"], exclude:["burn_anti"] },
    poison: { include:["poison_apply","poison_synergy","poison_tier_lethal","poison_tier_mega","poison_tier_super"], soft:["status_spread","infect","tu_manip","purify","ward_poison"], exclude:["poison_anti"] },
    sleep:  { include:["sleep_apply","sleep_synergy","frostburn_apply"], soft:["tu_manip","ward_sleep","purify"], exclude:["sleep_anti"] },
    stun:   { include:["stun_apply","stun_synergy"], soft:["tu_manip","ward_stun","purify"], exclude:["stun_anti"] },
    heal:   { include:["heal","revive","purify"], soft:["damage_reduction"], exclude:[] },
    turn:   { include:["tu_manip"], soft:["sleep_apply","stun_apply"], exclude:[] },
    cleanse:{ include:["purify"], soft:["ward_burn","ward_poison","ward_sleep","ward_stun"], exclude:[] },
    hpBuff: { include:["damage_reduction"], soft:["heal","purify"], exclude:[] },
    atkBuff:{ include:[], soft:[], exclude:[] }
  };
  const PRESET_KEYS = Object.keys(PRESET_DEFS).filter(k => k !== "atkBuff");

  function anyTag(tags, list) { for (const t of list) if (tags.has(t)) return true; return false; }
  function scoreUnitForPreset(tags, presetKey) {
    const def = PRESET_DEFS[presetKey]; if (!def) return 0;
    let score = 0;
    for (const t of def.include) if (tags.has(t)) score += 3;
    for (const t of def.soft) if (tags.has(t)) score += 1;
    for (const t of def.exclude) if (tags.has(t)) score -= 4;
    return score;
  }

  function chooseAutoPreset(units, forcedUnits) {
    let best = { key: "", strong: -1, total: -Infinity };
    for (const key of PRESET_KEYS) {
      const def = PRESET_DEFS[key];
      let strong = 0, total = 0;
      for (const u of units) {
        total += scoreUnitForPreset(u.__opt.tags, key);
        if (anyTag(u.__opt.tags, def.include)) strong++;
      }
      // bias: if forced units support, boost; if forced is anti, reduce
      if (forcedUnits && forcedUnits.length) {
        for (const fu of forcedUnits) {
          if (anyTag(fu.__opt.tags, def.include)) { strong += 2; total += 20; }
          if (anyTag(fu.__opt.tags, def.exclude)) { total -= 20; }
        }
      }
      if (strong > best.strong || (strong === best.strong && total > best.total)) best = { key, strong, total };
    }
    return best.key || "burn";
  }

  // ---------- STATS ----------
  function stats(u) {
    const s = u.stats || {};
    return {
      atk: +((s.atk ?? u.atk) || 0),
      hp:  +((s.hp  ?? u.hp)  || 0),
      spd: +((s.spd ?? u.spd) || 0),
      cost:+((s.cost?? u.cost)|| 1),
    };
  }

  // ---------- ELEMENT ----------
  function getElement(u) {
    if (u.__opt && u.__opt.tags) {
      for (const t of u.__opt.tags) if (t.startsWith("elem_")) return t.slice(5);
    }
    return lc(u.element);
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
    if (presetKey && PRESET_DEFS[presetKey]) score += scoreUnitForPreset(u.__opt.tags, presetKey) * 1500;

    return score;
  }

  function teamScore(doctrine, team, options) {
    const add = doctrine.scoringModel?.teamAdditives || {};
    const base = team.reduce((a,u)=>a + u.__opt.base, 0) / Math.max(1, team.length);

    const presetKey = options?.presetKey || "";
    let presetCohesion = 0;
    if (presetKey && PRESET_DEFS[presetKey]) {
      const def = PRESET_DEFS[presetKey];
      let strong = 0, anti = 0;
      for (const u of team) {
        if (anyTag(u.__opt.tags, def.include)) strong++;
        if (anyTag(u.__opt.tags, def.exclude)) anti++;
      }
      presetCohesion += strong * 1.2;
      presetCohesion -= anti * 2.5;
    }

    return (base / 5000) + (presetCohesion * (add.pairSynergyWeight ?? 0.35));
  }

  function topCandidates(units, limit) {
    const sorted = [...units].sort((a,b)=>b.__opt.base - a.__opt.base);
    return sorted.slice(0, Math.min(limit, sorted.length));
  }

  // ---------- LOCK EXTRACTION ----------
  function forcedFromLocks(unitsById, layout, locks, sectionKey, maxSlots) {
    // sectionKey: "storyMain"|"storyBack"|`platoon_${p}`
    const forced = [];
    for (let i=0;i<maxSlots;i++) {
      let locked = false;
      let id = "";
      if (sectionKey === "storyMain") { locked = !!locks.storyMain[i]; id = normId(layout.storyMain[i] || ""); }
      else if (sectionKey === "storyBack") { locked = !!locks.storyBack[i]; id = normId(layout.storyBack[i] || ""); }
      else if (sectionKey.startsWith("platoon_")) {
        const p = parseInt(sectionKey.split("_")[1], 10);
        locked = !!locks.platoons[p][i];
        id = normId((layout.platoons[p] && layout.platoons[p][i]) || "");
      }
      if (locked && id && unitsById.has(id)) forced.push(unitsById.get(id));
    }
    return forced;
  }

  // ---------- HARD MONO ENFORCEMENT ----------
  function pickAnchorElementForTeam(forcedUnits, candidateUnits, neededCount) {
    // If forced exists, anchor = element of first forced
    if (forcedUnits && forcedUnits.length) return getElement(forcedUnits[0]) || "";

    // Else pick the element with most candidates available to fill neededCount
    const counts = new Map();
    for (const u of candidateUnits) {
      const e = getElement(u) || "";
      if (!e) continue;
      counts.set(e, (counts.get(e) || 0) + 1);
    }
    let bestElem = "";
    let bestCnt = -1;
    for (const [e,c] of counts.entries()) {
      if (c > bestCnt) { bestCnt = c; bestElem = e; }
    }
    // If best cannot fill, still return it (best possible mono)
    if (bestCnt >= neededCount) return bestElem;
    return bestElem;
  }

  // Beam-ish fill: forced first, then greedily fill from best candidates
  function buildTeamFixedSize(doctrine, pool, forcedUnits, size, options) {
    const forcedIds = new Set((forcedUnits||[]).map(u => normId(u.id)));
    const team = [...(forcedUnits || [])].slice(0, size);

    for (const u of pool) {
      if (team.length >= size) break;
      const id = normId(u.id);
      if (forcedIds.has(id)) continue;
      if (team.some(x => normId(x.id) === id)) continue;
      team.push(u);
    }

    // If still short, just return what we have
    return team;
  }

  function assignStoryMainBack(team8) {
    // heuristic: fast/control -> main, atk/sustain -> back
    const scored = team8.map(u => {
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
    return { main, back };
  }

  // ---------- BUILD STORY ----------
  function buildStory(doctrine, units, options, unitsById) {
    const poolSize = doctrine.optimizerSearch?.candidatePoolSize ?? 80;
    const presetKey = options.presetKey || "";
    const def = presetKey ? PRESET_DEFS[presetKey] : null;

    const layout = options.currentLayout || {};
    const locks = options.slotLocks || null;
    const forcedMain = locks ? forcedFromLocks(unitsById, layout, locks, "storyMain", 5) : [];
    const forcedBack = locks ? forcedFromLocks(unitsById, layout, locks, "storyBack", 3) : [];
    const forcedUnits = [...forcedMain, ...forcedBack];

    // preset resolution (auto can be biased by forced units)
    if (!options.presetKey && options.presetMode === "auto") {
      options.presetKey = chooseAutoPreset(units, forcedUnits);
    }

    // candidates (exclude forced duplicates)
    const forcedIds = new Set(forcedUnits.map(u => normId(u.id)));
    let pool = topCandidates(units.filter(u => !forcedIds.has(normId(u.id))), poolSize);

    // preset filtering for non-forced picks
    if (def) {
      const positives = pool.filter(u => anyTag(u.__opt.tags, def.include));
      const safePositives = positives.filter(u => !anyTag(u.__opt.tags, def.exclude));
      if (safePositives.length >= (8 - forcedUnits.length)) pool = safePositives;
      else if (positives.length >= (8 - forcedUnits.length)) pool = positives;
    }

    // mono enforcement (per team)
    const forceMono = doctrine.monoVsRainbow?.selectionMode === "force_mono";
    if (forceMono) {
      const anchor = pickAnchorElementForTeam(forcedUnits, pool, 8 - forcedUnits.length);
      if (anchor) {
        pool = pool.filter(u => getElement(u) === anchor);
      }
    }

    // Build 8
    const team8 = buildTeamFixedSize(doctrine, pool, forcedUnits, 8, options);

    // Assign main/back but keep locked placements later (optimizer.js applies only into unlocked slots)
    const ids = assignStoryMainBack(team8);
    const used = new Set([...ids.main, ...ids.back].filter(Boolean));
    return { main: ids.main, back: ids.back, used };
  }

  // ---------- BUILD PLATOONS ----------
  function buildPlatoons(doctrine, units, used, options, unitsById) {
    const presetKey = options.presetKey || "";
    const def = presetKey ? PRESET_DEFS[presetKey] : null;

    const layout = options.currentLayout || {};
    const locks = options.slotLocks || null;

    const consumed = new Set([...used].map(normId));
    const platoons = [];

    for (let p=0;p<20;p++) {
      const forced = locks ? forcedFromLocks(unitsById, layout, locks, `platoon_${p}`, 5) : [];
      const forcedIds = new Set(forced.map(u => normId(u.id)));

      // start from remaining (exclude consumed and forced)
      let candidates = units.filter(u => !consumed.has(normId(u.id)) && !forcedIds.has(normId(u.id)));
      // compute base pool
      candidates = topCandidates(candidates, Math.max(200, candidates.length));

      // preset filtering for non-forced picks
      if (def) {
        const positives = candidates.filter(u => anyTag(u.__opt.tags, def.include));
        const safe = positives.filter(u => !anyTag(u.__opt.tags, def.exclude));
        if (safe.length >= (5 - forced.length)) candidates = safe;
        else if (positives.length >= (5 - forced.length)) candidates = positives;
      }

      // mono enforcement per platoon
      const forceMono = doctrine.monoVsRainbow?.selectionMode === "force_mono";
      if (forceMono) {
        const anchor = pickAnchorElementForTeam(forced, candidates, 5 - forced.length);
        if (anchor) candidates = candidates.filter(u => getElement(u) === anchor);
      }

      const team = buildTeamFixedSize(doctrine, candidates, forced, 5, options);
      const ids = team.map(u => normId(u.id));

      // mark consumed
      for (const id of ids) if (id) consumed.add(id);

      platoons.push({ units: ids });
    }

    return platoons;
  }

  // ---------- RUN ----------
  function run(ownedUnits, options) {
    const doctrine = getDoctrineMerged(options || {});
    const opts = structuredCloneSafe(options || {});

    const units = (ownedUnits || []).map(u => {
      const clone = Object.assign({}, u);
      clone.id = normId(u.id);
      clone.__opt = { tags: getUnitTags(u) };
      return clone;
    });

    // preset key handling
    let presetKey = lc(opts.presetTag || "");
    const presetMode = lc(opts.presetMode || "off");
    if (presetKey && !PRESET_DEFS[presetKey]) presetKey = "";
    opts.presetKey = presetKey;
    opts.presetMode = presetMode;

    for (const u of units) u.__opt.base = unitBase(doctrine, u, opts);

    const unitsById = new Map(units.map(u => [normId(u.id), u]));

    const story = buildStory(doctrine, units, opts, unitsById);
    const platoons = buildPlatoons(doctrine, units, story.used, opts, unitsById);

    return { story: { main: story.main, back: story.back }, platoons, presetKey: opts.presetKey || "" };
  }

  window.OptimizerEngine = { run };
})();