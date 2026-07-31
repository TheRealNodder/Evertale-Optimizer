(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,M=root.localMeta,F=root.featureModel,T=root.teamEvaluator,R=root.resourceReasoner,X=root.explanations;
  if(!P||!M||!F||!T||!R||!X)return;

  function assert(condition,message){if(!condition)throw new Error(message);}
  function unit(id,element='Fire',extra={}){
    return{id,sourceId:id,family:id.replace(/\d+$/,''),name:id,element,stats:{atk:1000,hp:5000,spd:100,cost:20},...extra};
  }
  function evidence(feature,strength=1.4,confidence=.98,source='raw.activeSkills[0]'){
    return{feature,strength,confidence,sources:[source]};
  }
  function makeTeam(prefix='Unit'){
    return Array.from({length:8},(_,index)=>unit(`${prefix}${String.fromCharCode(65+index)}01`,['Fire','Water','Storm','Earth'][index%4]));
  }
  function skill(id,extra={}){return{id,name:id,description:'',tuCost:100,spiritGain:0,spiritCost:0,useLimit:null,targeting:'1Enemy',useCondition:'',flags:[],components:['Damage'],source:`resolved.activeSkills.${id}`,...extra};}
  function skillStore(units,skillsById={}){const out={};for(const row of units)out[row.sourceId]={sourceId:row.sourceId,family:row.family,skills:skillsById[row.sourceId]||[skill(`Attack${row.sourceId}`)]};return out;}
  function withStore(store,units,profiles={},options={}){
    const previous=g.OptimizerRuntime;
    g.OptimizerRuntime={...(previous||{}),chunks:{...(previous?.chunks||{}),featureEvidence:store,skillProfiles:profiles}};
    const attached=F.attach(units,options);
    g.OptimizerRuntime=previous;
    return attached;
  }
  function expectedFailure(run){const original=console.error;console.error=()=>{};try{return run();}finally{console.error=original;}}

  function run(){
    const results=[];
    const test=(name,fn)=>{try{results.push({name,pass:true,detail:fn()||'pass'});}catch(error){results.push({name,pass:false,detail:String(error?.message||error)});}};

    test('policy locks team sizes and score ranges',()=>{
      assert(P.story.main===5&&P.story.back===3&&P.story.total===8,'Story contract changed');
      assert(P.platoons.rows===20&&P.platoons.size===5,'Platoon contract changed');
      assert(P.story.leaderStacking==='best_only'&&P.story.leaderScope===8,'Leader contract changed');
      return '5+3 Story, 20x5 platoons, leader all-eight best-only';
    });

    test('search intelligence profiles increase monotonically',()=>{
      const standard=P.intelligenceProfile('standard'),deep=P.intelligenceProfile('deep'),ultra=P.intelligenceProfile('ultra');
      for(const field of ['storyBeamWidth','storyCandidateCap','storyPlacementFinalists','placementCombinations','platoonRowsPerPlan','allocatorPoolSize','allocationBudgetMs']){
        assert(standard[field]<deep[field]&&deep[field]<ultra[field],`${field} is not monotonic across intelligence profiles`);
      }
      assert(P.intelligenceProfile({}).level==='deep','Deep is not the balanced default search intelligence');
      return `beam ${standard.storyBeamWidth} -> ${deep.storyBeamWidth} -> ${ultra.storyBeamWidth}`;
    });

    test('auto tournament probes every complete plan before deep refinement',()=>{
      const prepared=withStore({},makeTeam('Tournament'));
      const contest=root.engine.tournament(prepared,{searchIntelligence:'deep',requirePlanComplete:false,buildScope:'story'});
      assert(contest.diagnostics.useProbe&&contest.diagnostics.probeLevel==='probe','Deep auto tournament skipped the bounded probe pass');
      assert(contest.diagnostics.refinedCandidates===2,'Deep auto tournament did not refine its top two finalists');
      assert(contest.diagnostics.completeCandidates>=3,'Auto tournament did not preserve complete alternatives');
      return `${contest.diagnostics.completeCandidates} complete probes, ${contest.diagnostics.refinedCandidates} refined`;
    });

    test('result cache ignores unlocked layout churn but tracks locked identity',()=>{
      const units=makeTeam('Cache'),locks={
        storyMain:[true,false,false,false,false],storyBack:[false,false,false],
        platoons:Array.from({length:20},()=>Array(5).fill(false))
      };
      const options=id=>({
        buildScope:'story',searchIntelligence:'deep',slotLocks:locks,
        currentLayout:{storyMain:[id,'A','B','C','D'],storyBack:['E','F','G'],platoons:Array.from({length:20},()=>Array(5).fill(''))}
      });
      const first=root.controller.cacheKey(units,options('CacheA01'));
      const unlockedChanged=options('CacheA01');unlockedChanged.currentLayout.storyMain[1]='ChangedUnlocked01';
      const second=root.controller.cacheKey(units,unlockedChanged);
      const lockedChanged=root.controller.cacheKey(units,options('CacheB01'));
      assert(first===second,'Unlocked optimizer output invalidated the deterministic result cache');
      assert(first!==lockedChanged,'Changing a locked identity failed to invalidate the result cache');
      return 'unlocked layout stable; locked identity invalidates';
    });

    test('local latest-unit snapshot is schema and data-version bound',()=>{
      const bundle={generatedAt:123,contentHash:'fixture',entries:[
        {family:'NewestFamily',order:100,name:'Newest',title:'Drop',rarity:'SSR',states:[{sourceId:'NewestFamily01'},{sourceId:'NewestFamily02'}]},
        {family:'RecentFamily',order:99,name:'Recent',title:'Drop',rarity:'SSR',states:[{sourceId:'RecentFamily01'}]},
        {family:'OlderFamily',order:1,name:'Older',title:'Unit',rarity:'SSR',states:[{sourceId:'OlderFamily01'}]}
      ]};
      const snapshot=M.buildSnapshot(bundle,{dataVersion:'fixture-v1',cachedAt:456});
      assert(M.validateSnapshot(snapshot,{dataVersion:'fixture-v1'}).valid,'Valid local snapshot was rejected');
      assert(!M.validateSnapshot(snapshot,{dataVersion:'fixture-v2'}).valid,'Stale data-version snapshot remained valid');
      assert(snapshot.maxOrder===100&&snapshot.scoresByIdentity.newestfamily01>0,'Snapshot lost global order or source identity');
      assert(!M.engineOptions(snapshot,false,{dataVersion:'fixture-v1'}).enabled,'Advisory snapshot applied without explicit opt-in');
      assert(M.engineOptions(snapshot,true,{dataVersion:'fixture-v1'}).enabled,'Valid opted-in snapshot did not produce engine options');
      return `${snapshot.latest.length} records, max order ${snapshot.maxOrder}`;
    });

    test('advisory recency applies only after opt-in and stays bounded',()=>{
      const raw=[unit('RecentMeta01','Fire',{__v5:{meta:{order:90,newer:.2}}})];
      const disabled=withStore({},raw,{},{
        advisoryMeta:{enabled:false,schemaVersion:1,maxOrder:100,scoresByIdentity:{recentmeta01:100}}
      })[0].__v6;
      const enabled=withStore({},raw,{},{
        advisoryMeta:{enabled:true,schemaVersion:1,maxOrder:100,source:'generated-release-order',confidence:.76,scoresByIdentity:{recentmeta01:100}}
      })[0].__v6;
      assert(disabled.metaPrior===20,'Disabled advisory changed generated recency');
      assert(enabled.metaPrior>disabled.metaPrior&&enabled.metaPrior<=100,'Enabled advisory was missing or unbounded');
      assert(enabled.metaEvidence.applied&&enabled.metaEvidence.source==='generated-release-order','Advisory provenance is missing');
      return `${disabled.metaPrior.toFixed(1)} disabled -> ${enabled.metaPrior.toFixed(1)} enabled`;
    });

    test('element affinity cannot create a status engine',()=>{
      const fire=withStore({},[unit('AffinityOnly01','Fire')])[0];
      assert(F.mechanical(fire.__v6.evidence,'burn','setup')===0,'Fire affinity invented burn setup');
      assert(fire.__v6.evidence.affinities.burn>0,'Expected bounded Fire affinity signal');
      return 'Fire affinity is support-only';
    });

    test('incidental skip lists are rejected as evidence',()=>{
      const trap=withStore({Trap01:[evidence('applies_burn',1.6,.98,'resolved.activeSkills.X.revengeEffectsToSkip[4]')]},[unit('Trap01')])[0];
      assert(F.mechanical(trap.__v6.evidence,'burn','setup')===0,'Rejected skip-list reference became setup');
      return 'revengeEffectsToSkip provenance rejected';
    });

    test('AI, Frostburn, and healthy substrings cannot invent features',()=>{
      const raw=[unit('FrostOnly01','Water'),unit('FrostPayoff01','Water'),unit('AiHint01','Storm'),unit('HealthyOnly01','Light')],store={
        FrostOnly01:[evidence('applies_burn',1.6,.98,'resolved.activeSkills.FrostburnAttack.localization.description')],
        FrostPayoff01:[evidence('payoff_burn',1.5,.98,'resolved.activeSkills.FrostburnDrive.localization.description')],
        AiHint01:[evidence('payoff_stun',1.5,.98,'resolved.activeSkillsAI.0.ai.EnemyHasTimestrikerNoProtector')],
        HealthyOnly01:[evidence('role_healer',1.25,.98,'resolved.activeSkills.HighSpiritHealthyBlast#identifier')]
      },prepared=withStore(store,raw);
      assert(F.mechanical(prepared[0].__v6.evidence,'burn','setup')===0,'Frostburn became normal Burn setup');
      assert(F.mechanical(prepared[1].__v6.evidence,'burn','payoff')===0,'Frostburn became normal Burn payoff');
      assert(F.mechanical(prepared[2].__v6.evidence,'stun','payoff')===0,'AI target hint became Stun payoff');
      assert(F.roleEvidence(prepared[3].__v6.evidence,'healer')===0,'healthy substring became healing');
      return 'context-invalid evidence rejected';
    });

    test('cross-element direct evidence remains authoritative',()=>{
      const water=withStore({WaterBurn01:[evidence('applies_burn',1.6,.98,'resolved.activeSkills.WardBurnAlly#identifier')]},[unit('WaterBurn01','Water')])[0];
      assert(F.mechanical(water.__v6.evidence,'burn','setup')>0,'Direct cross-element Burn evidence was discarded');
      assert(!water.__v6.evidence.affinities.burn,'Water received Fire-only affinity');
      return 'mechanics outrank element without inventing affinity';
    });

    test('V6 auto plan selection ignores legacy Frostburn keyword bias',()=>{
      const raw=[unit('SleepSetup01','Water'),unit('SleepPayoff01','Water'),unit('SleepSupport01','Light')];
      const prepared=withStore({
        SleepSetup01:[evidence('applies_sleep')],
        SleepPayoff01:[evidence('payoff_sleep')],
        SleepSupport01:[evidence('applies_sleep'),evidence('payoff_sleep')]
      },raw);
      const previous=g.OptimizerV5Lab;
      g.OptimizerV5Lab={candidatePool:{selectPlan:()=> 'burn'}};
      const plan=root.engine.selectedPlan({presetTag:'auto'},prepared);
      g.OptimizerV5Lab=previous;
      assert(plan==='sleep',`expected sleep from V6 evidence, got ${plan}`);
      return`${plan} selected from authoritative V6 evidence`;
    });

    test('all evaluator components and penalties are bounded',()=>{
      const raw=makeTeam('Bounded');
      const store={};raw.forEach((row,index)=>store[row.sourceId]=[evidence(index%2?'payoff_burn':'applies_burn'),evidence(index%3?'role_healer':'role_guardian')]);
      const report=T.evaluate(withStore(store,raw),{plan:'burn',format:'auto'});
      assert(report.valid,'Expected valid bounded fixture');
      assert([...Object.values(report.components),...Object.values(report.penalties)].every(value=>value>=0&&value<=100),'Unbounded component found');
      assert(report.score>=0&&report.score<=100,'Unbounded team score');
      return `score ${report.score.toFixed(2)}`;
    });

    test('leader evaluation uses selected eight and best-only stacking',()=>{
      const raw=makeTeam('Leader');
      raw[0].leaderSkill={internalId:'AllAllies20Percent',description:'All allies gain 20% Attack'};
      raw[1].leaderSkill={internalId:'FireAllies30Percent',description:'Fire allies gain 30% Attack'};
      const attached=withStore({},raw),leader=T.leaderValue(attached);
      assert(leader.stacking==='best_only'&&leader.scope===8,'Leader stacking/scope incorrect');
      assert(leader.selected&&leader.candidates.length===2,'Expected two candidates and one selected leader');
      assert(leader.selected.scope===8,'Selected leader did not evaluate all eight');
      return `${leader.selected.unitId} selected from ${leader.candidates.length}`;
    });

    test('coherent rainbow requires four contributing elements',()=>{
      const raw=makeTeam('Rainbow'),store={};
      const features=['applies_burn','payoff_burn','role_guardian','tempo_turn'];
      raw.forEach((row,index)=>store[row.sourceId]=[evidence(features[index%4])]);
      const report=T.evaluate(withStore(store,raw),{plan:'hybrid',format:'force_rainbow',strictFormat:true,requirePlanComplete:false});
      assert(report.valid,`Coherent four-element rainbow was rejected: ${report.errors.join('; ')} / ${JSON.stringify(report.element)}`);
      assert(report.element.contributingElements.length>=4,'Rainbow contribution count is below four');
      return `${report.element.distinctElements} elements, ${report.element.contributingElements.length} contributing`;
    });

    test('color-only rainbow is rejected',()=>{
      const raw=makeTeam('ColorOnly'),store={};
      raw.forEach((row,index)=>{if(index%4<3)store[row.sourceId]=[evidence(['applies_burn','payoff_burn','role_guardian'][index%4])];});
      const report=T.evaluate(withStore(store,raw),{plan:'hybrid',format:'force_rainbow',strictFormat:true,requirePlanComplete:false});
      assert(!report.valid,'Color-only fourth element passed strict rainbow');
      assert(report.element.distinctElements===4&&report.element.contributingElements.length===3,`Fixture did not isolate color-only contribution: ${JSON.stringify(report.element)}`);
      return 'four colors present, only three mechanically contributing';
    });

    test('newer neutral unit cannot replace mandatory setup',()=>{
      const raw=makeTeam('Mandatory'),store={};
      store[raw[0].sourceId]=[evidence('applies_burn')];store[raw[1].sourceId]=[evidence('payoff_burn')];
      const complete=withStore(store,raw);
      const neutral=unit('NewestNeutral01','Fire',{stats:{atk:999999,hp:999999,spd:999,cost:1}});
      const replaced=withStore(store,[neutral,...raw.slice(1)]);
      const good=T.evaluate(complete,{plan:'burn',format:'auto',metaWeight:'strong'}),bad=T.evaluate(replaced,{plan:'burn',format:'auto',metaWeight:'strong'});
      assert(good.valid,'Complete mechanical team was rejected');
      assert(!bad.valid&&bad.score===0,'Neutral newer unit overrode mandatory setup');
      return 'mechanical completeness remains mandatory at strong newer-unit weight';
    });

    test('newer-unit weighting is configurable and bounded',()=>{
      const older=makeTeam('OlderMeta').map(row=>({...row,__v5:{meta:{newer:0}}}));
      const newer=makeTeam('NewerMeta').map(row=>({...row,__v5:{meta:{newer:1}}}));
      const oldTeam=withStore({},older),newTeam=withStore({},newer),evaluate=(team,metaWeight)=>T.evaluate(team,{plan:'hybrid',format:'auto',metaWeight,requirePlanComplete:false});
      const offOld=evaluate(oldTeam,'off'),offNew=evaluate(newTeam,'off'),balancedOld=evaluate(oldTeam,'balanced'),balancedNew=evaluate(newTeam,'balanced'),strongOld=evaluate(oldTeam,'strong'),strongNew=evaluate(newTeam,'strong');
      const balancedGain=balancedNew.score-balancedOld.score,strongGain=strongNew.score-strongOld.score;
      assert(Math.abs(offNew.score-offOld.score)<.001,'Off mode still changed score by release recency');
      assert(balancedGain>0&&strongGain>balancedGain,'Higher setting did not increase the bounded recency preference');
      assert(strongNew.metaWeighting.scoreWeight===.10&&strongNew.componentWeights.boundedMetaPrior===.10,'Strong mode exceeded or missed the 10% contract');
      assert(strongNew.score<=100,'Strong meta weighting escaped the normalized score range');
      return `off ${offNew.score.toFixed(2)}, balanced gain ${balancedGain.toFixed(2)}, strong gain ${strongGain.toFixed(2)}`;
    });

    test('strong newer-unit weight preserves unique safety and leader value',()=>{
      const compare=({feature,leader=false})=>{
        const raw=makeTeam(`Required${feature||'Leader'}`),store={};
        if(feature)store[raw[0].sourceId]=[evidence(feature)];
        if(leader)raw[0].leaderSkill={internalId:'AllAllies20Percent',description:'All allies gain 20% Attack'};
        raw[0].__v5={meta:{newer:0}};
        const neutral=unit(`NewestNeutral${feature||'Leader'}01`,raw[0].element,{__v5:{meta:{newer:1}}});
        const good=T.evaluate(withStore(store,raw),{plan:'hybrid',format:'auto',metaWeight:'strong',requirePlanComplete:false});
        const bad=T.evaluate(withStore(store,[neutral,...raw.slice(1)]),{plan:'hybrid',format:'auto',metaWeight:'strong',requirePlanComplete:false});
        assert(good.score>bad.score,`Strong recency displaced unique ${feature||'leader'} value`);
      };
      compare({feature:'role_guardian'});compare({feature:'role_cleanser'});compare({leader:true});
      return 'guardian, cleanser, and leader contributions remain ahead of a neutral newer replacement';
    });

    test('structured Spirit facts produce an evidence-backed opening forecast',()=>{
      const raw=makeTeam('Spirit');raw[0].stats.spd=220;raw[1].stats.spd=180;
      const store={
        [raw[0].sourceId]:[evidence('resource_spirit',1.3,.98,'resolved.activeSkills.GainTwo#identifier')],
        [raw[1].sourceId]:[evidence('payoff_burn',1.5,.98,'resolved.activeSkills.BurnPayoff#identifier')]
      };
      const profiles=skillStore(raw,{[raw[0].sourceId]:[skill('GainTwo',{tuCost:80,spiritGain:2})],[raw[1].sourceId]:[skill('BurnPayoff',{tuCost:100,spiritCost:3})]});
      const forecast=R.teamForecast(withStore(store,raw,profiles),'burn');
      assert(forecast.source==='structured-skill-profiles','Structured authority was not used');
      assert(forecast.minimumReserve===1&&forecast.generatorBeforeSpender===true,`Unexpected forecast: ${JSON.stringify(forecast)}`);
      assert(forecast.openingSequence[0].skillId==='GainTwo','Speed-ordered generator was not first');
      return `reserve ${forecast.minimumReserve}, opening ${forecast.openingSequence.map(row=>row.skillId).join(' -> ')}`;
    });

    test('Spirit sequencing rewards generator before spender',()=>{
      const build=(generatorSpeed,spenderSpeed)=>{
        const raw=makeTeam('Order');raw[0].stats.spd=generatorSpeed;raw[1].stats.spd=spenderSpeed;
        const profiles=skillStore(raw,{[raw[0].sourceId]:[skill('Generator',{spiritGain:2})],[raw[1].sourceId]:[skill('Spender',{spiritCost:3})]});
        return R.teamForecast(withStore({},raw,profiles),'hybrid');
      };
      const good=build(220,180),bad=build(180,220);
      assert(good.minimumReserve<bad.minimumReserve,'Ordering did not change required reserve');
      assert(good.score>bad.score,'Resource score did not reward safer sequencing');
      return `${good.score.toFixed(1)} before vs ${bad.score.toFixed(1)} after`;
    });

    test('multiple high-cost opening actions raise a visible warning',()=>{
      const raw=makeTeam('Pressure'),profiles=skillStore(raw,{
        [raw[0].sourceId]:[skill('CostlyOne',{spiritCost:3})],
        [raw[1].sourceId]:[skill('CostlyTwo',{spiritCost:4})]
      });
      const forecast=R.teamForecast(withStore({},raw,profiles),'hybrid');
      assert(forecast.competingHighCostActions===2,'High-cost actions were not counted');
      assert(forecast.warnings.some(value=>/compete for Spirit/.test(value)),'Conflict warning was omitted');
      return forecast.warnings.join(' ');
    });

    test('team explanation cites only structured skills and exposes receipts',()=>{
      const raw=makeTeam('Explain'),store={};
      store[raw[0].sourceId]=[evidence('applies_burn',1.6,.98,'resolved.activeSkills.Ignite#identifier')];
      store[raw[1].sourceId]=[evidence('payoff_burn',1.5,.98,'resolved.activeSkills.BurnBlast#identifier')];
      const profiles=skillStore(raw,{[raw[0].sourceId]:[skill('Ignite',{spiritGain:1})],[raw[1].sourceId]:[skill('BurnBlast',{spiritCost:2})]});
      const team=withStore(store,raw,profiles),evaluation=T.evaluate(team,{plan:'burn',format:'auto'}),report=X.explain(team,evaluation,{plan:'burn',format:'hybrid'});
      const allowed=new Set(Object.values(profiles).flatMap(row=>row.skills.map(value=>value.id)));
      assert(report.openingSequence.every(action=>allowed.has(action.skillId)),'Explanation invented a skill');
      assert(report.receipts.length===Object.keys(evaluation.components).length,'Score receipts are incomplete');
      assert(report.method==='deterministic-evidence-reasoning','Explanation method is not explicit');
      return `${report.openingSequence.length} sourced actions, ${report.receipts.length} receipts`;
    });

    test('missing runtime authority fails without fallback',()=>{
      const previous=g.OptimizerRuntime;g.OptimizerRuntime={contracts:{optimizerFoundationReady:false},chunks:{}};
      const report=expectedFailure(()=>root.engine.run(makeTeam('MissingRuntime'),{buildScope:'story',presetMode:'hard',presetTag:'burn'}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&report.diagnostics.usedFallback===false,'Missing runtime did not fail safely');
      return report.engineVersion;
    });

    test('insufficient roster fails without changing format contracts',()=>{
      const previous=g.OptimizerRuntime;g.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:{},skillProfiles:{}}};
      const report=expectedFailure(()=>root.engine.run(makeTeam('Short').slice(0,7),{buildScope:'story',presetMode:'hard',presetTag:'burn'}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&/Insufficient owned roster/.test(report.diagnostics.v6Error),'Insufficient roster was concealed');return report.diagnostics.v6Error;
    });

    test('invalid locked unit is reported and V4 remains unused',()=>{
      const raw=makeTeam('BadLock'),store={};raw.forEach((row,index)=>store[row.sourceId]=[evidence(index%2?'payoff_burn':'applies_burn')]);const prepared=withStore(store,raw),previous=g.OptimizerRuntime;
      g.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:store,skillProfiles:{}}};const report=expectedFailure(()=>root.engine.run(prepared,{preparedV6:true,buildScope:'story',presetMode:'hard',presetTag:'burn',currentLayout:{storyMain:['MissingUnit','','','',''],storyBack:['','','']},slotLocks:{storyMain:[true,false,false,false,false],storyBack:[false,false,false]}}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&report.diagnostics.usedFallback===false&&/Locked Story unit/.test(report.diagnostics.v6Error),'Invalid lock did not fail explicitly');return report.diagnostics.v6Error;
    });

    const failed=results.filter(row=>!row.pass);
    return{passed:results.length-failed.length,failed:failed.length,total:results.length,results,policyVersion:P.version};
  }

  root.regressionFixtures={run};
  g.runOptimizerV6RegressionFixtures=run;
})(window);
