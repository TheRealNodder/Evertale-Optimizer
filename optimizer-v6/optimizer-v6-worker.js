'use strict';
self.window=self;

importScripts(
  './optimizer-v6-policy.js?v=9',
  './optimizer-v6-evidence.js?v=9',
  './optimizer-v6-resource-reasoner.js?v=9',
  './optimizer-v6-feature-model.js?v=9',
  './optimizer-v6-team-evaluator.js?v=9',
  './optimizer-v6-explanations.js?v=9',
  './optimizer-v6-story-search.js?v=9',
  './optimizer-v6-platoon-generator.js?v=9',
  './optimizer-v6-platoon-allocator.js?v=9',
  './optimizer-v6-engine.js?v=9'
);

self.onmessage=function(event){
  const message=event.data||{};if(message.type!=='run')return;
  const jobId=message.jobId;
  try{
    self.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:message.featureEvidence||{},skillProfiles:message.skillProfiles||{},leaderProfiles:message.leaderProfiles||{}}};
    const options={...(message.options||{}),preparedV6:true,onProgress:progress=>self.postMessage({jobId,...progress})};
    const result=self.OptimizerEngineV6.run(message.units||[],options);
    if(result?.diagnostics?.v6Failed)throw new Error(result.diagnostics.v6Error||'Optimizer V6 worker failed');
    self.postMessage({type:'complete',jobId,result});
  }catch(error){self.postMessage({type:'error',jobId,error:String(error?.message||error)});}
};
