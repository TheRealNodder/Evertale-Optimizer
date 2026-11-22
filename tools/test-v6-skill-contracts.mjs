import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const profiles=JSON.parse(read('apkfiles/entries/runtime/optimizer_runtime_skill_profiles.json')).data;
const context=vm.createContext({console});context.window=context;
context.OptimizerRuntime={chunks:{skillProfiles:profiles}};
for(const name of ['policy','evidence','skill-model','resource-reasoner'])vm.runInContext(read(`optimizer-v6/optimizer-v6-${name}.js`),context,{filename:name});
const S=context.OptimizerV6.skillModel,R=context.OptimizerV6.resourceReasoner;
const json=value=>JSON.parse(JSON.stringify(value));
const affected=Object.entries(profiles).flatMap(([id,p])=>p.skills.filter(s=>s.targeting==='AllButSelf').map(skill=>({id,skill})));

test('all six real AllButSelf profiles retain mixed-side source exclusion and unknown count',()=>{
  assert.equal(affected.length,6);
  assert.deepEqual(affected.map(r=>r.id).sort(),['IbarahimeSwimsuit01','IbarahimeSwimsuit02','LuBuRegular01','LuBuRegular02','RolotiaNew01','RolotiaNew02'].sort());
  for(const {id,skill} of affected){
    assert.equal(skill.target.side,'mixed',id);assert.equal(skill.target.excludesSource,true,id);
    const target=S.targetContract(skill);
    assert.equal(target.side,'mixed',id);assert.equal(target.count,null,id);assert.equal(target.all,true,id);assert.equal(target.random,false,id);
    assert.equal(target.excludesSource,true,id);assert.equal(S.targetValue(skill),92,id);
    assert.deepEqual(json(target.componentRouting),skill.target.componentRouting,id);
  }
});

test('per-component Enemy/Friendly filters and source-only overrides survive real profile lookup',()=>{
  for(const {id,skill} of affected){
    const lookedUp=R.unitProfile({id,sourceId:id}).skills.find(s=>s.id===skill.id);
    assert.ok(lookedUp,id);assert.deepEqual(json(lookedUp.target),skill.target,id);
    const routes=lookedUp.target.componentRouting;
    assert.equal(routes.length,skill.components.length,id);
    assert.deepEqual(routes.map(r=>r.index),Array.from({length:routes.length},(_,i)=>i));
    assert.ok(routes.some(r=>r.applyToTargetType==='Enemy'));
    assert.ok(routes.some(r=>r.applyToTargetType==='Friendly'));
    assert.ok(routes.some(r=>r.applyToSourceOnly===true));
    if(id.startsWith('LuBu')){
      assert.deepEqual(routes.slice(0,2).map(r=>r.chance),[0.5,0.5]);
      assert.equal(routes.filter(r=>r.applyToSourceOnly===true).length,2);
      assert.deepEqual(skill.effectChances,[1]); // Component chance interpretation is a separate mechanic.
    }
    if(id.startsWith('Ibarahime'))assert.deepEqual(routes.slice(0,4).map(r=>r.applyConditions),['IsFireOrEarthOrDeath','IsFireOrEarthOrDeath','IsWaterOrAirOrLife','IsWaterOrAirOrLife']);
  }
});

test('legacy AllButSelf profiles avoid the self substring fallback without fabricated routing',()=>{
  for(const targeting of ['AllButSelf','all_but_self']){
    const target=S.targetContract({targeting,target:{side:'unknown',count:null,all:false}});
    assert.equal(target.side,'mixed');assert.equal(target.count,null);assert.equal(target.excludesSource,true);
    assert.equal(target.all,true);assert.equal(S.targetValue({targeting}),92);
    assert.equal(Object.hasOwn(target,'componentRouting'),false);
  }
});

test('unrelated target contracts keep their existing shape and count coercion',()=>{
  assert.deepEqual(json(S.targetContract({target:{side:'enemies',count:2,all:false,random:true,authority:'fixture'}})),{side:'enemies',count:2,all:false,random:true,authority:'fixture'});
  assert.equal(S.targetContract({target:{side:'enemies',count:null}}).count,0);
  assert.equal(Object.hasOwn(S.targetContract({targeting:'SourceOnly'}),'excludesSource'),false);
  assert.equal(S.targetValue({target:{side:'enemies',all:true}}),100);
});

test('controller and actual worker retain the target contract and use the loader module revision',async()=>{
  const imports=[],workerURLs=[],workerContexts=[];
  const workerSource=read('optimizer-v6/optimizer-v6-worker.js');
  class WorkerFixture{
    constructor(url){
      workerURLs.push(url);
      const worker=vm.createContext({console,structuredClone,postMessage:message=>queueMicrotask(()=>this.onmessage?.({data:structuredClone(message)}))});
      worker.self=worker;
      worker.importScripts=(...urls)=>{for(const url of urls){imports.push(url);vm.runInContext(read('optimizer-v6/'+url.replace(/^\.\//,'').split('?')[0]),worker,{filename:url});}};
      vm.runInContext(workerSource,worker,{filename:url});this.worker=worker;workerContexts.push(worker);
    }
    postMessage(message){queueMicrotask(()=>this.worker.onmessage({data:structuredClone(message)}));}
    terminate(){}
  }
  const main=vm.createContext({console,structuredClone,Worker:WorkerFixture});main.window=main;
  const chunk=name=>JSON.parse(read(`apkfiles/entries/runtime/optimizer_runtime_${name}.json`)).data;
  main.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{skillProfiles:profiles,featureEvidence:chunk('feature_evidence'),leaderProfiles:chunk('leader_profiles')}};
  for(const file of ['optimizer-v5-lab/optimizer-v5-shared.js','optimizer-v5-lab/optimizer-feature-model.js',...['policy','local-meta','evidence','skill-model','resource-reasoner','feature-model','team-evaluator','explanations','story-search','platoon-generator','platoon-allocator','engine','controller'].map(name=>`optimizer-v6/optimizer-v6-${name}.js`)])vm.runInContext(read(file),main,{filename:file});
  const all=Object.values(chunk('character_entries'));
  const selected=['RolotiaNew02','IbarahimeSwimsuit02','LuBuRegular02'].map(id=>all.find(row=>row.sourceId===id));
  const families=new Set(selected.map(row=>row.internal.family));
  for(const row of all){if(selected.length===8)break;if(!families.has(row.internal.family)){selected.push(row);families.add(row.internal.family);}}
  const units=selected.map(row=>({...row,id:row.sourceId})),ids=units.map(row=>row.id);
  const result=await main.OptimizerV6.controller.run(units,{plan:'hybrid',buildScope:'story',currentLayout:{storyMain:ids.slice(0,5),storyBack:ids.slice(5)},slotLocks:{storyMain:Array(5).fill(true),storyBack:Array(3).fill(true)}});
  assert.deepEqual(json(result.story.main),ids.slice(0,5));assert.deepEqual(json(result.story.back),ids.slice(5));
  const revision=read('optimizer-v6/optimizer-v6-loader.js').match(/version:'v(\d+)'/)[1];
  assert.equal(workerURLs.length,1);assert.equal(new URL(workerURLs[0],'https://fixture.test/').searchParams.get('v'),revision);
  assert.ok(imports.length>0&&imports.every(url=>new URL(url,'https://fixture.test/').searchParams.get('v')===revision));
  for(const {id,skill} of affected){
    const stored=workerContexts[0].OptimizerRuntime.chunks.skillProfiles[id].skills.find(s=>s.id===skill.id);
    assert.deepEqual(json(workerContexts[0].OptimizerV6.skillModel.targetContract(stored)),json(S.targetContract(skill)));
    assert.equal(workerContexts[0].OptimizerV6.skillModel.effectiveness(stored),S.effectiveness(skill));
  }
});


test('canonical ApplyBuff and existing alias activate the single existing support magnitude',()=>{
  const skill=components=>({components,target:{side:'mixed',all:true,count:null}});
  assert.equal(context.OptimizerV6.policy.key('ApplyBuff'),'applybuff');
  assert.equal(S.effectiveness(skill(['ApplyBuff'])),67.52);
  assert.equal(S.effectiveness(skill(['apply_buff'])),67.52);
  assert.equal(S.effectiveness(skill(['ApplyBuff','ApplyBuff','apply_buff'])),67.52);
  for(const components of [[],['RemoveBuff'],['PreApplyBuff'],['ApplyBuffExtra'],[null]])assert.equal(S.effectiveness(skill(components)),25.76);
  for(const {skill:real} of affected)assert.equal(S.effectiveness(real),67.52);
});

test('support retains damage max, finite bounds and the existing 58 magnitude',()=>{
  const base={components:['Damage'],target:{side:'enemies',all:true},baseMultiplier:4};
  assert.equal(S.damageMagnitude(base),60);
  assert.equal(S.effectiveness({...base,components:['Damage','ApplyBuff']}),S.effectiveness(base));
  const low={...base,baseMultiplier:0,components:['Damage','ApplyBuff']};
  assert.equal(S.effectiveness(low),58*.72+100*.28);
  const capped={...base,baseMultiplier:10000,components:['Damage','ApplyBuff']};
  assert.equal(S.effectiveness(capped),100);
  assert.equal(S.effectiveness({components:['ApplyBuff']}),58*.72+50*.28);
});

test('new scoring revision invalidates a persisted prior result and still reuses a current result',async()=>{
  const store=new Map(),key='evertale_optimizer_v6_cache_v4';
  function controller(version){
    let runs=0;
    const c=vm.createContext({console,structuredClone,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}});c.window=c;
    c.EVERTALE_LIVE_CONFIG={dataVersion:'unchanged-D-data-version'};
    vm.runInContext(read('optimizer-v6/optimizer-v6-policy.js'),c);
    if(version)c.OptimizerV6.policy.version=version;
    c.OptimizerV6.engine={prepare:units=>units,run:()=>{runs++;return {scoringRevision:c.OptimizerV6.policy.version};}};
    vm.runInContext(read('optimizer-v6/optimizer-v6-controller.js'),c);
    return{controller:c.OptimizerV6.controller,runs:()=>runs,version:c.OptimizerV6.policy.version};
  }
  const legacy=controller('optimizer-v6-policy-10');
  const oldResult=await legacy.controller.run([],{buildScope:'story'});
  assert.equal(legacy.runs(),1);assert.ok(store.has(key));
  const current=controller();assert.equal(current.version,'optimizer-v6-policy-12');
  assert.notEqual(current.controller.cacheKey([],{buildScope:'story'}),legacy.controller.cacheKey([],{buildScope:'story'}));
  const fresh=await current.controller.run([],{buildScope:'story'});
  assert.equal(current.runs(),1);assert.notDeepEqual(json(fresh),json(oldResult));
  const reload=controller();assert.deepEqual(json(await reload.controller.run([],{buildScope:'story'})),json(fresh));assert.equal(reload.runs(),0);
});
