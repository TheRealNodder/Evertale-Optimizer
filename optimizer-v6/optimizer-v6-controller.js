(function(g){
  'use strict';
  const root=g.OptimizerV6=g.OptimizerV6||{},P=root.policy;
  if(!P)return;
  const CACHE_KEY='evertale_optimizer_v6_cache_v1',memory=new Map();let active=null,sequence=0;

  function cleanOptions(options){
    const clone={};for(const [key,value] of Object.entries(options||{}))if(!['onProgress','signal','cancelled'].includes(key)&&typeof value!=='function')clone[key]=value;return clone;
  }
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
    return value;
  }
  function hash(text){let value=2166136261;for(let i=0;i<text.length;i++){value^=text.charCodeAt(i);value=Math.imul(value,16777619);}return(value>>>0).toString(16);}
  function cacheKey(units,options){
    const roster=(units||[]).map(unit=>({id:P.identity(unit),stats:unit?.__v6?.stats||unit?.__v5?.stats||unit?.stats,rarity:unit?.rarity,element:unit?.element}));
    const dataVersion=g.EVERTALE_LIVE_CONFIG?.dataVersion||g.EVERTALE_LIVE_CONFIG?.version||'live';
    let profile=null;try{profile=g.EvertaleRosterProfiles?.loadState?.()||null;}catch{}
    return hash(JSON.stringify(stable({policy:P.version,dataVersion,roster,profile,options:cleanOptions(options)})));
  }
  function readCache(key){
    if(memory.has(key))return memory.get(key);
    try{const store=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'),row=store[key];if(row){memory.set(key,row);return row;}}catch{}
    return null;
  }
  function writeCache(key,result){
    memory.set(key,result);if(memory.size>6)memory.delete(memory.keys().next().value);
    try{const store=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');store[key]=result;while(Object.keys(store).length>6)delete store[Object.keys(store)[0]];localStorage.setItem(CACHE_KEY,JSON.stringify(store));}catch{}
  }
  function emit(progress,options){
    if(typeof options?.onProgress==='function')options.onProgress(progress);
    try{g.dispatchEvent(new CustomEvent('optimizer-v6-progress',{detail:progress}));}catch{}
  }
  function cancel(reason='Optimizer V6 search cancelled'){
    if(!active)return false;const job=active;active=null;try{job.worker?.terminate();}catch{}job.reject(new Error(reason));return true;
  }
  async function run(units,options={}){
    cancel('Optimizer V6 search replaced by a new request');
    emit({type:'progress',stage:'preparing-data',completed:0,total:1,percent:0,message:'Preparing data'},options);
    const key=cacheKey(units,options),cached=readCache(key);
    if(cached){emit({type:'progress',stage:'complete',completed:1,total:1,percent:100,message:'Loaded cached optimizer result',cached:true},options);return structuredClone(cached);}
    const prepared=root.engine.prepare(units,options);
    if(typeof Worker!=='function'){
      const result=root.engine.run(prepared,{...options,preparedV6:true,onProgress:progress=>emit(progress,options)});if(result?.diagnostics?.v6Failed)throw new Error(result.diagnostics.v6Error);writeCache(key,result);return result;
    }
    const jobId=`v6-${Date.now()}-${++sequence}`,worker=new Worker('./optimizer-v6/optimizer-v6-worker.js?v=1');
    return new Promise((resolve,reject)=>{
      active={jobId,worker,reject};
      worker.onmessage=event=>{
        const message=event.data||{};if(message.jobId!==jobId)return;
        if(message.type==='progress'){emit(message,options);return;}
        worker.terminate();if(active?.jobId===jobId)active=null;
        if(message.type==='error'){reject(new Error(message.error||'Optimizer V6 worker failed'));return;}
        if(message.type==='complete'){writeCache(key,message.result);emit({type:'progress',stage:'complete',completed:1,total:1,percent:100,message:'Complete'},options);resolve(message.result);}
      };
      worker.onerror=event=>{worker.terminate();if(active?.jobId===jobId)active=null;reject(new Error(event.message||'Optimizer V6 worker failed'));};
      worker.postMessage({type:'run',jobId,units:prepared,options:cleanOptions(options),featureEvidence:g.OptimizerRuntime?.chunks?.featureEvidence||{}});
    });
  }

  root.controller={run,cancel,cacheKey,readCache,writeCache,cleanOptions};
})(window);
