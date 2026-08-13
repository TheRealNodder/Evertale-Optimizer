/* optimizerRuntimeLoader.js
   Contract-aware split runtime loader.
   Foundation startup loads only the character intelligence V6 preparation
   requires; form-level diagnostics and the ability graph remain lazy.
*/
(function(){
  'use strict';

  const LIVE_CONFIG=window.EVERTALE_LIVE_CONFIG||{};
  const VERSION=LIVE_CONFIG.dataVersion||LIVE_CONFIG.version||'live';
  const BASE_PATH=LIVE_CONFIG.runtimeBase||'./apkfiles/entries/runtime';
  const HEAVY_CHUNKS=new Set(['abilityGraph','characterEntries']);
  const OPTIMIZER_FOUNDATION_CHUNKS=new Set(['characters','featureEvidence','skillProfiles','leaderProfiles','optimizerKnowledge','tags']);

  let manifestPromise=null;
  let runtimeLoadPromise=null;

  window.OptimizerRuntime=window.OptimizerRuntime||{
    loaded:false,
    loadedHeavy:false,
    manifest:null,
    chunks:{},
    runtimeFlags:{},
    errors:{},
    contracts:{
      optimizerFoundationReady:false,
      requiredFoundationChunks:[...OPTIMIZER_FOUNDATION_CHUNKS],
      missingFoundationChunks:[]
    },
    loadReports:[]
  };
  window.OptimizerRuntime.chunks=window.OptimizerRuntime.chunks||{};
  window.OptimizerRuntime.errors=window.OptimizerRuntime.errors||{};
  window.OptimizerRuntime.loadReports=window.OptimizerRuntime.loadReports||[];
  window.OptimizerRuntime.contracts=window.OptimizerRuntime.contracts||{
    optimizerFoundationReady:false,
    requiredFoundationChunks:[...OPTIMIZER_FOUNDATION_CHUNKS],
    missingFoundationChunks:[]
  };

  function withVersion(url){return VERSION?`${url}?v=${encodeURIComponent(VERSION)}`:url;}

  async function fetchJson(url){
    const response=await fetch(withVersion(url),{cache:'default'});
    if(!response.ok)throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return response.json();
  }

  async function getManifest(){
    if(!manifestPromise){
      manifestPromise=fetchJson(`${BASE_PATH}/optimizer_runtime_manifest.json`).then(manifest=>{
        window.OptimizerRuntime.manifest=manifest;
        window.OptimizerRuntime.runtimeFlags=manifest.runtimeFlags||{};
        return manifest;
      });
    }
    return manifestPromise;
  }

  async function loadOptimizerRuntimeChunk(basePath,key,chunkInfo){
    if(Object.prototype.hasOwnProperty.call(window.OptimizerRuntime.chunks,key))return window.OptimizerRuntime.chunks[key];
    const file=chunkInfo&&chunkInfo.file;
    if(!file){window.OptimizerRuntime.errors[key]='Chunk is absent from runtime manifest';return null;}
    try{
      const payload=await fetchJson(`${basePath}/${file}`);
      const data=payload&&Object.prototype.hasOwnProperty.call(payload,'data')?payload.data:payload;
      window.OptimizerRuntime.chunks[key]=data;
      delete window.OptimizerRuntime.errors[key];
      return data;
    }catch(err){
      window.OptimizerRuntime.errors[key]=String(err&&err.message?err.message:err);
      console.warn('[OptimizerRuntime] chunk failed:',key,err);
      return null;
    }
  }

  function loadedChunk(key){return Object.prototype.hasOwnProperty.call(window.OptimizerRuntime.chunks,key)&&!window.OptimizerRuntime.errors[key];}

  function selectedChunkEntries(manifest,profile){
    const chunks=Object.entries(manifest.chunks||{});
    if(profile==='optimizer-foundation')return chunks.filter(([key])=>OPTIMIZER_FOUNDATION_CHUNKS.has(key));
    if(profile==='full')return chunks;
    return chunks.filter(([key])=>!HEAVY_CHUNKS.has(key));
  }

  function updateFoundationContract(){
    const missing=[...OPTIMIZER_FOUNDATION_CHUNKS].filter(key=>!loadedChunk(key));
    window.OptimizerRuntime.contracts={
      ...(window.OptimizerRuntime.contracts||{}),
      optimizerFoundationReady:missing.length===0,
      requiredFoundationChunks:[...OPTIMIZER_FOUNDATION_CHUNKS],
      missingFoundationChunks:missing
    };
    return missing;
  }

  window.loadOptimizerRuntime=async function loadOptimizerRuntime(options={}){
    const profile=options.profile||(options.skipHeavy===true?'optimizer-foundation':'standard');
    const manifest=await getManifest();
    const selected=selectedChunkEntries(manifest,profile);
    if(selected.every(([key])=>loadedChunk(key))){updateFoundationContract();return window.OptimizerRuntime;}

    if(runtimeLoadPromise)await runtimeLoadPromise;
    const remaining=selected.filter(([key])=>!loadedChunk(key));
    runtimeLoadPromise=Promise.all(remaining.map(([key,info])=>loadOptimizerRuntimeChunk(BASE_PATH,key,info)));
    try{await runtimeLoadPromise;}finally{runtimeLoadPromise=null;}

    const missingFoundation=updateFoundationContract();
    window.OptimizerRuntime.loaded=true;
    if(profile==='full')window.OptimizerRuntime.loadedHeavy=true;
    const report={
      profile,
      requested:selected.map(([key])=>key),
      loaded:Object.keys(window.OptimizerRuntime.chunks),
      failures:{...window.OptimizerRuntime.errors},
      optimizerFoundationReady:missingFoundation.length===0,
      missingFoundation
    };
    window.OptimizerRuntime.loadReports.push(report);
    console.log('[OptimizerRuntime] loaded',report);
    return window.OptimizerRuntime;
  };

  window.loadOptimizerRuntimeChunk=loadOptimizerRuntimeChunk;
})();
