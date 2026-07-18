(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy;
  if(!P)return;

  const rows=value=>Array.isArray(value)?value:[];
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const rounded=value=>Math.round(num(value)*10)/10;

  function explain(team,evaluation,context={}){
    const units=rows(team),strengths=[],warnings=[],resource=evaluation?.resource||{};
    if(evaluation?.engine?.complete)strengths.push(`${evaluation.plan} setup/payoff requirements are mechanically complete.`);
    if(evaluation?.engine?.contributorCount)strengths.push(`${evaluation.engine.contributorCount} of ${units.length} units directly contribute to the selected plan.`);
    if(num(evaluation?.roles?.safety)>=50)strengths.push('Protection and sustain coverage is above the team-safety threshold.');
    if(num(evaluation?.roles?.tempo)>=50)strengths.push('The selected team has meaningful control or turn-tempo coverage.');
    if(evaluation?.leader?.selected)strengths.push(`${evaluation.leader.selected.unitId} supplies the best leader effect among the selected eight.`);
    strengths.push(...rows(resource.strengths));

    warnings.push(...rows(resource.warnings));
    for(const need of rows(evaluation?.unmetNeeds))warnings.push(`Unmet team need: ${need}.`);
    const penaltyLabels={
      statusConflicts:'Multiple status plans may overwrite or compete with one another.',
      roleRedundancy:'Role redundancy is consuming slots without full additional value.',
      resourceConflicts:'Spirit costs and opening timing create resource pressure.',
      unsupportedPayoffs:'A payoff is present without the setup it requires.',
      planDilution:'Too many selected units do not directly contribute to the forced plan.',
      evidenceUncertainty:'Some picks have incomplete or lower-confidence mechanical evidence.'
    };
    for(const [name,value] of Object.entries(evaluation?.penalties||{}))if(num(value)>=25&&penaltyLabels[name])warnings.push(`${penaltyLabels[name]} (${rounded(value)}/100)`);
    if(resource.source!=='structured-skill-profiles')warnings.push('Opening-order conclusions are limited because structured skill facts were unavailable.');

    const receipts=Object.entries(evaluation?.components||{}).map(([component,score])=>({component,score:rounded(score)})).sort((a,b)=>b.score-a.score||a.component.localeCompare(b.component));
    const distinct=Number(evaluation?.element?.distinctElements)||0;
    const summary=`${context.format||evaluation?.format||'auto'} ${context.plan||evaluation?.plan||'hybrid'} team scored ${rounded(evaluation?.score)}/100 with ${distinct} element${distinct===1?'':'s'}.`;
    return{
      schemaVersion:1,method:'deterministic-evidence-reasoning',summary,
      strengths:[...new Set(strengths)],warnings:[...new Set(warnings)],
      openingSequence:rows(resource.openingSequence).map(action=>({
        unitId:action.unitId,skillId:action.skillId,skillName:action.skillName,tuCost:action.tuCost,
        spiritGain:action.spiritGain,spiritCost:action.spiritCost,conditional:!!action.conditional,
        useCondition:action.useCondition,reason:action.reason,source:action.source
      })),
      resourceForecast:{
        source:resource.source,score:rounded(resource.score),reliableGeneration:rounded(resource.reliableGeneration),
        conditionalGeneration:rounded(resource.conditionalGeneration),plannedDemand:rounded(resource.plannedDemand),
        openingNet:resource.openingNet==null?null:rounded(resource.openingNet),minimumReserve:resource.minimumReserve==null?null:rounded(resource.minimumReserve),
        generatorBeforeSpender:resource.generatorBeforeSpender
      },
      receipts,confidence:rounded(evaluation?.components?.evidenceConfidence),policyVersion:P.version
    };
  }

  root.explanations={explain};
})(window);
