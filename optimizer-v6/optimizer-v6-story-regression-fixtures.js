(function(g){
  'use strict';
  const root=g.OptimizerV6=g.OptimizerV6||{},P=root.policy,F=root.featureModel,S=root.storySearch,T=root.teamEvaluator;
  if(!P||!F||!S||!T)return;

  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const ev=(feature,strength=1.5)=>({feature,strength,confidence:.98,sources:['raw.activeSkills[0]']});
  const unit=(id,element,atk=1000,extra={})=>({id,sourceId:id,family:id.replace(/\d+$/,''),name:id,element,stats:{atk,hp:5000,spd:100,cost:20},...extra});
  function attach(units,store){const previous=g.OptimizerRuntime;g.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:store,skillProfiles:{}}};const out=F.attach(units);g.OptimizerRuntime=previous;return out;}
  function burnRoster(){
    const units=[],store={};
    for(const [element,prefix,atk] of [['Fire','Fire',1200],['Water','Water',1800]])for(let i=0;i<8;i++){
      const id=`${prefix}${String.fromCharCode(65+i)}01`;units.push(unit(id,element,atk+i*10));store[id]=[ev(i%2?'payoff_burn':'applies_burn'),ev(i%3?'role_healer':'role_guardian')];
    }
    return{units,store};
  }
  function rainbowRoster(){
    const units=[],store={},elements=['Fire','Water','Storm','Earth'];const features=['applies_burn','payoff_burn','role_guardian','tempo_turn'];
    for(let i=0;i<12;i++){const id=`Rainbow${String.fromCharCode(65+i)}01`,element=elements[i%4];units.push(unit(id,element,1300+i*20));store[id]=[ev(features[i%4]),ev(i%2?'role_healer':'role_cleanser')];}
    return{units,store};
  }

  function run(){
    const results=[],test=(name,fn)=>{try{results.push({name,pass:true,detail:fn()||'pass'});}catch(error){results.push({name,pass:false,detail:String(error?.message||error)});}};
    test('Story beam search returns exact deterministic 5+3',()=>{
      const fixture=burnRoster(),prepared=attach(fixture.units,fixture.store),options={plan:'burn',format:'auto',beamWidth:50,candidateCap:20};
      const a=S.search(prepared,options),b=S.search(prepared,options);assert(a.best&&b.best,'No Story result');assert(a.best.story.main.length===5&&a.best.story.back.length===3,'Wrong Story size');
      assert(a.best.ordered.map(x=>x.id).join('|')===b.best.ordered.map(x=>x.id).join('|'),'Search was nondeterministic');return `${a.diagnostics.generatedStates} states`;
    });
    test('locked Story positions remain exact',()=>{
      const fixture=burnRoster(),prepared=attach(fixture.units,fixture.store),locked=fixture.units[10].id;
      const result=S.search(prepared,{plan:'burn',format:'auto',beamWidth:50,candidateCap:20,currentLayout:{storyMain:['',locked,'','',''],storyBack:['','','']},slotLocks:{storyMain:[false,true,false,false,false],storyBack:[false,false,false]}});
      assert(result.best?.story.main[1]?.id===locked,'Locked main slot moved');return locked;
    });
    test('mono compares complete teams across elements',()=>{
      const fixture=burnRoster(),prepared=attach(fixture.units,fixture.store),result=S.bestMono(prepared,{plan:'burn',beamWidth:50,candidateCap:20});
      assert(result.best?.element==='water',`Expected stronger Water complete team, got ${result.best?.element}`);assert(result.best.story.main.concat(result.best.story.back).every(row=>P.key(row.element)==='water'),'Mono result mixed elements');return `selected ${result.best.element}`;
    });
    test('hard plan cohesion beats a mostly neutral higher-stat mono team',()=>{
      const units=[],store={};
      for(let i=0;i<8;i++){
        const id=`DarkBlood${String.fromCharCode(65+i)}01`;units.push(unit(id,'Dark',1050+i*10));
        store[id]=[i<6?ev('summon'):i===6?ev('payoff_blood'):ev('role_guardian')];
      }
      for(let i=0;i<8;i++){
        const id=`StormBlood${String.fromCharCode(65+i)}01`;units.push(unit(id,'Storm',1900+i*10));
        store[id]=[i<2?ev('summon'):i===2?ev('payoff_blood'):ev('role_healer')];
      }
      const prepared=attach(units,store),result=S.bestMono(prepared,{plan:'blood',presetMode:'hard',beamWidth:60,candidateCap:20});
      assert(result.best?.element==='dark',`Mostly neutral high-stat team beat coherent Blood team: ${result.best?.element}`);
      assert(result.best.evaluation.engine.contributorCount>=7,'Blood cohesion coverage was not retained');
      return `${result.best.element} with ${result.best.evaluation.engine.contributorCount}/8 direct contributors`;
    });
    test('rainbow search produces four coherent elements',()=>{
      const fixture=rainbowRoster(),prepared=attach(fixture.units,fixture.store),result=S.rainbow(prepared,{plan:'hybrid',beamWidth:70,candidateCap:20,requirePlanComplete:false});
      assert(result.best&&result.rainbowStrict,'Strict rainbow not found');assert(result.best.evaluation.element.contributingElements.length>=4,'Rainbow contains color-only element');return `${result.best.evaluation.element.distinctElements} elements`;
    });
    test('entry and reinforcement value affects back placement',()=>{
      const fixture=burnRoster();fixture.units[0].description='Powerful when entering from reinforcements';fixture.units[0].stats.spd=1;fixture.store[fixture.units[0].id]=[ev('applies_burn'),ev('role_healer')];
      const prepared=attach(fixture.units,fixture.store),result=S.search(prepared,{plan:'burn',format:'force_mono',targetElement:'fire',beamWidth:50,candidateCap:20});
      assert(result.best?.story.back.some(row=>row.id===fixture.units[0].id),`Entry unit was not reserved for back: main=${result.best?.story.main.map(row=>row.id)} back=${result.best?.story.back.map(row=>row.id)}`);return fixture.units[0].id;
    });
    const failed=results.filter(row=>!row.pass);return{passed:results.length-failed.length,failed:failed.length,total:results.length,results};
  }
  root.storyRegressionFixtures={run};g.runOptimizerV6StoryRegressionFixtures=run;
})(window);
