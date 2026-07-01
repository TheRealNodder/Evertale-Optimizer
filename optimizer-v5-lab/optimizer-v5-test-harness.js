(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  const STORY_SLOTS=8,PLATOONS=20,PLATOON_SIZE=5;
  const now=()=>g.performance&&typeof g.performance.now==='function'?g.performance.now():Date.now();
  const clone=value=>{try{return g.structuredClone(value);}catch{try{return JSON.parse(JSON.stringify(value));}catch{return value;}}};
  const parse=(value,fallback)=>{try{return JSON.parse(value);}catch{return fallback;}};
  const idOf=value=>S.txt(value&&typeof value==='object'?(value.id||value.sourceId||value.family||value.name):value);
  const ids=values=>S.arr(values).map(idOf).filter(Boolean);

  async function ownedUnits(){
    if(S.arr(g.__optimizerOwnedUnits).length)return g.__optimizerOwnedUnits.slice();
    const stored=parse(g.localStorage?.getItem('evertale_owned_units_v1')||g.localStorage?.getItem('evertale_owned')||'[]',[]);
    const owned=new Set(S.arr(stored).map(S.txt));
    if(!owned.size)return[];
    const all=g.EvertaleData&&typeof g.EvertaleData.loadCharactersMerged==='function'?await g.EvertaleData.loadCharactersMerged():[];
    return S.arr(all).filter(unit=>owned.has(S.txt(unit?.id)));
  }
  function fallbackOptions(){
    const teamType=g.localStorage?.getItem('evertale_optimizer_teamType_v1')||'auto';
    const preset=g.localStorage?.getItem('evertale_optimizer_preset_v1')||'auto';
    const primary=g.localStorage?.getItem('evertale_optimizer_primaryArchetype_v1')||'';
    const secondary=g.localStorage?.getItem('evertale_optimizer_secondaryArchetype_v1')||'';
    const selectionMode=teamType==='mono'?'force_mono':teamType==='rainbow'?'force_rainbow':'auto';
    return{
      doctrineOverrides:{monoVsRainbow:{selectionMode}},
      presetTag:preset==='auto'?'':preset,presetMode:preset==='auto'?'auto':'hard',
      archetypes:[primary,secondary].filter((value,index,list)=>value&&value!=='none'&&list.indexOf(value)===index),
      buildScope:g.document?.getElementById('modePlatoons')?.classList.contains('active')?'platoons':'story',
      currentLayout:parse(g.localStorage?.getItem('evertale_team_layout_v1')||'null',{}),
      slotLocks:parse(g.localStorage?.getItem('evertale_optimizer_slotLocks_v1')||'null',{})
    };
  }
  function currentOptions(){
    if(typeof g.buildEngineOptions==='function')try{return clone(g.buildEngineOptions());}catch(err){console.warn('[Optimizer V5 Lab Test] live option builder failed; using storage.',err);}
    return fallbackOptions();
  }
  function platoonActive(options){return !!(options?.buildScope==='platoons'||g.document?.getElementById('modePlatoons')?.classList.contains('active'));}
  function storyIds(result){return[...ids(result?.story?.main),...ids(result?.story?.back)].slice(0,STORY_SLOTS);}
  function platoonRows(result){return Array.from({length:PLATOONS},(_,index)=>ids(result?.platoons?.[index]?.units||result?.platoons?.[index]).slice(0,PLATOON_SIZE));}
  function selectedIds(result,includePlatoons){return[...storyIds(result),...(includePlatoons?platoonRows(result).flat():[])];}
  function duplicateCounts(result,units,includePlatoons){
    const byId=new Map(S.arr(units).map(unit=>[S.txt(unit?.id),unit])),seen={entry:new Set(),family:new Set(),name:new Set()};
    const counts={entry:0,family:0,name:0,total:0};
    for(const id of selectedIds(result,includePlatoons)){
      const key=S.identity(byId.get(id)||{id}),duplicate={entry:false,family:false,name:false};
      for(const mode of ['entry','family','name'])if(key[mode]){duplicate[mode]=seen[mode].has(key[mode]);if(duplicate[mode])counts[mode]++;else seen[mode].add(key[mode]);}
      if(duplicate.entry||duplicate.family||duplicate.name)counts.total++;
    }
    return counts;
  }
  function newerPlacement(result,units,includePlatoons){
    const ordered=S.arr(units).filter(unit=>S.metaOrder(unit)>0).sort((a,b)=>S.metaOrder(b)-S.metaOrder(a));
    const newest=new Set(ordered.slice(0,Math.max(1,Math.ceil(ordered.length*.25))).map(unit=>S.txt(unit?.id)));
    const placements=selectedIds(result,includePlatoons).map((id,index)=>newest.has(id)?index+1:0).filter(Boolean);
    return{average:placements.length?Number((placements.reduce((sum,value)=>sum+value,0)/placements.length).toFixed(2)):null,placed:placements.length,considered:newest.size};
  }
  function emptyPlatoonSlots(result,active){
    if(!active)return 0;
    return platoonRows(result).reduce((sum,row)=>sum+PLATOON_SIZE-row.length,0);
  }
  function topStory(result,units){
    const byId=new Map(S.arr(units).map(unit=>[S.txt(unit?.id),unit]));
    return storyIds(result).map(id=>{const unit=byId.get(id);return S.txt(unit?.name||unit?.title||id);});
  }
  function profile(result,duration,units,active){
    return{
      duration:Number(duration.toFixed(2)),engineVersion:S.txt(result?.engineVersion||'unknown'),
      duplicates:duplicateCounts(result,units,active),topStory:topStory(result,units),
      newerPlacement:newerPlacement(result,units,active),emptyPlatoonSlots:emptyPlatoonSlots(result,active),
      totalScore:S.num(result?.totalScore),diagnostics:result?.diagnostics||null
    };
  }
  function sameStory(a,b){return JSON.stringify(storyIds(a))===JSON.stringify(storyIds(b));}
  function samePlatoons(a,b,active){return !active||JSON.stringify(platoonRows(a))===JSON.stringify(platoonRows(b));}
  function table(v4,v5){
    console.table([
      {Metric:'Duration (ms)',V4:v4.duration,V5:v5.duration},
      {Metric:'Engine version',V4:v4.engineVersion,V5:v5.engineVersion},
      {Metric:'Duplicate count',V4:v4.duplicates.total,V5:v5.duplicates.total},
      {Metric:'Duplicates entry/family/name',V4:`${v4.duplicates.entry}/${v4.duplicates.family}/${v4.duplicates.name}`,V5:`${v5.duplicates.entry}/${v5.duplicates.family}/${v5.duplicates.name}`},
      {Metric:'Top Story units',V4:v4.topStory.join(' | '),V5:v5.topStory.join(' | ')},
      {Metric:'Average newer placement',V4:v4.newerPlacement.average??'n/a',V5:v5.newerPlacement.average??'n/a'},
      {Metric:'Empty platoon slots',V4:v4.emptyPlatoonSlots,V5:v5.emptyPlatoonSlots},
      {Metric:'Total score',V4:v4.totalScore,V5:v5.totalScore}
    ]);
  }
  async function run(){
    const units=await ownedUnits();
    if(!units.length)throw new Error('No owned optimizer units are available. Load the optimizer page and roster first.');
    const v4Engine=g.OptimizerEngineV4||g.OptimizerFallbackEngine;
    if(!v4Engine||typeof v4Engine.run!=='function')throw new Error('Legacy V4 fallback engine is unavailable.');
    if(!g.OptimizerEngineV5||typeof g.OptimizerEngineV5.run!=='function')throw new Error('OptimizerEngineV5 is unavailable. Await OptimizerV5LabLoader.ready first.');
    const options=currentOptions(),active=platoonActive(options),liveEngine=g.OptimizerEngine;
    let v4Result=null,v5Result=null,v4Error=null,v5Error=null;
    let start=now();try{v4Result=v4Engine.run(units,clone(options));}catch(err){v4Error=err;console.error('[Optimizer V5 Lab Test] V4 error',err);}const v4Duration=now()-start;
    start=now();try{v5Result=g.OptimizerEngineV5.run(units,clone(options));}catch(err){v5Error=err;console.error('[Optimizer V5 Lab Test] V5 error; V4 result remains available.',err);}const v5Duration=now()-start;
    if(root.lastError&&!v5Error){v5Error=root.lastError;console.error('[Optimizer V5 Lab Test] V5 reported an error; no silent V4 result was substituted.',root.lastError);}
    const empty={story:{main:[],back:[]},platoons:[],totalScore:0,engineVersion:'error'};
    const v4=profile(v4Result||empty,v4Duration,units,active),v5=profile(v5Result||empty,v5Duration,units,active);
    table(v4,v5);
    const comparison={storyEqual:sameStory(v4Result,v5Result),platoonsEqual:samePlatoons(v4Result,v5Result,active),platoonMode:active,liveEngineUnchanged:g.OptimizerEngine===liveEngine,liveV5Active:g.OptimizerEngine===g.OptimizerEngineV5};
    console.info('[Optimizer V5 Lab Test] comparison',comparison);
    console.info('[Optimizer V5 Lab Test] V5 diagnostics',v5.diagnostics);
    return{units:units.length,options,v4,v5,comparison,errors:{v4:v4Error,v5:v5Error}};
  }

  root.testHarness={run};
  g.runOptimizerV5LabTest=run;
})(window);
