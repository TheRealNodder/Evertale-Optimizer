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


  // Tag normalization / synonym expansion to improve passive melding.
  // Keeps canonical tags stable for scoring, while allowing multiple phrases to map to the same mechanic.
  function canonicalTag(raw) {
    const t = lc(raw);
    // keep only [a-z0-9_], normalize separators to "_"
    return t.replace(/[^a-z0-9]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  }

  // IMPORTANT: synonyms map to an existing canonical mechanic-tag.
  // Do not include broad substring matching here; keep it explicit to avoid accidental collisions
  // (e.g., burn_tier_healing should NOT become heal).
  const TAG_SYNONYMS = {
    // Healing / sustain
    healing: "heal",
    heal_over_time: "heal",
    regen: "heal",
    regeneration: "heal",
    lifesteal: "heal",
    life_steal: "heal",
    leech: "heal",
    vampiric: "heal",
    drain: "heal",

    // Cleanse / purification
    cleanse: "purify",
    cleansing: "purify",
    purge: "purify",
    purged: "purify",
    remove_debuffs: "purify",
    debuff_remove: "purify",
    debuff_removal: "purify",
    cleanse_team: "purify",
    cleanse_self: "purify",

    // Revive
    resurrect: "revive",
    resurrection: "revive",
    reanimate: "revive",
    bring_back: "revive",

    // Mitigation
    mitigate: "damage_reduction",
    mitigation: "damage_reduction",
    reduce_damage: "damage_reduction",
    damage_mitigation: "damage_reduction",
    toughness: "damage_reduction",
    resilient: "damage_reduction",
    resilience: "damage_reduction",
    fortified: "damage_reduction",
    hardened: "damage_reduction",

    // Barrier / shielding (new coverage key)
    shield: "barrier",
    shielding: "barrier",
    barrier: "barrier",
    ward: "barrier",
    protect_shield: "barrier",

    // Guard / cover (new coverage key)
    taunt: "guard",
    guarding: "guard",
    bodyguard: "guard",
    cover: "guard",
    protect: "guard",

    // Dispel (new coverage key)
    dispel: "dispel",
    strip: "dispel",
    strip_buffs: "dispel",
    remove_buffs: "dispel",
    buff_remove: "dispel",

    // Stealth / untargetable (new coverage key)
    stealth: "stealth",
    hidden: "stealth",
    hide: "stealth",
    invis: "stealth",
    invisible: "stealth",

    // Evasion (new coverage key)
    evasion: "evasion",
    dodge: "evasion",
    dodging: "evasion",
    avoid: "evasion",

    // Tempo manipulation
    haste: "tu_manip",
    quicken: "tu_manip",
    speed_up: "tu_manip",
    speedup: "tu_manip",
    reduce_tu: "tu_manip",
    tu_reduce: "tu_manip",
    tu_reduction: "tu_manip",
    extra_turn: "tu_manip",
    turn_gain: "tu_manip",
    turn_grant: "tu_manip",
    give_turn: "tu_manip",

    // Status engines (apply/payoff/anti) — allows alternate phrasing to map to your canonical tags.
    ignite_apply: "burn_apply",
    burning_apply: "burn_apply",
    fire_dot_apply: "burn_apply",
    burn_bonus: "burn_synergy",
    vs_burning: "burn_synergy",

    toxin_apply: "poison_apply",
    venom_apply: "poison_apply",
    poison_bonus: "poison_synergy",
    vs_poisoned: "poison_synergy",

    slumber_apply: "sleep_apply",
    sleep_bonus: "sleep_synergy",
    vs_sleeping: "sleep_synergy",

    shock_apply: "stun_apply",
    stun_bonus: "stun_synergy",
    vs_stunned: "stun_synergy",
  };

  // Converts unit tags into a canonical + expanded set used by the optimizer.
  function expandUnitTags(tagSet) {
    const out = new Set();
    for (const raw of (tagSet || [])) {
      const t = canonicalTag(raw);
      if (!t) continue;
      out.add(t);
      const syn = TAG_SYNONYMS[t];
      if (syn) out.add(syn);
    }
    return out;
  }

  function asArray(v) { return Array.isArray(v) ? v : []; }
  function pushTag(out, tag) { if (tag) out.add(canonicalTag(tag)); }
  function textBlobForUnit(u) {
    const parts = [];
    const add = (v) => { if (v != null && v !== "") parts.push(String(v)); };
    add(u.name); add(u.title); add(u.element); add(u.weaponPref); add(u.attackType); add(u.family); add(u.class);
    for (const skill of asArray(u.activeSkills)) {
      add(skill.name); add(skill.description); add(skill.targeting); add(skill.effect); add(skill.config);
      for (const f of asArray(skill.flags)) add(f);
      for (const c of asArray(skill.components)) add(c);
      const ai = skill.ai || {};
      if (ai.conditions) for (const k of Object.keys(ai.conditions)) add(k);
      if (ai.sourceConditions) for (const k of Object.keys(ai.sourceConditions)) add(k);
      for (const sc of asArray(ai.ignoreScalors)) add(sc);
    }
    for (const ps of asArray(u.passiveSkillDetails || u.passiveSkills)) {
      if (typeof ps === "string") add(ps);
      else { add(ps.name); add(ps.description); add(ps.internalId); }
    }
    return parts.join(" \n ").toLowerCase();
  }

  function deriveAITags(u) {
    const out = new Set();
    const blob = textBlobForUnit(u);
    const has = (re) => re.test(blob);

    if (has(/frostburn|burning|\bburn\b|isburning|burned/)) pushTag(out, "burn_apply");
    if (has(/sleeping|deep sleep|\bsleep\b|issleeping/)) pushTag(out, "sleep_apply");
    if (has(/poisoned|\bpoison\b|venom|toxin/)) pushTag(out, "poison_apply");
    if (has(/stunned|\bstun\b|shock|push back/)) pushTag(out, "stun_apply");

    if (has(/plus .*sleep|sleeping or frostburned|damage .*sleep|vs_sleep|issleeping|sleeping enemy|sleeping enemies/)) pushTag(out, "sleep_synergy");
    if (has(/plus .*burn|burning enemy|burning enemies|frostburned enemy|frostburned enemies|vs_burning|isburning/)) pushTag(out, "burn_synergy");
    if (has(/plus .*poison|poisoned enemy|poisoned enemies|vs_poison|ispoisoned/)) pushTag(out, "poison_synergy");
    if (has(/plus .*stun|stunned enemy|stunned enemies|vs_stunned|isstunned/)) pushTag(out, "stun_synergy");

    if (has(/heal|restor|recover|lifesteal|drain hp|regeneration/)) pushTag(out, "heal");
    if (has(/purif|cleanse|remove negative|remove debuff|negative status effects are removed/)) pushTag(out, "purify");
    if (has(/revive|resurrect|return.*battlefield/)) pushTag(out, "revive");
    if (has(/damage reduction|barrier|armor|shield|less damage|naval barrier/)) pushTag(out, "damage_reduction");
    if (has(/survive .*1\s*hp|hold ground|cannot be defeated|survives with 1 hp/)) pushTag(out, "hold_ground");
    if (has(/guardian|guardians|protecting|protector|protect allies|bodyguard/)) pushTag(out, "guard");
    if (has(/stealth|hidden|invisible/)) pushTag(out, "stealth");
    if (has(/counter stance|counterattack|counter attack/)) pushTag(out, "counter");
    if (has(/give.*next turn|next turns|reduce.*current tu|tu reduced|tu to 0|turn_grant|quicken|haste/)) pushTag(out, "tu_manip");
    if (has(/ally spirit|enemy spirit|spirit is|spirit to|gain.*spirit|spirit.*doubled/)) pushTag(out, "spirit_synergy");
    if (has(/gain.*spirit|allies gain.*spirit|raises ally spirit/)) pushTag(out, "spirit_gain");
    if (has(/charge|power charge|charges/)) pushTag(out, "charge");
    if (has(/immediately defeated|defeated without damage|instant death|execute/)) pushTag(out, "execute");
    if (has(/enrage|intense rage|attack increased to 1\.5|attack up/)) pushTag(out, "atk_buff");
    if (has(/weaken|attack reduced to 0\.75|attack down/)) pushTag(out, "weaken");
    if (has(/dispel|remove.*buff|remove positive|strip/)) pushTag(out, "dispel");

    if (has(/sleep ward|sleep immunity/)) pushTag(out, "ward_sleep");
    if (has(/stun ward|stun immunity/)) pushTag(out, "ward_stun");
    if (has(/poison ward|poison immunity/)) pushTag(out, "ward_poison");
    if (has(/burn ward|burn immunity|cannot be defeated by damage from burn/)) pushTag(out, "ward_burn");
    if (has(/instant death ward/)) pushTag(out, "ward_instant_death");

    let allEnemy = 0, multiEnemy = 0, allyTarget = 0, selfTarget = 0, finisher = 0, protectorBias = 0, lowHpBias = 0;
    for (const skill of asArray(u.activeSkills)) {
      const target = lc(skill.targeting || "");
      if (target.includes("allenem")) allEnemy++;
      if (target.includes("2enemy") || target.includes("twoenemy") || target.includes("allenem")) multiEnemy++;
      if (target.includes("ally") || target.includes("allally")) allyTarget++;
      if (target.includes("self")) selfTarget++;
      const ai = skill.ai || {};
      const cond = Object.assign({}, ai.conditions || {}, ai.sourceConditions || {});
      for (const k of Object.keys(cond)) {
        const ck = lc(k);
        if (ck.includes("1hp") || ck.includes("hpbelow25") || ck.includes("hpbelow50")) lowHpBias++;
        if (ck.includes("protect") || ck.includes("guardian")) protectorBias++;
        if (ck.includes("sleep") || ck.includes("frostburn")) pushTag(out, "ai_prioritizes_sleep_frostburn");
        if (ck.includes("burn")) pushTag(out, "ai_prioritizes_burn");
        if (ck.includes("poison")) pushTag(out, "ai_prioritizes_poison");
        if (ck.includes("stun")) pushTag(out, "ai_prioritizes_stun");
      }
      if (/immediately defeated|defeated without damage|10% or less|1 hp/i.test(String(skill.description || ""))) finisher++;
    }
    if (allEnemy) pushTag(out, "target_all_enemies");
    if (multiEnemy) pushTag(out, "target_multi_enemy");
    if (allyTarget) pushTag(out, "target_allies");
    if (selfTarget) pushTag(out, "target_self");
    if (finisher || lowHpBias) pushTag(out, "ai_finisher");
    if (protectorBias) pushTag(out, "ai_guardian_breaker");

    if (out.has("execute") || out.has("charge") || out.has("burn_synergy") || out.has("poison_synergy") || out.has("sleep_synergy") || out.has("stun_synergy")) pushTag(out, "role_dps");
    if (out.has("heal") || out.has("purify") || out.has("revive") || out.has("damage_reduction")) pushTag(out, "role_support");
    if (out.has("guard") || out.has("damage_reduction") || out.has("hold_ground")) pushTag(out, "role_tank");
    if (out.has("sleep_apply") || out.has("stun_apply") || out.has("tu_manip") || out.has("weaken") || out.has("dispel")) pushTag(out, "role_control");

    return out;
  }

  function mergeTagSets(...sets) {
    const out = new Set();
    for (const set of sets) for (const t of (set || [])) out.add(t);
    return expandUnitTags(out);
  }

  const ARCHETYPE_DEFS = {
    burn:   { include:["burn_apply","burn_synergy","frostburn_apply","burn_tier_healing","burn_tier_mega_healing"], soft:["status_spread","infect","tu_manip","purify","ward_burn"], exclude:["burn_anti"] },
    poison: { include:["poison_apply","poison_synergy","poison_payoff","poison_tier_lethal","poison_tier_mega","poison_tier_super"], soft:["status_spread","infect","tu_manip","purify","ward_poison","spirit_steal"], exclude:["poison_anti"] },
    sleep:  { include:["sleep_apply","sleep_synergy","frostburn_apply"], soft:["tu_manip","ward_sleep","purify"], exclude:["sleep_anti"] },
    stun:   { include:["stun_apply","stun_synergy"], soft:["tu_manip","ward_stun","purify"], exclude:["stun_anti"] },
    heal:   { include:["heal","revive","purify"], soft:["damage_reduction","ward_sleep","ward_stun","ward_poison","ward_burn"], exclude:[] },
    turn:   { include:["tu_manip","turn_grant"], soft:["sleep_apply","stun_apply","spirit_gain","spirit_control"], exclude:[] },
    cleanse:{ include:["purify"], soft:["heal","ward_burn","ward_poison","ward_sleep","ward_stun"], exclude:[] },
    defense:{ include:["damage_reduction","hold_ground","barrier","guard"], soft:["heal","purify","ward_sleep","ward_stun","ward_poison","ward_burn"], exclude:[] },
    stealth:{ include:["stealth","super_stealth","stealth_shield"], soft:["tu_manip","heal"], exclude:[] },
    spirit: { include:["spirit_gain","spirit_synergy","spirit_control"], soft:["turn_grant","tu_manip","heal"], exclude:[] },
    charge: { include:["charge"], soft:["execute","turn_grant","tu_manip","heal"], exclude:[] },
  };

  const PRESET_DEFS = {
    burn:   { include:["burn_apply","burn_synergy","frostburn_apply","burn_tier_healing","burn_tier_mega_healing"], soft:["status_spread","infect","tu_manip","purify","ward_burn"], exclude:["burn_anti"] },
    poison: { include:["poison_apply","poison_synergy","poison_tier_lethal","poison_tier_mega","poison_tier_super"], soft:["status_spread","infect","tu_manip","purify","ward_poison"], exclude:["poison_anti"] },
    sleep:  { include:["sleep_apply","sleep_synergy","frostburn_apply"], soft:["tu_manip","ward_sleep","purify"], exclude:["sleep_anti"] },
    stun:   { include:["stun_apply","stun_synergy"], soft:["tu_manip","ward_stun","purify"], exclude:["stun_anti"] },
    heal:   { include:["heal","revive","purify"], soft:["damage_reduction"], exclude:[] },
    turn:   { include:["tu_manip"], soft:["sleep_apply","stun_apply"], exclude:[] },
    cleanse:{ include:["purify"], soft:["ward_burn","ward_poison","ward_sleep","ward_stun"], exclude:[] },
    hpBuff: { include:["damage_reduction","hold_ground","guard"], soft:["heal","purify","barrier"], exclude:[] },
    atkBuff:{ include:["atk_buff"], soft:["charge","execute","tu_manip"], exclude:[] }
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

  function scoreUnitForArchetype(tags, archetypeKey) {
    const def = ARCHETYPE_DEFS[archetypeKey]; if (!def) return 0;
    let score = 0;
    for (const t of def.include) if (tags.has(t)) score += 3;
    for (const t of def.soft) if (tags.has(t)) score += 1;
    for (const t of def.exclude) if (tags.has(t)) score -= 4;
    return score;
  }

  function getArchetypeDefs(archetypes) {
    return (archetypes || []).map(k => ({ key:k, def:ARCHETYPE_DEFS[k] })).filter(x => !!x.def);
  }

  function getArchetypeTier(tags, primaryKey, secondaryKey) {
    const primaryScore = primaryKey ? scoreUnitForArchetype(tags, primaryKey) : 0;
    const secondaryScore = secondaryKey ? scoreUnitForArchetype(tags, secondaryKey) : 0;

    const primaryStrong = primaryScore >= 3;
    const secondaryStrong = secondaryScore >= 3;
    const primarySupport = primaryScore > 0;
    const secondarySupport = secondaryScore > 0;

    if (primaryStrong && secondaryStrong) return 4;   // bridge unit
    if (primaryStrong) return 3;                      // primary core
    if (secondaryStrong) return 2;                    // secondary core
    if (primarySupport || secondarySupport) return 1; // support to selected effects
    return 0;                                         // unrelated
  }

  function sortByStrictArchetypes(candidates, archetypes) {
    const primaryKey = archetypes?.[0] || "";
    const secondaryKey = archetypes?.[1] || "";
    if (!primaryKey && !secondaryKey) return [...candidates];

    return [...candidates].sort((a, b) => {
      const tierA = getArchetypeTier(a.__opt.tags, primaryKey, secondaryKey);
      const tierB = getArchetypeTier(b.__opt.tags, primaryKey, secondaryKey);
      if (tierB !== tierA) return tierB - tierA;
      if (b.__opt.base !== a.__opt.base) return b.__opt.base - a.__opt.base;
      return normId(a.id).localeCompare(normId(b.id));
    });
  }

  function filterCandidatesForArchetypes(candidates, archetypes, requiredCount) {
    const primaryKey = archetypes?.[0] || "";
    const secondaryKey = archetypes?.[1] || "";
    if (!primaryKey && !secondaryKey) return [...candidates];

    const sorted = sortByStrictArchetypes(candidates, archetypes);
    const bridge = sorted.filter(u => getArchetypeTier(u.__opt.tags, primaryKey, secondaryKey) >= 4);
    const primaryCore = sorted.filter(u => getArchetypeTier(u.__opt.tags, primaryKey, secondaryKey) === 3);
    const secondaryCore = sorted.filter(u => getArchetypeTier(u.__opt.tags, primaryKey, secondaryKey) === 2);
    const support = sorted.filter(u => getArchetypeTier(u.__opt.tags, primaryKey, secondaryKey) === 1);

    let strictPool = [];
    if (primaryKey && secondaryKey) {
      strictPool = [...bridge, ...primaryCore, ...secondaryCore, ...support];
    } else {
      strictPool = [...primaryCore, ...support];
    }

    const seen = new Set();
    strictPool = strictPool.filter(u => {
      const id = normId(u.id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (strictPool.length >= requiredCount) return strictPool;
    return sorted;
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
    if (window.EvertaleRosterProfiles && typeof window.EvertaleRosterProfiles.estimateUnitStats === "function") {
      try {
        const estimated = window.EvertaleRosterProfiles.estimateUnitStats(u);
        return {
          atk: +(estimated.atk || 0),
          hp:  +(estimated.hp  || 0),
          spd: +(estimated.spd || 0),
          cost:+(estimated.cost || 1),
        };
      } catch (err) {
        console.warn("[optimizerEngine] roster profile stat estimate failed:", err);
      }
    }

    const s = u.stats || {};
    return {
      atk: +((s.atk ?? u.atk) || 0),
      hp:  +((s.hp  ?? u.hp)  || 0),
      spd: +((s.spd ?? u.spd) || 0),
      cost:+((s.cost?? u.cost)|| 1),
    };
  }

  // ---------- ELEMENT ----------
  function normalizeElementValue(value) {
    const e = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (e === 'fire' || e === 'flame') return 'fire';
    if (e === 'water' || e === 'ice') return 'water';
    if (e === 'storm' || e === 'air' || e === 'wind' || e === 'thunder' || e === 'lightning' || e === 'electric') return 'storm';
    if (e === 'earth' || e === 'terra' || e === 'ground') return 'earth';
    if (e === 'light' || e === 'life' || e === 'holy') return 'light';
    if (e === 'dark' || e === 'death' || e === 'shadow') return 'dark';
    return e || String(value || '');
  }

  function getElement(u) {
    if (u.__opt && u.__opt.tags) {
      for (const t of u.__opt.tags) if (t.startsWith("elem_")) return t.slice(5);
    }
    return normalizeElementValue(u.element);
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

    const archetypes = options?.archetypes || [];
    for (const key of archetypes) {
      if (ARCHETYPE_DEFS[key]) score += scoreUnitForArchetype(u.__opt.tags, key) * 1200;
    }

    return score;
  }

  function extractTeamFeatures(team) {
    const tagCount = new Map();
    const elemCount = new Map();
    for (const u of team) {
      const e = getElement(u) || "";
      if (e) elemCount.set(e, (elemCount.get(e) || 0) + 1);
      for (const t of u.__opt.tags) tagCount.set(t, (tagCount.get(t) || 0) + 1);
    }
    const has = (t) => (tagCount.get(t) || 0) > 0;
    const n = (t) => (tagCount.get(t) || 0);

    const engines = {
      burn:   { apply: n("burn_apply") + n("frostburn_apply"), payoff: n("burn_synergy") + n("burn_tier_healing") + n("burn_tier_mega_healing"), anti: n("burn_anti"), support: n("status_spread") + n("infect") + n("tu_manip") + n("ward_burn") },
      poison: { apply: n("poison_apply"), payoff: n("poison_synergy") + n("poison_tier_lethal") + n("poison_tier_mega") + n("poison_tier_super"), anti: n("poison_anti"), support: n("status_spread") + n("infect") + n("tu_manip") + n("ward_poison") },
      sleep:  { apply: n("sleep_apply"), payoff: n("sleep_synergy"), anti: n("sleep_anti"), support: n("tu_manip") + n("ward_sleep") },
      stun:   { apply: n("stun_apply"), payoff: n("stun_synergy"), anti: n("stun_anti"), support: n("tu_manip") + n("ward_stun") },
    };

    const coverage = {
      heal: has("heal"),
      revive: has("revive"),
      cleanse: has("purify"),
      mitigation: has("damage_reduction"),
      tempo: has("tu_manip"),

      // expanded coverage (synonyms map here via expandUnitTags)
      barrier: has("barrier"),
      guard: has("guard"),
      dispel: has("dispel"),
      stealth: has("stealth"),
      evasion: has("evasion"),
      dps: has("role_dps"),
      supportRole: has("role_support"),
      tankRole: has("role_tank"),
      controlRole: has("role_control"),
      allEnemies: has("target_all_enemies"),
      finisher: has("ai_finisher"),
    };

    return { tagCount, elemCount, engines, coverage, size: team.length };
  }

  function clamp01(x){ return x < 0 ? 0 : (x > 1 ? 1 : x); }

  function engineScore(eng) {
    const pair = Math.min(eng.apply, eng.payoff);
    const partial = (eng.apply + eng.payoff) - 2 * pair;
    let s = 0;
    s += pair * 3.0;
    s += partial * 0.75;
    s += clamp01(eng.support / 4) * (pair > 0 ? 2.0 : 1.0);
    s -= eng.anti * 3.5;
    if (eng.apply >= 3 && eng.payoff === 0) s -= 2.0;
    if (eng.payoff >= 3 && eng.apply === 0) s -= 2.0;
    return s;
  }

  function redundancyPenalty(features) {
    const n = (t)=>features.tagCount.get(t)||0;
    let p = 0;

    // Core redundancies
    const healers = n("heal");
    const cleansers = n("purify");
    const mitig = n("damage_reduction");

    // Expanded redundancies (lighter penalties)
    const barriers = n("barrier");
    const guards = n("guard");

    if (healers > 2) p += (healers - 2) * 0.9;
    if (cleansers > 2) p += (cleansers - 2) * 1.1;
    if (mitig > 2) p += (mitig - 2) * 0.7;

    if (barriers > 2) p += (barriers - 2) * 0.5;
    if (guards > 2) p += (guards - 2) * 0.6;

    if (!features.coverage.dps) p += 1.6;
    if (!features.coverage.supportRole && !features.coverage.tankRole) p += 1.2;
    if (!features.coverage.controlRole && !features.coverage.tempo) p += 0.8;

    return p;
  }

  function coverageBonus(features) {
    let b = 0;

    // Core coverage
    if (features.coverage.heal) b += 1.0;
    if (features.coverage.cleanse) b += 1.2;
    if (features.coverage.revive) b += 0.8;
    if (features.coverage.mitigation) b += 0.9;
    if (features.coverage.tempo) b += 0.7;

    // Expanded coverage (smaller, but helps teams feel "complete")
    if (features.coverage.barrier) b += 0.6;
    if (features.coverage.guard) b += 0.6;
    if (features.coverage.dispel) b += 0.5;
    if (features.coverage.stealth) b += 0.35;
    if (features.coverage.evasion) b += 0.35;

    // Combo bonuses
    if (features.coverage.mitigation && (features.coverage.heal || features.coverage.revive)) b += 0.8;
    if (features.coverage.guard && (features.coverage.barrier || features.coverage.mitigation)) b += 0.4;
    if ((features.engines.sleep.apply || features.engines.stun.apply) && features.coverage.tempo) b += 0.6;

    if (features.coverage.dps) b += 0.65;
    if (features.coverage.supportRole) b += 0.55;
    if (features.coverage.tankRole) b += 0.45;
    if (features.coverage.controlRole) b += 0.55;
    if (features.coverage.allEnemies && features.coverage.finisher) b += 0.35;

    return b;
  }


  function aiTeamCohesionScore(team, features, options) {
    const n = (t)=>features.tagCount.get(t)||0;
    let s = 0;

    const dps = n("role_dps");
    const support = n("role_support");
    const tank = n("role_tank");
    const control = n("role_control");
    const tempo = n("tu_manip");
    const finisher = n("ai_finisher") + n("execute");
    const aoe = n("target_all_enemies");
    const multi = n("target_multi_enemy");

    if (dps >= 2) s += 1.4; else if (dps === 1) s += 0.5; else s -= 2.4;
    if (support >= 1) s += 1.1; else s -= 0.9;
    if (control >= 1) s += 0.9;
    if (tank >= 1) s += 0.65;
    if (tempo >= 1) s += 0.7;

    if (dps > 4) s -= (dps - 4) * 0.7;
    if (support > 3) s -= (support - 3) * 0.45;
    if (tank > 3) s -= (tank - 3) * 0.35;

    if ((aoe || multi) && finisher) s += 0.7;
    if ((aoe || multi) && (features.engines.burn.apply || features.engines.sleep.apply || features.engines.poison.apply || features.engines.stun.apply)) s += 0.65;
    if (tempo && finisher) s += 0.5;
    if (features.coverage.cleanse && (features.coverage.heal || features.coverage.mitigation)) s += 0.55;
    if (features.coverage.guard && (features.coverage.heal || features.coverage.mitigation || features.coverage.barrier)) s += 0.6;

    if (n("ai_prioritizes_sleep_frostburn") && (n("sleep_apply") || n("sleep_synergy") || n("burn_apply") || n("burn_synergy"))) s += 0.7;
    if (n("ai_prioritizes_burn") && (n("burn_apply") || n("burn_synergy"))) s += 0.55;
    if (n("ai_prioritizes_poison") && (n("poison_apply") || n("poison_synergy"))) s += 0.55;
    if (n("ai_prioritizes_stun") && (n("stun_apply") || n("stun_synergy"))) s += 0.55;

    for (const key of (options?.archetypes || [])) {
      const def = ARCHETYPE_DEFS[key];
      if (!def) continue;
      const coreCount = team.reduce((acc,u)=>acc + (anyTag(u.__opt.tags, def.include) ? 1 : 0), 0);
      if (coreCount === 0) s -= 3.0;
      else if (coreCount === 1) s -= 0.5;
      else s += Math.min(2.0, coreCount * 0.45);
    }

    return s;
  }

  function archetypeCohesionScore(team, archetypes) {
    const defs = getArchetypeDefs(archetypes);
    if (!defs.length) return 0;

    let s = 0;
    for (const {key} of defs) {
      let strong = 0, support = 0, anti = 0;
      for (const u of team) {
        const score = scoreUnitForArchetype(u.__opt.tags, key);
        if (score >= 3) strong++;
        else if (score > 0) support++;
        else if ((ARCHETYPE_DEFS[key]?.exclude || []).some(t => u.__opt.tags.has(t))) anti++;
      }
      s += strong * 1.9 + support * 0.75 - anti * 1.5;
      if (strong === 0) s -= 3.0;
      else if (strong === 1) s -= 0.9;
    }

    if (defs.length >= 2) {
      let bridge = 0;
      for (const u of team) {
        const hits = defs.reduce((acc, {key}) => acc + (scoreUnitForArchetype(u.__opt.tags, key) > 0 ? 1 : 0), 0);
        if (hits >= 2) bridge++;
      }
      s += bridge * 2.2;
      if (bridge === 0) s -= 1.5;
    }

    return s;
  }

  function presetCohesionScore(team, presetKey) {
    const def = PRESET_DEFS[presetKey];
    if (!def) return 0;
    let strong = 0, anti = 0, soft = 0;
    for (const u of team) {
      if (anyTag(u.__opt.tags, def.include)) strong++;
      if (anyTag(u.__opt.tags, def.soft)) soft++;
      if (anyTag(u.__opt.tags, def.exclude)) anti++;
    }
    return strong * 2.0 + soft * 0.6 - anti * 3.2;
  }

  function teamSynergyScore(doctrine, team, options) {
    const presetKey = options?.presetKey || "";
    const features = extractTeamFeatures(team);

    let s = 0;
    s += engineScore(features.engines.burn);
    s += engineScore(features.engines.poison);
    s += engineScore(features.engines.sleep);
    s += engineScore(features.engines.stun);

    if (presetKey && PRESET_DEFS[presetKey]) s += presetCohesionScore(team, presetKey);
    if (Array.isArray(options?.archetypes) && options.archetypes.length) s += archetypeCohesionScore(team, options.archetypes);

    s += coverageBonus(features);
    s += aiTeamCohesionScore(team, features, options);
    s -= redundancyPenalty(features);

    return s;
  }

  function teamScore(doctrine, team, options) {
    const add = doctrine.scoringModel?.teamAdditives || {};
    const base = team.reduce((a,u)=>a + u.__opt.base, 0) / Math.max(1, team.length);

    const synergy = teamSynergyScore(doctrine, team, options);

    const basePart = (base / 5000);
    const synergyPart = synergy * (add.pairSynergyWeight ?? 0.35);

    return basePart + synergyPart;
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
    const chosen = new Set(team.map(u => normId(u.id)));

    // Greedy synergy-aware fill:
    // At each step, pick the candidate that maximizes teamScore(team ∪ {cand}).
    // Lookahead is capped for performance and determinism.
    const lookahead = doctrine.optimizerSearch?.greedyLookahead ?? 80;

    while (team.length < size) {
      let best = null;
      let bestScore = -Infinity;

      // Consider the top-N remaining candidates (pool is already roughly sorted by base).
      let seen = 0;
      for (const u of pool) {
        if (team.length >= size) break;
        const id = normId(u.id);
        if (forcedIds.has(id) || chosen.has(id)) continue;

        // cap
        if (seen++ >= lookahead) break;

        const score = teamScore(doctrine, [...team, u], options);

        // tie-break: higher base, then stable id
        if (score > bestScore ||
            (score === bestScore && best && u.__opt.base > best.__opt.base) ||
            (score === bestScore && best && u.__opt.base === best.__opt.base && id < normId(best.id))) {
          bestScore = score;
          best = u;
        }
      }

      if (!best) break;
      team.push(best);
      chosen.add(normId(best.id));
    }

    return team;
  }

  // Fallback fill used when strict filtering (preset/mono/candidate caps) produces
  // fewer than the requested size. This intentionally relaxes constraints and
  // prioritizes "best available fit" so platoons don't end up with empty slots.
  //
  // Strategy:
  // 1) Greedy add using teamScore against a relaxed pool (no preset/mono filters)
  // 2) If still short, fill by highest base to guarantee completion
  //
  // Note: This does NOT allow duplicates within the same team. Callers may
  // optionally allow reuse across teams if the roster is exhausted.
  function fillTeamToSizeRelaxed(doctrine, team, relaxedPool, size, options) {
    const chosen = new Set(team.map(u => normId(u.id)));
    const lookahead = Math.max(200, doctrine.optimizerSearch?.greedyLookahead ?? 80);

    // Phase 1: synergy-aware greedy add
    while (team.length < size) {
      let best = null;
      let bestScore = -Infinity;
      let seen = 0;

      for (const u of relaxedPool) {
        const id = normId(u.id);
        if (chosen.has(id)) continue;
        if (seen++ >= lookahead) break;

        const score = teamScore(doctrine, [...team, u], options);
        if (score > bestScore ||
            (score === bestScore && best && u.__opt.base > best.__opt.base) ||
            (score === bestScore && best && u.__opt.base === best.__opt.base && id < normId(best.id))) {
          bestScore = score;
          best = u;
        }
      }

      if (!best) break;
      team.push(best);
      chosen.add(normId(best.id));
    }

    // Phase 2: guarantee completion (highest base)
    if (team.length < size) {
      const remaining = relaxedPool
        .filter(u => !chosen.has(normId(u.id)))
        .sort((a,b)=> (b.__opt.base - a.__opt.base) || (normId(a.id) < normId(b.id) ? -1 : 1));

      for (const u of remaining) {
        if (team.length >= size) break;
        team.push(u);
        chosen.add(normId(u.id));
      }
    }

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
    let pool = units.filter(u => !forcedIds.has(normId(u.id)));

    // archetype filtering for non-forced picks happens before candidate capping,
    // so lower-stat but mechanically relevant units are not discarded too early.
    pool = filterCandidatesForArchetypes(pool, options.archetypes || [], 8 - forcedUnits.length);
    pool = topCandidates(pool, poolSize);

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

    // Build 8 strictly from the filtered pool first.
    const team8 = buildTeamFixedSize(doctrine, pool, forcedUnits, 8, options);

    // If strict filtering could not fill all 8, only then fall back to the best
    // remaining roster units, still sorted by archetype relevance when possible.
    if (team8.length < 8) {
      const chosenIds = new Set(team8.map(u => normId(u.id)));
      let relaxedPool = units.filter(u => !forcedIds.has(normId(u.id)) && !chosenIds.has(normId(u.id)));
      relaxedPool = sortByStrictArchetypes(topCandidates(relaxedPool, Math.max(240, relaxedPool.length)), options.archetypes || []);
      fillTeamToSizeRelaxed(doctrine, team8, relaxedPool, 8, options);
    }

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

      // archetype filtering for non-forced picks happens before candidate capping,
      // so lower-stat but mechanically relevant units are not discarded too early.
      candidates = filterCandidatesForArchetypes(candidates, options.archetypes || [], 5 - forced.length);
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

      // If strict candidate filtering results in an incomplete platoon, fill the
      // remaining slots with the best available units (relaxed constraints).
      if (team.length < 5) {
        const chosenIds = new Set(team.map(u => normId(u.id)));

        // Prefer unused units first
        let relaxedPool = units.filter(u => !forcedIds.has(normId(u.id)) && !chosenIds.has(normId(u.id)) && !consumed.has(normId(u.id)));
        relaxedPool = sortByStrictArchetypes(topCandidates(relaxedPool, Math.max(400, relaxedPool.length)), options.archetypes || []);

        // If roster is exhausted (common late platoons), allow reuse across teams
        // so we still output 5 slots. This keeps duplicates OUT of the same platoon.
        if (relaxedPool.length === 0) {
          relaxedPool = units.filter(u => !forcedIds.has(normId(u.id)) && !chosenIds.has(normId(u.id)));
          relaxedPool = sortByStrictArchetypes(topCandidates(relaxedPool, Math.max(400, relaxedPool.length)), options.archetypes || []);
        }

        fillTeamToSizeRelaxed(doctrine, team, relaxedPool, 5, options);
      }
      const ids = team.map(u => normId(u.id));

      // mark consumed
      for (const id of ids) if (id) consumed.add(id);

      platoons.push({ units: ids });
    }

    return platoons;
  }

  function scoreResult(doctrine, result, unitsById, options) {
    let total = 0;

    const storyUnits = [
      ...((result?.story?.main || []).map(id => unitsById.get(normId(id))).filter(Boolean)),
      ...((result?.story?.back || []).map(id => unitsById.get(normId(id))).filter(Boolean)),
    ];
    if (storyUnits.length) total += teamScore(doctrine, storyUnits, options) * 2.0;

    for (const row of (result?.platoons || [])) {
      const team = (row?.units || []).map(id => unitsById.get(normId(id))).filter(Boolean);
      if (team.length) total += teamScore(doctrine, team, options);
    }

    return total;
  }

  // ---------- RUN ----------
  function run(ownedUnits, options) {
    const doctrine = getDoctrineMerged(options || {});
    const opts = structuredCloneSafe(options || {});

    const units = (ownedUnits || []).map(u => {
      const clone = Object.assign({}, u);
      clone.id = normId(u.id);
      clone.__opt = { tags: mergeTagSets(getUnitTags(u), deriveAITags(u)) };
      return clone;
    });

    // preset key handling
    let presetKey = lc(opts.presetTag || "");
    const presetMode = lc(opts.presetMode || "off");
    if (presetKey && !PRESET_DEFS[presetKey]) presetKey = "";
    opts.archetypes = Array.isArray(opts.archetypes)
      ? opts.archetypes.map(v => lc(v || "")).filter((v, i, arr) => v && ARCHETYPE_DEFS[v] && arr.indexOf(v) === i).slice(0,2)
      : [];
    if (!presetKey && opts.archetypes.length) {
      const first = opts.archetypes[0];
      if (PRESET_DEFS[first]) presetKey = first;
      else if (first === "defense") presetKey = "hpBuff";
      else if (first === "stealth") presetKey = "turn";
      else if (first === "spirit") presetKey = "turn";
      else if (first === "charge") presetKey = "atkBuff";
    }
    opts.presetKey = presetKey;
    opts.presetMode = presetMode;

    for (const u of units) u.__opt.base = unitBase(doctrine, u, opts);

    const unitsById = new Map(units.map(u => [normId(u.id), u]));

    const story = buildStory(doctrine, units, opts, unitsById);
    const platoons = buildPlatoons(doctrine, units, story.used, opts, unitsById);

    const result = { story: { main: story.main, back: story.back }, platoons, presetKey: opts.presetKey || "", aiAware: true };
    result.totalScore = scoreResult(doctrine, result, unitsById, opts);
    return result;
  }

  window.OptimizerEngine = { run };
})();