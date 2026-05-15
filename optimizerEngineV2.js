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

  function num(value, fallback){
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function getRuntime(){
    return global.OptimizerRuntime && global.OptimizerRuntime.loaded ? global.OptimizerRuntime : null;
  }

  function getStats(unit){
    const s = unit?.stats || {};
    return {
      atk: num(s.atk ?? unit?.atk, 0),
      hp: num(s.hp ?? unit?.hp, 0),
      spd: num(s.spd ?? unit?.spd, 0),
      cost: Math.max(1, num(s.cost ?? unit?.cost, 1)),
    };
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
    return new Set([
      ...asArray(unit?.derivedTags),
      ...asArray(unit?.tags),
    ].map(String).map(s => s.trim()).filter(Boolean));
  }

  function tagText(unit){
    return Array.from(unitTags(unit)).join(' ').toLowerCase();
  }

  function hasAnyTag(unit, needles){
    const tags = unitTags(unit);
    const text = Array.from(tags).join(' ').toLowerCase();
    return needles.some(needle => tags.has(needle) || text.includes(String(needle).toLowerCase()));
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

    const mergedTags = mergeUnique(
      asArray(abilityEnriched.derivedTags),
      asArray(abilityEnriched.tags),
      tagsFromRuntimeRow(tagRow),
      aiTags
    );

    const abilityScore = Number(abilityEnriched?.__abilityPower?.score || 0);

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
      },
    };
  }

  function enrichOwnedUnits(ownedUnits){
    const runtime = getRuntime();
    if (!runtime) return ownedUnits || [];

    const indexes = {
      tags: indexRuntimeTags(runtime),
      characters: indexRuntimeCharacters(runtime),
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
    if (hasAnyTag(unit, ['role_dps','execute','charge','burn_synergy','poison_synergy','sleep_synergy','stun_synergy'])) score += 1800;
    if (hasAnyTag(unit, ['role_support','heal','revive','purify','spirit_gain'])) score += 1200;
    if (hasAnyTag(unit, ['role_control','tu_manip','stun_apply','sleep_apply','weaken','dispel'])) score += 1100;
    if (hasAnyTag(unit, ['role_tank','guard','damage_reduction','hold_ground','barrier'])) score += 900;
    if (hasAnyTag(unit, ['target_all_enemies','target_multi_enemy','ai_finisher'])) score += 650;
    return score;
  }

  function nativeUnitScore(unit, options){
    const s = getStats(unit);
    const base = (s.atk * 0.42) + (s.spd * 800) + (s.hp * 0.08) + ((s.atk / s.cost) * 0.12);
    const ability = num(unit?.optimizerPowerScore || unit?.__runtimeV2?.abilityScore || 0, 0) * 900;
    return base + ability + roleScore(unit) + presetScore(unit, options?.presetTag) + archetypeScore(unit, options?.archetypes);
  }

  function sortedCandidates(units, options){
    return [...asArray(units)].sort((a, b) => {
      const diff = nativeUnitScore(b, options) - nativeUnitScore(a, options);
      if (diff) return diff;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
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

  function fillSlots(size, lockedRow, lockedFlags, pool, used){
    const out = Array(size).fill('');
    for (let i = 0; i < size; i++) {
      const lockedId = String(lockedRow?.[i] || '');
      if (lockedFlags?.[i] && lockedId) {
        out[i] = lockedId;
        used.add(lockedId);
      }
    }
    for (let i = 0; i < size; i++) {
      if (out[i]) continue;
      const next = pool.find(u => {
        const id = String(u?.id || '');
        return id && !used.has(id);
      });
      if (!next) break;
      const id = String(next.id);
      out[i] = id;
      used.add(id);
    }
    return out;
  }

  function buildNativeStory(enriched, options){
    const ranked = sortedCandidates(enriched, options);
    const layout = options?.currentLayout || {};
    const locks = options?.slotLocks || {};
    const used = new Set();
    const main = fillSlots(STORY_MAIN_SIZE, layout.storyMain || [], locks.storyMain || [], ranked, used);
    const back = fillSlots(STORY_BACK_SIZE, layout.storyBack || [], locks.storyBack || [], ranked, used);
    return { main, back };
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
    let score = units.reduce((sum, u) => sum + nativeUnitScore(u, options), 0);
    const combined = units.map(tagText).join(' ');
    for (const key of Object.keys(PRESET_RULES)) {
      const rules = PRESET_RULES[key];
      const hits = rules.filter(rule => combined.includes(rule)).length;
      if (hits >= 2) score += hits * 700;
    }
    const elems = elementCounts(ids, byId);
    const maxElem = Math.max(0, ...Array.from(elems.values()));
    const mode = options?.doctrineOverrides?.monoVsRainbow?.selectionMode || options?.teamType || 'auto';
    if (mode === 'force_mono') score += maxElem * 900;
    else if (mode === 'force_rainbow') score += elems.size * 700;
    else if (maxElem >= 3) score += maxElem * 250;
    return score;
  }

  function pickTeam(pool, used, options, lockedRow, lockedFlags){
    const ranked = sortedCandidates(pool, options);
    const ids = fillSlots(PLATOON_SIZE, lockedRow || [], lockedFlags || [], ranked, used);
    const byId = new Map(asArray(pool).map(u => [String(u.id || ''), u]));
    return {
      units: ids,
      score: teamSynergyScore(ids, byId, options),
    };
  }

  function buildNativePlatoons(enriched, options){
    const layout = options?.currentLayout || {};
    const locks = options?.slotLocks || {};
    const used = new Set(lockedIdsForStory(options));
    const ranked = sortedCandidates(enriched, options);
    const platoons = [];

    for (let p = 0; p < PLATOON_COUNT; p++) {
      const row = asArray(layout.platoons?.[p]).slice(0, PLATOON_SIZE);
      const flags = asArray(locks.platoons?.[p]).slice(0, PLATOON_SIZE);
      const team = pickTeam(ranked, used, options, row, flags);
      platoons.push({
        name: `Platoon ${p + 1}`,
        units: team.units,
        score: team.score,
      });
    }

    return platoons;
  }

  function buildNativeResult(enriched, options, runtime){
    const story = buildNativeStory(enriched, options || {});
    const platoons = buildNativePlatoons(enriched, options || {});
    const totalScore = story.main.concat(story.back).reduce((sum, id) => {
      const unit = enriched.find(u => String(u.id || '') === String(id || ''));
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
