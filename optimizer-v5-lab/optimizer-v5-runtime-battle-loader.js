(function(g){
  'use strict';
  if(g.OptimizerV5BattleRuntimePatch)return;
  const original=g.loadOptimizerRuntime;
  if(typeof original!=='function')return;
  async function loadBattleIntentChunk(runtime){
    const manifest=runtime?.manifest||g.OptimizerRuntime?.manifest;
    const info=manifest?.chunks?.battleIntent;
    if(!info||!info.file||g.OptimizerRuntime?.chunks?.battleIntent)return runtime;
    const base=(g.EVERTALE_LIVE_CONFIG&&g.EVERTALE_LIVE_CONFIG.runtimeBase)||'./apkfiles/entries/runtime';
    const version=(g.EVERTALE_LIVE_CONFIG&&(g.EVERTALE_LIVE_CONFIG.dataVersion||g.EVERTALE_LIVE_CONFIG.version))||'live';
    const sep=String(info.file).includes('?')?'&':'?';
    try{
      const res=await fetch(base+'/'+info.file+sep+'v='+encodeURIComponent(version),{cache:'default'});
      if(res.ok){
        const payload=await res.json();
        g.OptimizerRuntime.chunks.battleIntent=payload&&Object.prototype.hasOwnProperty.call(payload,'data')?payload.data:payload;
      }
    }catch(err){
      g.OptimizerRuntime.errors=g.OptimizerRuntime.errors||{};
      g.OptimizerRuntime.errors.battleIntent=String(err&&err.message?err.message:err);
    }
    return runtime;
  }
  g.loadOptimizerRuntime=async function patchedLoadOptimizerRuntime(options){
    const runtime=await original.call(this,options||{});
    return loadBattleIntentChunk(runtime);
  };
  g.OptimizerV5BattleRuntimePatch={version:'v1'};
})(window);
