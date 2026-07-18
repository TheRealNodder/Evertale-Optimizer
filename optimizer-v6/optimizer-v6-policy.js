(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
  const txt=value=>String(value??'').trim();
  const key=value=>txt(value).toLowerCase().replace(/[\u2019']/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');

  const policy={
    version:'optimizer-v6-policy-5',
    story:{main:5,back:3,total:8,leaderScope:8,leaderStacking:'best_only'},
    platoons:{rows:20,size:5,storyExcluded:true,allowBlankAfterExhaustion:true},
    elements:['fire','water','storm','earth','light','dark'],
    rainbow:{preferredDistinct:4,minimumContribution:0.18},
    mono:{strictWhenFeasible:true},
    search:{storyBeamWidth:32,storyCandidateCap:40,storyPlacementFinalists:6,placementCombinations:3,alternatives:5,platoonRowsPerPlan:8},
    timeBudgetMs:{storyFirst:500,storyFinal:2000,platoonsUseful:3000,platoonsFinal:9000},
    evidence:{
      minimumMechanicalConfidence:0.8,
      minimumRoleConfidence:0.72,
      elementAffinityMaximum:0.12,
      rejectedSourceFragments:['revengeeffectstoskip','immunitylist','excludedbuffs','activeskillsai']
    },
    metaWeighting:{
      defaultLevel:'balanced',
      levels:{
        off:{scoreWeight:0,searchWeight:0,candidateReserve:0},
        balanced:{scoreWeight:0.05,searchWeight:0.05,candidateReserve:0.10},
        strong:{scoreWeight:0.10,searchWeight:0.10,candidateReserve:0.20}
      }
    },
    componentWeights:{
      baseUnitValue:0.16,
      engineCompletion:0.15,
      roleCoverage:0.12,
      resourceBalance:0.08,
      pairSynergy:0.10,
      groupSynergy:0.07,
      leaderValue:0.09,
      positionFlow:0.07,
      elementStrategy:0.07,
      counterCoverage:0.05,
      boundedMetaPrior:0,
      evidenceConfidence:0.02
    },
    penaltyWeights:{
      statusConflicts:0.05,
      roleRedundancy:0.04,
      resourceConflicts:0.04,
      unsupportedPayoffs:0.08,
      planDilution:0.07,
      evidenceUncertainty:0.04
    },
    plans:['burn','poison','sleep','stun','blood','crisis','survivor','guardian','tempo','hybrid'],
    policyChecks:{
      story5Main3Back:true,
      platoons20x5:true,
      leaderAll8BestOnly:true,
      rainbowMinimum4:true,
      strictDuplicateIdentity:true,
      noElementOnlyEngine:true,
      noSilentV4Fallback:true
    }
  };

  function identity(unit){
    const v5=unit?.__v5?.identity||{};
    const source=txt(unit?.sourceId||unit?.internal?.sourceId||unit?.id);
    return{
      entry:key(v5.entry||unit?.entryKey||unit?.entry||source),
      family:key(v5.family||unit?.family||unit?.internal?.family||source.replace(/\d+$/,'')),
      name:key(v5.name||[unit?.name,unit?.title].filter(Boolean).join(' ')||source),
      sourceId:key(source),
      id:txt(unit?.id||source)
    };
  }

  function identityConflicts(a,b){
    const left=identity(a),right=identity(b);
    return ['entry','family','name'].some(field=>left[field]&&right[field]&&left[field]===right[field]);
  }

  function distinctIdentity(units){
    const rows=Array.isArray(units)?units:[];
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(identityConflicts(rows[i],rows[j]))return false;
    return true;
  }

  function boundedComponents(components){
    return Object.fromEntries(Object.entries(components||{}).map(([name,value])=>[name,clamp(value)]));
  }

  function metaProfile(options={}){
    const aliases={none:'off',disabled:'off',normal:'balanced',default:'balanced',high:'strong',enabled:'balanced'};
    const raw=typeof options==='string'?options:options?.metaWeight;
    const requested=aliases[key(raw)]||key(raw),level=policy.metaWeighting.levels[requested]?requested:policy.metaWeighting.defaultLevel;
    return{level,...policy.metaWeighting.levels[level]};
  }

  root.policy={...policy,clamp,txt,key,identity,identityConflicts,distinctIdentity,boundedComponents,metaProfile};
})(window);
