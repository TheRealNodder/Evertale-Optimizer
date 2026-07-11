(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,F=root.featureModel,T=root.teamEvaluator;
  if(!P||!F||!T)return;

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
  function withStore(store,units){
    const previous=g.OptimizerRuntime;
    g.OptimizerRuntime={...(previous||{}),chunks:{...(previous?.chunks||{}),featureEvidence:store}};
    const attached=F.attach(units);
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
      const good=T.evaluate(complete,{plan:'burn',format:'auto'}),bad=T.evaluate(replaced,{plan:'burn',format:'auto'});
      assert(good.valid,'Complete mechanical team was rejected');
      assert(!bad.valid&&bad.score===0,'Neutral newer unit overrode mandatory setup');
      return 'mechanical completeness remains mandatory';
    });

    test('missing runtime authority fails without fallback',()=>{
      const previous=g.OptimizerRuntime;g.OptimizerRuntime={contracts:{optimizerFoundationReady:false},chunks:{}};
      const report=expectedFailure(()=>root.engine.run(makeTeam('MissingRuntime'),{buildScope:'story',presetMode:'hard',presetTag:'burn'}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&report.diagnostics.usedFallback===false,'Missing runtime did not fail safely');
      return report.engineVersion;
    });

    test('insufficient roster fails without changing format contracts',()=>{
      const previous=g.OptimizerRuntime;g.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:{}}};
      const report=expectedFailure(()=>root.engine.run(makeTeam('Short').slice(0,7),{buildScope:'story',presetMode:'hard',presetTag:'burn'}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&/Insufficient owned roster/.test(report.diagnostics.v6Error),'Insufficient roster was concealed');return report.diagnostics.v6Error;
    });

    test('invalid locked unit is reported and V4 remains unused',()=>{
      const raw=makeTeam('BadLock'),store={};raw.forEach((row,index)=>store[row.sourceId]=[evidence(index%2?'payoff_burn':'applies_burn')]);const prepared=withStore(store,raw),previous=g.OptimizerRuntime;
      g.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:store}};const report=expectedFailure(()=>root.engine.run(prepared,{preparedV6:true,buildScope:'story',presetMode:'hard',presetTag:'burn',currentLayout:{storyMain:['MissingUnit','','','',''],storyBack:['','','']},slotLocks:{storyMain:[true,false,false,false,false],storyBack:[false,false,false]}}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&report.diagnostics.usedFallback===false&&/Locked Story unit/.test(report.diagnostics.v6Error),'Invalid lock did not fail explicitly');return report.diagnostics.v6Error;
    });

    const failed=results.filter(row=>!row.pass);
    return{passed:results.length-failed.length,failed:failed.length,total:results.length,results,policyVersion:P.version};
  }

  root.regressionFixtures={run};
  g.runOptimizerV6RegressionFixtures=run;
})(window);
