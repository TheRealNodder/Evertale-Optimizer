/* optimizerEngineV2.js — runtime-aware optimizer bridge
   Primary goal: make the new split runtime the source of truth while keeping
   the existing optimizer engine as the safe scoring fallback.
*/

(function(global){
  'use strict';

  const legacyEngine = global.OptimizerEngine || null;
  global.OptimizerEngineLegacy = legacyEngine;

  function norm(value){
    return String(value || '')
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  function asArray(value){ return Array.isArray(value) ? value : []; }

  function getRuntime(){
    return global.OptimizerRuntime && global.OptimizerRuntime.loaded ? global.OptimizerRuntime : null;
  }

  function indexRuntimeTags(runtime){
    const tags = runtime?.chunks?.tags || {};
    const out = new Map();
    if (!tags || typeof tags !== 'object') return out;

    Object.entries(tags).forEach(([key, row]) => {
      if (!row || typeof row !== 'object') return;
      const keys = [
        key,
        row.id,
        row.internalMonsterId,
        row.sourceId,
        row.family,
        row.name,
      ];
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
    if (!keys.length) return [];

    const tags = new Set();
    const add = (tag) => tags.add(tag);

    for (const source of sources) {
      const categories = source?.categories || {};
      for (const rows of Object.values(categories)) {
        for (const rawPath of asArray(rows)) {
          const pNorm = norm(rawPath);
          if (!keys.some(k => k && pNorm.includes(k))) continue;
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
    const tags = [
      ...asArray(row.derivedTags),
      ...asArray(row.tags),
      ...asArray(row.manualTags),
      ...asArray(row.runtimeTags),
    ];
    return tags.map(String).filter(Boolean);
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

    const mergedTags = mergeUnique(
      asArray(unit.derivedTags),
      asArray(unit.tags),
      tagsFromRuntimeRow(tagRow),
      aiTags
    );

    return {
      ...unit,
      family: unit.family || runtimeRow?.family || tagRow?.family || unit.id,
      sourceId: unit.sourceId || runtimeRow?.sourceId || tagRow?.sourceId || unit.id,
      derivedTags: mergedTags,
      tags: mergedTags,
      __runtimeV2: {
        hasRuntimeCharacter: !!runtimeRow,
        hasRuntimeTags: !!tagRow,
        aiTags,
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
    return (ownedUnits || []).map(u => enrichUnit(u, indexes, runtime));
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

    if (legacyEngine && typeof legacyEngine.run === 'function') {
      const result = legacyEngine.run(enriched, enrichedOptions);
      return {
        ...(result || {}),
        engineVersion: 'optimizerEngineV2-runtime-bridge',
        runtimeEnabled: !!runtime,
        runtimeFlags: runtime?.runtimeFlags || {},
      };
    }

    return {
      story: { main: enriched.slice(0, 5).map(u => u.id), back: enriched.slice(5, 8).map(u => u.id) },
      platoons: [],
      totalScore: 0,
      engineVersion: 'optimizerEngineV2-runtime-fallback',
      runtimeEnabled: !!runtime,
      runtimeFlags: runtime?.runtimeFlags || {},
    };
  }

  global.OptimizerEngineV2 = { run, enrichOwnedUnits };
  global.OptimizerEngine = global.OptimizerEngineV2;
})(window);
