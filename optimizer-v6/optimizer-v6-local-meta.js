(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy;
  if(!P)return;

  const SCHEMA_VERSION=1;
  const POLICY_VERSION='optimizer-local-meta-v1';
  const DEFAULT_LATEST_LIMIT=32;
  const rows=value=>Array.isArray(value)?value:[];
  const number=value=>Number.isFinite(Number(value))?Number(value):0;

  function identityKey(value){return P.key(value);}

  function entryIdentityKeys(entry){
    const stateIds=rows(entry?.states).flatMap(state=>[state?.sourceId,state?.dataSourceId]);
    return [...new Set([
      entry?.family,entry?.internal?.family,entry?.sourceId,entry?.internal?.sourceId,
      ...stateIds
    ].map(identityKey).filter(Boolean))];
  }

  function buildSnapshot(bundle,context={}){
    const dataVersion=P.txt(context.dataVersion);
    if(!dataVersion)throw new Error('Latest-unit cache requires a data version');
    const source=rows(bundle?.entries).filter(entry=>number(entry?.order)>0);
    if(!source.length)throw new Error('Latest-unit cache source has no release-order entries');
    const ordered=[...source].sort((a,b)=>number(b?.order)-number(a?.order)||identityKey(a?.family).localeCompare(identityKey(b?.family)));
    const maxOrder=Math.max(...ordered.map(entry=>number(entry?.order))),limit=Math.max(8,Math.min(64,number(context.limit)||DEFAULT_LATEST_LIMIT));
    const latest=ordered.slice(0,limit).map((entry,index)=>{
      const order=number(entry?.order),releaseScore=P.clamp(maxOrder>1?(order-1)/(maxOrder-1)*100:100);
      const windowScore=P.clamp(100-index/Math.max(1,limit-1)*45);
      return{
        family:P.txt(entry?.family),sourceId:P.txt(entry?.states?.[0]?.sourceId||entry?.sourceId),
        name:P.txt(entry?.name),title:P.txt(entry?.title),rarity:P.txt(entry?.rarity),
        order,score:Math.round(Math.max(releaseScore,windowScore)*100)/100,
        identityKeys:entryIdentityKeys(entry)
      };
    });
    const scoresByIdentity={};
    for(const entry of latest)for(const key of entry.identityKeys)scoresByIdentity[key]=Math.max(number(scoresByIdentity[key]),entry.score);
    return{
      schemaVersion:SCHEMA_VERSION,policyVersion:POLICY_VERSION,dataVersion,
      source:'generated-release-order',confidence:.76,generatedAt:number(bundle?.generatedAt),
      contentHash:P.txt(bundle?.contentHash),cachedAt:number(context.cachedAt)||Date.now(),
      maxOrder,entryCount:ordered.length,latest,scoresByIdentity
    };
  }

  function validateSnapshot(snapshot,context={}){
    const errors=[];
    if(!snapshot||typeof snapshot!=='object')errors.push('snapshot missing');
    if(number(snapshot?.schemaVersion)!==SCHEMA_VERSION)errors.push('schema version mismatch');
    if(snapshot?.policyVersion!==POLICY_VERSION)errors.push('policy version mismatch');
    if(P.txt(context.dataVersion)&&snapshot?.dataVersion!==P.txt(context.dataVersion))errors.push('data version mismatch');
    if(snapshot?.source!=='generated-release-order')errors.push('source mismatch');
    if(number(snapshot?.maxOrder)<=0)errors.push('maximum release order missing');
    if(number(snapshot?.entryCount)<=0)errors.push('entry count missing');
    if(!rows(snapshot?.latest).length)errors.push('latest-unit records missing');
    if(!snapshot?.scoresByIdentity||typeof snapshot.scoresByIdentity!=='object')errors.push('identity scores missing');
    for(const [key,value] of Object.entries(snapshot?.scoresByIdentity||{})){
      if(!identityKey(key)||number(value)<0||number(value)>100){errors.push('identity score out of bounds');break;}
    }
    return{valid:errors.length===0,errors};
  }

  function engineOptions(snapshot,enabled,context={}){
    const validation=validateSnapshot(snapshot,context);
    if(!enabled||!validation.valid)return{
      enabled:false,schemaVersion:SCHEMA_VERSION,policyVersion:POLICY_VERSION,
      dataVersion:P.txt(context.dataVersion),source:'generated-release-order',validationErrors:validation.errors
    };
    return{
      enabled:true,schemaVersion:SCHEMA_VERSION,policyVersion:POLICY_VERSION,
      dataVersion:snapshot.dataVersion,source:snapshot.source,confidence:P.clamp(number(snapshot.confidence)*100)/100,
      maxOrder:number(snapshot.maxOrder),entryCount:number(snapshot.entryCount),
      cachedAt:number(snapshot.cachedAt),generatedAt:number(snapshot.generatedAt),
      scoresByIdentity:{...snapshot.scoresByIdentity}
    };
  }

  root.localMeta={
    schemaVersion:SCHEMA_VERSION,policyVersion:POLICY_VERSION,defaultLatestLimit:DEFAULT_LATEST_LIMIT,
    identityKey,entryIdentityKeys,buildSnapshot,validateSnapshot,engineOptions
  };
})(window);
