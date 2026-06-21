/* optimizerEngineV2.js — runtime-aware optimizer bridge
   Primary goal: make the new split runtime the source of truth while keeping
   the existing optimizer engine as the safe scoring fallback.
*/

(function(global){
  'use strict';

  const legacyEngine = global.OptimizerEngine || null;
  global.OptimizerEngineLegacy = legacyEngine;

  const STORY_MAIN_SIZE = 5;
  const STORY_BACK_SIZE = 3;
  const PLATOON_COUNT = 20;
  const PLATOON_SIZE = 5;

  function norm(value){
    return String(value || '')
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  function asArray(value){ return Array.isArray(value) ? value : []; }

  function canonicalTag(value){
    return String(value || '')
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .trim();
  }

  function addTag(out, tag){
    const key = canonicalTag(tag);
    if (key) out.add(key);
  }

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function getRuntime(){
    return global.OptimizerRuntime && global.OptimizerRuntime.loaded ? global.OptimizerRuntime : null;
  }

  function getStats(unit){
    if (!unit || typeof unit !== 'object') return { atk: 0, hp: 0, spd: 0, cost: 1 };
    if (unit.__runtimeV2?.stats) return unit.__runtimeV2.stats;
    let resolved = null;
    if (global.EvertaleRosterProfiles && typeof global.EvertaleRosterProfiles.estimateUnitStats === 'function') {
      try {
        const estimated = global.EvertaleRosterProfiles.estimateUnitStats(unit);
        resolved = {
          atk: num(estimated?.atk, 0),
          hp: num(estimated?.hp, 0),
          spd: num(estimated?.spd, 0),
          cost: Math.max(1, num(estimated?.cost, 1)),
        };
      } catch (_) {}
    }
    if (!resolved) {
      const s = unit?.stats || {};
      resolved = {
        atk: num(s.atk ?? unit?.atk, 0),
        hp: num(s.hp ?? unit?.hp, 0),
        spd: num(s.spd ?? unit?.spd, 0),
        cost: Math.max(1, num(s.cost ?? unit?.cost, 1)),
      };
    }
    unit.__runtimeV2 = { ...(unit.__runtimeV2 || {}), stats: resolved };
    return resolved;
  }

  function normalizeElement(value){
    const e = norm(value);
    if (e === 'fire' || e === 'flame') return 'fire';
    if (e === 'water' || e === 'ice') return 'water';
    if (e === 'storm' || e === 'air' || e === 'wind' || e === 'thunder' || e === 'lightning' || e === 'electric') return 'storm';
    if (e === 'earth' || e === 'terra' || e === 'ground') return 'earth';
    if (e === 'light' || e === 'life' || e === 'holy') return 'light';
    if (e === 'dark' || e === 'death' || e === 'shadow') return 'dark';
    return e || String(value || '').trim().toLowerCase();
  }

  function unitElement(unit){
    return normalizeElement(unit?.element || unit?.__runtimeV2?.element || '');
  }

  function unitTags(unit){
    const out = new Set();
    [
      ...asArray(unit?.derivedTags),
      ...asArray(unit?.tags),
    ].map(String).map(s => s.trim()).filter(Boolean).forEach(tag => {
      out.add(tag);
      addTag(out, tag);
    });
    return out;
  }

  function tagText(unit){
    if (unit?.__runtimeV2?.tagText) return unit.__runtimeV2.tagText;
    return Array.from(unitTags(unit)).map(canonicalTag).filter(Boolean).join(' ');
  }

  function hasAnyTag(unit, needles){
    const tags = unitTags(unit);
    const text = tagText(unit);
    return needles.some(needle => {
      const raw = String(needle || '').trim();
      const key = canonicalTag(raw);
      return tags.has(raw) || tags.has(key) || (!!key && text.includes(key));
    });
  }

  function textBlobForUnit(unit){
    const parts = [];
    const add = value => { if (value != null && value !== '') parts.push(String(value)); };
    add(unit?.name); add(unit?.title); add(unit?.description); add(unit?.element);
    add(unit?.weaponPref); add(unit?.weaponType); add(unit?.attackType); add(unit?.family); add(unit?.class);
    for (const skill of asArray(unit?.activeSkills)) {
      add(skill?.id); add(skill?.name); add(skill?.description); add(skill?.selected); add(skill?.targeting);
      add(skill?.effect); add(skill?.config); add(skill?.abilityEffect);
      for (const flag of asArray(skill?.flags)) add(flag);
      for (const component of asArray(skill?.components)) add(component);
      const ai = skill?.ai || {};
      Object.keys(ai.conditions || {}).forEach(add);
      Object.keys(ai.sourceConditions || {}).forEach(add);
    }
    for (const passive of asArray(unit?.passiveSkillDetails || unit?.passiveSkills)) {
      if (typeof passive === 'string') add(passive);
      else { add(passive?.id); add(passive?.name); add(passive?.description); add(passive?.internalId); }
    }
    return parts.join(' \n ').toLowerCase();
  }

  function derivedTagsFromUnit(unit){
    const out = new Set();
    const blob = textBlobForUnit(unit);
    const has = re => re.test(blob);

    if (has(/frostburn|burning|\bburn\b|burned|ignite/)) addTag(out, 'burn_apply');
    if (has(/poisoned|\bpoison\b|venom|toxin|mega poison/)) addTag(out, 'poison_apply');
    if (has(/sleeping|deep sleep|\bsleep\b|slumber/)) addTag(out, 'sleep_apply');
    if (has(/stunned|\bstun\b|shock|push back/)) addTag(out, 'stun_apply');
    if (has(/stealth|super stealth|hidden|invisible/)) addTag(out, 'stealth');

    if (has(/burning enemy|burning enemies|frostburned|burn drive|burn blast|burning.*damage|vs_burning|isburning/)) addTag(out, 'burn_synergy');
    if (has(/poisoned enemy|poisoned enemies|poison eater|poison devour|mega poison|poison.*damage|vs_poison|ispoisoned/)) addTag(out, 'poison_synergy');
    if (has(/sleeping enemy|sleeping enemies|sleep.*damage|dream|nightmare|vs_sleep|issleeping/)) addTag(out, 'sleep_synergy');
    if (has(/stunned enemy|stunned enemies|time strike|stun.*damage|vs_stunned|isstunned/)) addTag(out, 'stun_synergy');

    if (has(/frostburn|noxious sleep|sleep.*poison|poison.*sleep|status.*convert|convert.*status/)) addTag(out, 'status_bridge');
    if (has(/heal|restor|recover|regeneration|lifesteal|life steal|drain hp/)) addTag(out, 'heal');
    if (has(/purif|cleanse|remove negative|remove debuff|negative status effects are removed/)) addTag(out, 'purify');
    if (has(/revive|resurrect|return.*battlefield|reincarnation/)) addTag(out, 'revive');
    if (has(/guardian|protector|protect allies|bodyguard|\bguard\b/)) addTag(out, 'guard');
    if (has(/barrier|shield|ward|armor|damage reduction|less damage/)) addTag(out, 'barrier');
    if (has(/hold ground|survive.*1\s*hp|survives with 1 hp|cannot be defeated/)) addTag(out, 'hold_ground');
    if (has(/give.*next turn|turn grant|next turns|reduce.*tu|tu reduced|tu to 0|haste|quicken/)) addTag(out, 'tu_manip');
    if (has(/ally spirit|enemy spirit|gain.*spirit|spirit.*doubled|spirit to/)) addTag(out, 'spirit_synergy');
    if (has(/charge|power charge|charges/)) addTag(out, 'charge');
    if (has(/survivor|survival|after.*300\s*tu|300\s*tu.*surviv/)) addTag(out, 'survivor');
    if (has(/crisis|low hp|hp.*25%|less than.*hp|desperate/)) addTag(out, 'crisis');
    if (has(/bloodfury|blood fury|bloodthirst|blood thirst|bloodnova|blood nova|blood.*ally|defeated ally/)) addTag(out, 'blood');
    if (has(/revenge|avenge|payback|vengeance|when.*defeated/)) addTag(out, 'revenge');
    if (has(/dispel|remove.*buff|remove positive|strip/)) addTag(out, 'dispel');
    if (has(/weaken|attack reduced|attack down/)) addTag(out, 'weaken');
    if (has(/immediately defeated|defeated without damage|instant death|execute|10% or less/)) addTag(out, 'execute');

    if (out.has('burn_synergy') || out.has('poison_synergy') || out.has('sleep_synergy') || out.has('stun_synergy') || out.has('blood') || out.has('survivor') || out.has('charge') || out.has('execute')) addTag(out, 'role_dps');
    if (out.has('heal') || out.has('purify') || out.has('revive') || out.has('spirit_synergy')) addTag(out, 'role_support');
    if (out.has('guard') || out.has('barrier') || out.has('hold_ground')) addTag(out, 'role_tank');
    if (out.has('sleep_apply') || out.has('stun_apply') || out.has('tu_manip') || out.has('weaken') || out.has('dispel') || out.has('stealth')) addTag(out, 'role_control');

    return Array.from(out);
  }

  function indexRuntimeTags(runtime){
    const tags = runtime?.chunks?.tags || {};
    const out = new Map();
    if (!tags || typeof tags !== 'object') return out;

    Object.entries(tags).forEach(([key, row]) => {
      if (!row || typeof row !== 'object') return;
      const keys = [key,row.id,row.internalMonsterId,row.sourceId,row.family,row.name];
      keys.map(norm).filter(Boolean).forEach(k => {
        if (!out.has(k)) out.set(k, row);
      });
    });
    return out;
  }

  function indexRuntimeCharacters(runtime){
    const families = runtime?.chunks?.characters || {};
    const entries = runtime?.chunks?.characterEntries || {};
    const out = new Map();

    function addRow(key, row){
      if (!row || typeof row !== 'object') return;
      const keys = [
        key,
        row.id,
        row.family,
        row.sourceId,
        row.internalMonsterId,
        row.name,
        row.title,
        ...(asArray(row.rawFormSourceIds)),
        ...(asArray(row.states).flatMap(s => [s?.sourceId, s?.dataSourceId, s?.name, s?.title])),
      ];
      keys.map(norm).filter(Boolean).forEach(k => {
        if (!out.has(k)) out.set(k, row);
      });
    }

    Object.entries(families || {}).forEach(([key, row]) => addRow(key, row));
    Object.entries(entries || {}).forEach(([key, row]) => addRow(key, row));
    return out;
  }

  function conditionTagsFromKnowledge(unit, runtime){
    const knowledge = runtime?.chunks?.optimizerKnowledge || {};
    const sources = asArray(knowledge.sources);
    if (!sources.length) return [];

    const keys = [unit.id, unit.sourceId, unit.family, unit.name, unit.title]
      .map(norm)
      .filter(Boolean);

    const tags = new Set();
    const add = (tag) => tags.add(tag);

    for (const source of sources) {
      const categories = source?.categories || {};
      for (const rows of Object.values(categories)) {
        for (const rawPath of asArray(rows)) {
          const pNorm = norm(rawPath);
          if (!keys.some(k => pNorm.includes(k))) continue;

          const p = String(rawPath || '').toLowerCase();
          add('runtime_ai_known');

          if (p.includes('baseaitargetingweight')) add('ai_weighted_skill');
          if (p.includes('aitargetingmonsterconditions')) add('ai_target_conditions');
          if (p.includes('aitargetingsourcemonsterconditions')) add('ai_source_conditions');
          if (p.includes('lesshpthanactivemonsterattack') || p.includes('1hp') || p.includes('hpbelow')) add('ai_finisher');
          if (p.includes('protect') || p.includes('guardian')) add('ai_guardian_breaker');
          if (p.includes('burn')) add('ai_prioritizes_burn');
          if (p.includes('poison')) add('ai_prioritizes_poison');
          if (p.includes('sleep') || p.includes('frostburn')) add('ai_prioritizes_sleep_frostburn');
          if (p.includes('stun')) add('ai_prioritizes_stun');
          if (p.includes('welcome')) add('summon_or_entry_synergy');
          if (p.includes('spirit')) add('spirit_synergy');
        }
      }
    }

    return Array.from(tags);
  }

  function tagsFromRuntimeRow(row){
    if (!row || typeof row !== 'object') return [];
    return [
      ...asArray(row.derivedTags),
      ...asArray(row.tags),
      ...asArray(row.manualTags),
      ...asArray(row.runtimeTags),
    ].map(String).filter(Boolean);
  }

  function mergeUnique(...lists){
    const out = new Set();
    lists.flat().forEach(v => {
      const s = String(v || '').trim();
      if (s) out.add(s);
    });
    return Array.from(out);
  }

  function enrichUnit(unit, indexes, runtime){
    const keys = [unit.id, unit.sourceId, unit.family, unit.name, unit.title]
      .map(norm)
      .filter(Boolean);

    const tagRow = keys.map(k => indexes.tags.get(k)).find(Boolean) || null;
    const runtimeRow = keys.map(k => indexes.characters.get(k)).find(Boolean) || null;
    const aiTags = conditionTagsFromKnowledge(unit, runtime);

    let abilityEnriched = unit;
    if (global.AbilityScoreEngine && typeof global.AbilityScoreEngine.enrichUnitWithAbilityPower === 'function') {
      abilityEnriched = global.AbilityScoreEngine.enrichUnitWithAbilityPower(unit);
    }

    const textTags = derivedTagsFromUnit(abilityEnriched);
    const mergedTags = mergeUnique(
      asArray(abilityEnriched.derivedTags),
      asArray(abilityEnriched.tags),
      tagsFromRuntimeRow(tagRow),
      aiTags,
      textTags
    );

    const abilityScore = Number(abilityEnriched?.__abilityPower?.score || 0);
    const mergedTagText = Array.from(new Set(mergedTags.map(canonicalTag).filter(Boolean))).join(' ');

    return {
      ...abilityEnriched,
      family: unit.family || runtimeRow?.family || tagRow?.family || unit.id,
      sourceId: unit.sourceId || runtimeRow?.sourceId || tagRow?.sourceId || unit.id,
      derivedTags: mergedTags,
      tags: mergedTags,
      optimizerPowerScore: abilityScore,
      __runtimeV2: {
        hasRuntimeCharacter: !!runtimeRow,
        hasRuntimeTags: !!tagRow,
        aiTags,
        abilityScore,
        element: normalizeElement(unit.element || runtimeRow?.element || tagRow?.element || ''),
        tagText: mergedTagText,
      },
    };
  }

  function enrichOwnedUnits(ownedUnits){
    const runtime = getRuntime();
    const indexes = {
      tags: runtime ? indexRuntimeTags(runtime) : new Map(),
      characters: runtime ? indexRuntimeCharacters(runtime) : new Map(),
    };

    return (ownedUnits || [])
      .map(u => enrichUnit(u, indexes, runtime))
      .sort((a, b) => (nativeUnitScore(b, {}) - nativeUnitScore(a, {})));
  }

  const PRESET_RULES = {
    burn: ['burn_apply','burn_synergy','frostburn','ai_prioritizes_burn'],
    poison: ['poison_apply','poison_synergy','ai_prioritizes_poison'],
    sleep: ['sleep_apply','sleep_synergy','frostburn','ai_prioritizes_sleep_frostburn'],
    stun: ['stun_apply','stun_synergy','ai_prioritizes_stun'],
    heal: ['heal','revive','purify','role_support'],
    turn: ['tu_manip','turn_grant','haste','quicken'],
    cleanse: ['purify','cleanse','ward_'],
    atkBuff: ['atk_buff','charge','execute','role_dps'],
    hpBuff: ['damage_reduction','hold_ground','guard','barrier','role_tank'],
    defense: ['damage_reduction','hold_ground','guard','barrier','role_tank'],
    stealth: ['stealth','evasion'],
    spirit: ['spirit_gain','spirit_synergy','spirit_control'],
    charge: ['charge','execute'],
    blood: ['blood','bloodfury','bloodthirst','revenge','summon'],
    crisis: ['crisis','hold_ground','revenge','low_hp'],
    survivor: ['survivor','hold_ground','tu_manip','survival'],
    guardian: ['guard','guardian','protect','role_tank','barrier','damage_reduction'],
  };

  function presetScore(unit, preset){
    const key = String(preset || '').trim();
    if (!key || key === 'auto') return 0;
    const rules = PRESET_RULES[key] || [];
    if (!rules.length) return 0;
    const text = tagText(unit);
    let score = 0;
    for (const rule of rules) {
      if (text.includes(rule)) score += rule.endsWith('_') ? 800 : 1500;
    }
    return score;
  }

  function archetypeScore(unit, archetypes){
    return asArray(archetypes).reduce((sum, key) => sum + presetScore(unit, key) * 0.9, 0);
  }

  function roleScore(unit){
    let score = 0;
    if (hasAnyTag(unit, ['role_dps','execute','charge','burn_synergy','poison_synergy','sleep_synergy','stun_synergy','blood','survivor'])) score += 1800;
    if (hasAnyTag(unit, ['role_support','heal','revive','purify','spirit_gain'])) score += 1200;
    if (hasAnyTag(unit, ['role_control','tu_manip','stun_apply','sleep_apply','weaken','dispel','stealth'])) score += 1100;
    if (hasAnyTag(unit, ['role_tank','guard','damage_reduction','hold_ground','barrier'])) score += 900;
    if (hasAnyTag(unit, ['target_all_enemies','target_multi_enemy','ai_finisher'])) score += 650;
    if (hasAnyTag(unit, ['crisis','revenge'])) score += 500;
    return score;
  }

  function nativeUnitScore(unit, options){
    if (!unit || typeof unit !== 'object') return 0;
    const scoreKey = [
      String(options?.presetTag || ''),
      asArray(options?.archetypes).join(','),
      teamMode(options),
    ].join('|');
    const cache = unit.__runtimeV2?.nativeScoreCache || {};
    if (Number.isFinite(cache[scoreKey])) return cache[scoreKey];
    const s = getStats(unit);
    const base = (s.atk * 0.42) + (s.spd * 12) + (s.hp * 0.06) + ((s.atk / s.cost) * 0.16);
    const ability = num(unit?.optimizerPowerScore || unit?.__runtimeV2?.abilityScore || 0, 0) * 180;
    const score = base + ability + roleScore(unit) + presetScore(unit, options?.presetTag) + archetypeScore(unit, options?.archetypes);
    unit.__runtimeV2 = {
      ...(unit.__runtimeV2 || {}),
      nativeScoreCache: { ...cache, [scoreKey]: score },
    };
    return score;
  }

  function sortedCandidates(units, options){
    return [...asArray(units)].sort((a, b) => {
      const diff = nativeUnitScore(b, options) - nativeUnitScore(a, options);
      if (diff) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  function teamMode(options){
    return options?.doctrineOverrides?.monoVsRainbow?.selectionMode || options?.teamType || 'auto';
  }

  function unitMatches(unit, fragments){
    const text = tagText(unit);
    return asArray(fragments).some(rule => text.includes(String(rule || '').toLowerCase()));
  }

  const STATUS_ENGINES = {
    burn: {
      apply: ['burn_apply','frostburn','ability_effect_burn','ai_prioritizes_burn'],
      payoff: ['burn_synergy','burn_tier','burn_drive','burn_blast','ability_effect_burning'],
      support: ['ward_burn','purify','tu_manip','status_spread'],
      anti: ['burn_anti'],
    },
    poison: {
      apply: ['poison_apply','mega_poison','ability_effect_poison','ai_prioritizes_poison'],
      payoff: ['poison_synergy','poison_tier','poison_eater','poison_devour','blood'],
      support: ['ward_poison','purify','tu_manip','status_spread','survivor'],
      anti: ['poison_anti'],
    },
    sleep: {
      apply: ['sleep_apply','deep_sleep','ability_effect_sleep','ai_prioritizes_sleep_frostburn'],
      payoff: ['sleep_synergy','dream','nightmare','frostburn'],
      support: ['ward_sleep','tu_manip','stealth','purify'],
      anti: ['sleep_anti'],
    },
    stun: {
      apply: ['stun_apply','push_back','ability_effect_stun','ai_prioritizes_stun'],
      payoff: ['stun_synergy','time_strike'],
      support: ['ward_stun','tu_manip','purify','spirit_synergy'],
      anti: ['stun_anti'],
    },
  };

  function countUnitsWith(units, fragments){
    return units.reduce((sum, unit) => sum + (unitMatches(unit, fragments) ? 1 : 0), 0);
  }

  function teamProfile(units){
    const engineProfile = {};
    Object.entries(STATUS_ENGINES).forEach(([key, rules]) => {
      engineProfile[key] = {
        apply: countUnitsWith(units, rules.apply),
        payoff: countUnitsWith(units, rules.payoff),
        support: countUnitsWith(units, rules.support),
        anti: countUnitsWith(units, rules.anti),
      };
    });

    return {
      size: units.length,
      engines: engineProfile,
      dps: countUnitsWith(units, ['role_dps','execute','charge','blood','survivor','burn_synergy','poison_synergy','sleep_synergy','stun_synergy']),
      support: countUnitsWith(units, ['role_support','heal','revive','purify','spirit_synergy']),
      tank: countUnitsWith(units, ['role_tank','guard','barrier','damage_reduction','hold_ground']),
      control: countUnitsWith(units, ['role_control','tu_manip','stun_apply','sleep_apply','stealth','weaken','dispel']),
      tempo: countUnitsWith(units, ['tu_manip','turn_grant','haste','quicken']),
      stealth: countUnitsWith(units, ['stealth','super_stealth','evasion']),
      bridge: countUnitsWith(units, ['status_bridge','frostburn','noxious_sleep']),
      blood: countUnitsWith(units, ['blood','bloodfury','bloodthirst']),
      crisis: countUnitsWith(units, ['crisis','low_hp']),
      survivor: countUnitsWith(units, ['survivor']),
      revenge: countUnitsWith(units, ['revenge','avenge','vengeance']),
      guard: countUnitsWith(units, ['guard','guardian','protect']),
      heal: countUnitsWith(units, ['heal','regeneration','lifesteal']),
      holdGround: countUnitsWith(units, ['hold_ground']),
      cleanse: countUnitsWith(units, ['purify','cleanse']),
      revive: countUnitsWith(units, ['revive','resurrect']),
    };
  }

  function statusEngineValue(engine){
    if (!engine.apply && !engine.payoff && !engine.support) return 0;
    const pair = Math.min(engine.apply, engine.payoff);
    const partial = (engine.apply + engine.payoff) - (pair * 2);
    let score = pair * 4200 + partial * 850 + Math.min(3, engine.support) * (pair ? 750 : 350);
    score -= engine.anti * 2400;
    if (engine.apply >= 3 && !engine.payoff) score -= 2200;
    if (engine.payoff >= 3 && !engine.apply) score -= 2200;
    return score;
  }

  function selectedPlanValue(units, options){
    const keys = [
      options?.presetTag,
      ...asArray(options?.archetypes),
    ].map(v => String(v || '').trim()).filter(Boolean);
    const unique = Array.from(new Set(keys));
    let score = 0;
    for (const key of unique) {
      const rules = PRESET_RULES[key];
      if (!rules) continue;
      const hits = countUnitsWith(units, rules);
      if (!hits) score -= 4500;
      else score += Math.min(4, hits) * 2100;
    }
    return score;
  }

  function roleBalanceValue(profile){
    const targetDps = profile.size >= 5 ? 2 : 1;
    let score = 0;
    if (profile.dps >= targetDps) score += 3600; else score -= (targetDps - profile.dps) * 4200;
    if (profile.support >= 1) score += 2600; else if (profile.size >= 5) score -= 1700;
    if (profile.tank >= 1) score += 2200; else if (profile.size >= 5) score -= 1200;
    if (profile.control >= 1 || profile.tempo >= 1) score += 2100; else if (profile.size >= 5) score -= 1200;
    if (profile.guard && (profile.support || profile.revive || profile.cleanse)) score += 1400;
    if (profile.support > 3) score -= (profile.support - 3) * 1000;
    if (profile.tank > 3) score -= (profile.tank - 3) * 900;
    return score;
  }

  function mechanicCohesionValue(profile){
    const burn = profile.engines.burn;
    const poison = profile.engines.poison;
    const sleep = profile.engines.sleep;
    const stun = profile.engines.stun;
    const burnPlan = burn.apply && burn.payoff;
    const poisonPlan = poison.apply && poison.payoff;
    const sleepPlan = sleep.apply && sleep.payoff;
    const stunPlan = stun.apply || stun.payoff;
    let score = 0;

    Object.values(profile.engines).forEach(engine => { score += statusEngineValue(engine); });

    if (sleepPlan && profile.stealth) score += 3200;
    if (stunPlan && (sleepPlan || profile.stealth || poisonPlan || profile.tempo)) score += 2600;
    if (poisonPlan && (profile.survivor || profile.revenge)) score += 1700;
    if (profile.blood && (profile.revenge || profile.revive || profile.guard)) score += 1900;
    if (profile.crisis && (profile.holdGround || profile.guard || profile.tank)) score += 1200;
    if (profile.survivor && (profile.guard || profile.heal || profile.tempo)) score += 1600;

    if (burnPlan && poisonPlan && !profile.bridge) score -= 6500;
    if (sleepPlan && poisonPlan && !profile.bridge) score -= 5600;
    if (burnPlan && sleepPlan && !profile.bridge) score -= 1800;
    if (burn.apply && poison.apply && !profile.bridge && !(burn.payoff || poison.payoff)) score -= 2400;

    return score;
  }

  function lockedIdsForStory(options){
    const layout = options?.currentLayout || {};
    const locks = options?.slotLocks || {};
    const ids = [];
    asArray(layout.storyMain).slice(0, STORY_MAIN_SIZE).forEach((id, i) => {
      if (locks?.storyMain?.[i] && id) ids.push(String(id));
    });
    asArray(layout.storyBack).slice(0, STORY_BACK_SIZE).forEach((id, i) => {
      if (locks?.storyBack?.[i] && id) ids.push(String(id));
    });
    return new Set(ids);
  }

  function lockedIdsForPlatoons(options){
    const layout = options?.currentLayout || {};
    const locks = options?.slotLocks || {};
    const ids = [];
    asArray(layout.platoons).slice(0, PLATOON_COUNT).forEach((row, p) => {
      asArray(row).slice(0, PLATOON_SIZE).forEach((id, i) => {
        if (locks?.platoons?.[p]?.[i] && id) ids.push(String(id));
      });
    });
    return new Set(ids);
  }

  function elementStrategyValue(ids, byId, options){
    const elems = elementCounts(ids, byId);
    const counts = Array.from(elems.values());
    const maxElem = Math.max(0, ...counts);
    const distinct = elems.size;
    const size = ids.filter(Boolean).length;
    const mode = teamMode(options);
    if (!size) return 0;
    if (mode === 'force_mono') return (maxElem * 1400) - ((size - maxElem) * 2600);
    if (mode === 'force_rainbow') return (distinct * 1200) - Math.max(0, size - distinct - 1) * 900;
    let score = 0;
    if (maxElem >= Math.ceil(size * 0.6)) score += maxElem * 650;
    if (size >= 5 && distinct >= 4) score += 1200;
    return score;
  }

  function elementCounts(team, byId){
    const counts = new Map();
    team.forEach(id => {
      const el = unitElement(byId.get(id));
      if (el) counts.set(el, (counts.get(el) || 0) + 1);
    });
    return counts;
  }

  function teamSynergyScore(ids, byId, options){
    const units = ids.map(id => byId.get(id)).filter(Boolean);
    const profile = teamProfile(units);
    let score = units.reduce((sum, u) => sum + nativeUnitScore(u, options), 0);
    score += roleBalanceValue(profile);
    score += mechanicCohesionValue(profile);
    score += selectedPlanValue(units, options);
    score += elementStrategyValue(ids, byId, options);
    return score;
  }

  function pickAnchorElement(selectedIds, ranked, byId){
    for (const id of selectedIds) {
      const el = unitElement(byId.get(id));
      if (el) return el;
    }
    const counts = new Map();
    ranked.slice(0, 80).forEach(unit => {
      const el = unitElement(unit);
      if (el) counts.set(el, (counts.get(el) || 0) + 1);
    });
    let best = '';
    let bestCount = -1;
    counts.forEach((count, el) => {
      if (count > bestCount) { best = el; bestCount = count; }
    });
    return best;
  }

  function pickCohesiveRow(size, lockedRow, lockedFlags, pool, used, byId, options){
    const out = Array(size).fill('');
    const selectedIds = [];
    const selected = new Set();
    const ranked = sortedCandidates(pool, options);

    for (let i = 0; i < size; i++) {
      const lockedId = String(lockedRow?.[i] || '');
      if (lockedFlags?.[i] && lockedId) {
        out[i] = lockedId;
        if (!selected.has(lockedId)) {
          selectedIds.push(lockedId);
          selected.add(lockedId);
        }
      }
    }

    const mode = teamMode(options);
    const monoAnchor = mode === 'force_mono' ? pickAnchorElement(selectedIds, ranked, byId) : '';
    const lookahead = size > 5 ? 96 : 64;

    function choose(allowUsed, enforceMono){
      let best = null;
      let bestScore = -Infinity;
      let seen = 0;
      for (const unit of ranked) {
        const id = String(unit?.id || '');
        if (!id || selected.has(id)) continue;
        if (!allowUsed && used.has(id)) continue;
        if (enforceMono && monoAnchor && unitElement(unit) !== monoAnchor) continue;
        if (seen++ >= lookahead && best) break;
        const trial = [...selectedIds, id];
        const score = teamSynergyScore(trial, byId, options) + nativeUnitScore(unit, options) * 0.05;
        if (score > bestScore ||
            (score === bestScore && best && nativeUnitScore(unit, options) > nativeUnitScore(best, options)) ||
            (score === bestScore && best && String(id).localeCompare(String(best.id || '')) < 0)) {
          best = unit;
          bestScore = score;
        }
      }
      return best;
    }

    while (selectedIds.length < size) {
      let next = choose(false, mode === 'force_mono');
      if (!next && mode === 'force_mono') next = choose(false, false);
      if (!next) next = choose(true, mode === 'force_mono');
      if (!next && mode === 'force_mono') next = choose(true, false);
      if (!next) break;
      const id = String(next.id || '');
      selectedIds.push(id);
      selected.add(id);
    }

    const alreadyPlaced = new Set(out.filter(Boolean));
    const queue = selectedIds.filter(id => !alreadyPlaced.has(id));
    for (let i = 0; i < size; i++) {
      if (out[i]) continue;
      out[i] = queue.shift() || '';
    }
    selectedIds.forEach(id => { if (id) used.add(id); });
    return out;
  }

  function assignNativeStoryMainBack(ids, byId){
    const scored = ids.map(id => {
      const unit = byId.get(id);
      const s = getStats(unit);
      const front =
        (s.spd * 16) +
        (s.hp * 0.025) +
        (hasAnyTag(unit, ['role_control','stun_apply','sleep_apply','tu_manip','stealth']) ? 4200 : 0) +
        (hasAnyTag(unit, ['role_tank','guard','barrier','hold_ground']) ? 2200 : 0);
      const back =
        (s.atk * 0.38) +
        (hasAnyTag(unit, ['role_dps','execute','blood','survivor','charge']) ? 4200 : 0) +
        (hasAnyTag(unit, ['revive','heal','purify']) ? 1700 : 0);
      return { id, front, back };
    });
    scored.sort((a, b) => (b.front - a.front) || String(a.id).localeCompare(String(b.id)));
    const main = scored.slice(0, STORY_MAIN_SIZE).map(x => x.id);
    const rest = scored.slice(STORY_MAIN_SIZE);
    rest.sort((a, b) => (b.back - a.back) || String(a.id).localeCompare(String(b.id)));
    return { main, back: rest.slice(0, STORY_BACK_SIZE).map(x => x.id) };
  }

  function mergeStoryLocks(ordered, layout, locks){
    const main = Array(STORY_MAIN_SIZE).fill('');
    const back = Array(STORY_BACK_SIZE).fill('');
    const locked = new Set();
    asArray(layout?.storyMain).slice(0, STORY_MAIN_SIZE).forEach((id, i) => {
      if (locks?.storyMain?.[i] && id) { main[i] = String(id); locked.add(String(id)); }
    });
    asArray(layout?.storyBack).slice(0, STORY_BACK_SIZE).forEach((id, i) => {
      if (locks?.storyBack?.[i] && id) { back[i] = String(id); locked.add(String(id)); }
    });
    const queue = [...asArray(ordered.main), ...asArray(ordered.back)]
      .map(String)
      .filter(id => id && !locked.has(id));
    for (let i = 0; i < STORY_MAIN_SIZE; i++) if (!main[i]) main[i] = queue.shift() || '';
    for (let i = 0; i < STORY_BACK_SIZE; i++) if (!back[i]) back[i] = queue.shift() || '';
    return { main, back };
  }

  function buildNativeStory(enriched, options, byId){
    const layout = options?.currentLayout || {};
    const locks = options?.slotLocks || {};
    const used = new Set();
    const row = [
      ...asArray(layout.storyMain).slice(0, STORY_MAIN_SIZE),
      ...asArray(layout.storyBack).slice(0, STORY_BACK_SIZE),
    ];
    const flags = [
      ...asArray(locks.storyMain).slice(0, STORY_MAIN_SIZE),
      ...asArray(locks.storyBack).slice(0, STORY_BACK_SIZE),
    ];
    const teamIds = pickCohesiveRow(STORY_MAIN_SIZE + STORY_BACK_SIZE, row, flags, enriched, used, byId, options).filter(Boolean);
    return mergeStoryLocks(assignNativeStoryMainBack(teamIds, byId), layout, locks);
  }

  function buildNativePlatoons(enriched, options, storyIds, byId){
    const layout = options?.currentLayout || {};
    const locks = options?.slotLocks || {};
    const used = new Set([
      ...Array.from(lockedIdsForStory(options)),
      ...asArray(storyIds).map(String).filter(Boolean),
    ]);
    const platoons = [];

    for (let p = 0; p < PLATOON_COUNT; p++) {
      const row = asArray(layout.platoons?.[p]).slice(0, PLATOON_SIZE);
      const flags = asArray(locks.platoons?.[p]).slice(0, PLATOON_SIZE);
      const units = pickCohesiveRow(PLATOON_SIZE, row, flags, enriched, used, byId, options);
      platoons.push({
        name: `Platoon ${p + 1}`,
        units,
        score: teamSynergyScore(units, byId, options),
      });
    }

    return platoons;
  }

  function buildNativeResult(enriched, options, runtime){
    const byId = new Map(asArray(enriched).map(u => [String(u.id || ''), u]));
    const story = buildNativeStory(enriched, options || {}, byId);
    const storyIds = story.main.concat(story.back).filter(Boolean);
    const platoons = buildNativePlatoons(enriched, options || {}, storyIds, byId);
    const totalScore = storyIds.reduce((sum, id) => {
      const unit = byId.get(String(id || ''));
      return sum + (unit ? nativeUnitScore(unit, options || {}) : 0);
    }, 0) + platoons.reduce((sum, p) => sum + num(p.score, 0), 0);

    return {
      story,
      platoons,
      totalScore,
      engineVersion: 'optimizerEngineV2-runtime-native',
      runtimeEnabled: !!runtime,
      runtimeFlags: runtime?.runtimeFlags || {},
    };
  }

  function run(ownedUnits, options){
    const runtime = getRuntime();
    const enriched = enrichOwnedUnits(ownedUnits || []);

    const enrichedOptions = {
      ...(options || {}),
      runtimeV2: {
        enabled: !!runtime,
        flags: runtime?.runtimeFlags || {},
        manifest: runtime?.manifest || null,
      },
    };

    const preferLegacy = enrichedOptions?.runtimeV2?.forceLegacy === true || enrichedOptions?.forceLegacy === true;
    if (!preferLegacy) {
      return buildNativeResult(enriched, enrichedOptions, runtime);
    }

    if (legacyEngine && typeof legacyEngine.run === 'function') {
      const result = legacyEngine.run(enriched, enrichedOptions);
      return {
        ...(result || {}),
        engineVersion: 'optimizerEngineV2-runtime-bridge-legacy-forced',
        runtimeEnabled: !!runtime,
        runtimeFlags: runtime?.runtimeFlags || {},
      };
    }

    return buildNativeResult(enriched, enrichedOptions, runtime);
  }

  global.OptimizerEngineV2 = { run, enrichOwnedUnits, buildNativeResult };
  global.OptimizerEngine = global.OptimizerEngineV2;
})(window);
