/* abilityScoreEngine.js — migration scoring helpers for optimizer V2
   Uses optimizer_ability_graph runtime chunk when present.
*/

(function(global){
  'use strict';

  function asArray(value){ return Array.isArray(value) ? value : []; }
  function norm(value){
    return String(value || '')
      .toLowerCase()
      .replace(/[\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  function getRuntime(){
    return global.OptimizerRuntime && global.OptimizerRuntime.loaded ? global.OptimizerRuntime : null;
  }

  function getAbilityGraph(runtime){
    return runtime?.chunks?.abilityGraph || null;
  }

  function getCharacterLinks(unit, graph){
    if (!unit || !graph || !graph.characterAbilityLinks) return null;
    const links = graph.characterAbilityLinks;
    const keys = [unit.id, unit.sourceId, unit.family, unit.name, unit.title]
      .map(norm)
      .filter(Boolean);
    for (const [key, value] of Object.entries(links)) {
      const k = norm(key);
      if (keys.includes(k)) return value;
    }
    return null;
  }

  function getAbilityNodeByRecordId(graph, recordId){
    if (!graph || !graph.abilityNodes || !recordId) return null;
    const target = norm(recordId);
    for (const node of Object.values(graph.abilityNodes)) {
      if (!node || typeof node !== 'object') continue;
      if (norm(node.recordId) === target || norm(node.nodeId) === target) return node;
    }
    return null;
  }

  function linkedAbilityNodes(unit, graph){
    const link = getCharacterLinks(unit, graph);
    if (!link) return [];
    const refs = [
      ...asArray(link.abilityRefs),
      ...asArray(link.fuzzyRefs).map(ref => ({...ref, value: ref.matchedRecordId || ref.value})),
    ];
    const nodes = [];
    const seen = new Set();
    for (const ref of refs) {
      const node = getAbilityNodeByRecordId(graph, ref.value || ref.matchedRecordId);
      if (!node || seen.has(node.nodeId)) continue;
      seen.add(node.nodeId);
      nodes.push(node);
    }
    return nodes;
  }

  function numericPowerFromNode(node){
    let score = 0;
    for (const row of asArray(node?.numericScalers)) {
      const value = Number(row?.value || 0);
      const path = String(row?.path || '').toLowerCase();
      if (!Number.isFinite(value)) continue;

      let weight = 0.05;
      if (path.includes('damage') || path.includes('attack')) weight = 0.12;
      if (path.includes('multiplier') || path.includes('scale') || path.includes('scaler')) weight = 0.18;
      if (path.includes('boost') || path.includes('bonus') || path.includes('increase')) weight = 0.14;
      if (path.includes('tu')) weight = 0.08;
      if (path.includes('spirit')) weight = 0.10;
      if (path.includes('hp')) weight = 0.06;

      score += Math.min(Math.abs(value) * weight, 1200);
    }
    return score;
  }

  function effectPowerFromNode(node){
    const tags = new Set(asArray(node?.effectTags).map(norm));
    let score = 0;
    if (tags.has('damage')) score += 400;
    if (tags.has('scaler')) score += 350;
    if (tags.has('heal')) score += 280;
    if (tags.has('spirit')) score += 250;
    if (tags.has('tu') || tags.has('turn')) score += 300;
    if (tags.has('summon')) score += 260;
    if (tags.has('guardian') || tags.has('protect')) score += 240;
    if (tags.has('burn') || tags.has('poison') || tags.has('sleep') || tags.has('stun')) score += 220;
    if (tags.has('leader')) score += 180;
    return score;
  }

  function scoreUnitAbilityPower(unit){
    const runtime = getRuntime();
    const graph = getAbilityGraph(runtime);
    if (!graph) return { score: 0, linkedAbilities: 0, scalerCount: 0, tags: [] };

    const nodes = linkedAbilityNodes(unit, graph);
    let score = 0;
    let scalerCount = 0;
    const tags = new Set();

    for (const node of nodes) {
      score += numericPowerFromNode(node);
      score += effectPowerFromNode(node);
      scalerCount += asArray(node.numericScalers).length;
      asArray(node.effectTags).forEach(tag => tags.add(String(tag)));
    }

    return {
      score,
      linkedAbilities: nodes.length,
      scalerCount,
      tags: Array.from(tags),
    };
  }

  function enrichUnitWithAbilityPower(unit){
    const abilityPower = scoreUnitAbilityPower(unit);
    const runtimeTags = [];
    if (abilityPower.linkedAbilities) runtimeTags.push('ability_graph_linked');
    if (abilityPower.scalerCount) runtimeTags.push('ability_scaler_known');
    abilityPower.tags.forEach(tag => runtimeTags.push('ability_effect_' + norm(tag)));

    const mergedTags = Array.from(new Set([
      ...asArray(unit.derivedTags),
      ...asArray(unit.tags),
      ...runtimeTags,
    ].filter(Boolean)));

    return {
      ...unit,
      derivedTags: mergedTags,
      tags: mergedTags,
      __abilityPower: abilityPower,
    };
  }

  global.AbilityScoreEngine = {
    scoreUnitAbilityPower,
    enrichUnitWithAbilityPower,
  };
})(window);
