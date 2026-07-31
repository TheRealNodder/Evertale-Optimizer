(function(g,d){
  'use strict';

  const SNAPSHOT_KEY='evertale_optimizer_local_meta_snapshot_v1';
  const ENABLED_KEY='evertale_optimizer_use_advisory_meta_v1';
  const RESEARCH_KEY='evertale_optimizer_public_research_v1';
  const button=d.getElementById('researchStrategies');
  const status=d.getElementById('researchStatus');
  const toggle=d.getElementById('useAdvisoryMetaPrior');
  if(!button||!status||!toggle)return;

  const config=g.EVERTALE_LIVE_CONFIG||{};
  const dataVersion=String(config.dataVersion||config.version||'live');
  const base=String(g.EVERTALE_RESEARCH_API_BASE||'').replace(/\/$/,'');
  const sources=Array.isArray(g.EVERTALE_RESEARCH_SOURCES)?g.EVERTALE_RESEARCH_SOURCES:[];
  const backendConfigured=!!(base&&sources.length);
  const context={dataVersion};
  let snapshot=null;
  let publicAdvisory=null;

  const setStatus=text=>{status.textContent=text;};
  const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const enabledPreference=()=>{try{return localStorage.getItem(ENABLED_KEY)==='true';}catch{return false;}};
  const setEnabledPreference=value=>{try{localStorage.setItem(ENABLED_KEY,value?'true':'false');}catch{}};
  const localMeta=()=>g.OptimizerV6?.localMeta||null;

  function validation(){
    const model=localMeta();
    return model?model.validateSnapshot(snapshot,context):{valid:false,errors:['V6 local-meta model unavailable']};
  }

  function latestLabel(){
    const row=snapshot?.latest?.[0];
    return row?.name?[row.name,row.title].filter(Boolean).join(' — '):'the newest generated family';
  }

  function renderStatus(prefix=''){
    const check=validation();
    toggle.disabled=!check.valid;
    if(!check.valid){
      toggle.checked=false;
      setStatus(prefix||'Latest-unit cache is unavailable. Deterministic V6 remains fully active.');
      return;
    }
    const mode=toggle.checked?'enabled':'available';
    const note=`Local meta ${mode}: ${snapshot.latest.length} recent families through ${latestLabel()}. Generated release order only; not a live strategy ranking.`;
    setStatus(prefix?`${prefix} ${note}`:note);
  }

  function backendScores(){
    const out={};
    if(!publicAdvisory||publicAdvisory.dataVersion!==dataVersion)return out;
    const now=Math.floor(Date.now()/1000);
    for(const record of publicAdvisory.observations||[]){
      if(Number(record?.expiresAt)>0&&Number(record.expiresAt)<=now)continue;
      for(const unit of record?.observedUnits||[]){
        const raw=typeof unit==='string'?unit:(unit?.sourceId||unit?.family||unit?.name);
        const key=localMeta()?.identityKey(raw);
        if(key)out[key]=Math.max(Number(out[key])||0,Math.max(0,Math.min(100,Number(unit?.score)||Number(record?.confidence)*100||70)));
      }
    }
    return out;
  }

  function getEngineOptions(){
    const model=localMeta();
    if(!model)return{enabled:false,schemaVersion:1,dataVersion,source:'generated-release-order',validationErrors:['model unavailable']};
    const options=model.engineOptions(snapshot,toggle.checked,context);
    if(!options.enabled)return options;
    const observed=backendScores();
    if(Object.keys(observed).length){
      options.scoresByIdentity={...options.scoresByIdentity};
      for(const [key,value] of Object.entries(observed))options.scoresByIdentity[key]=Math.max(Number(options.scoresByIdentity[key])||0,value);
      options.source='generated-release-order+public-advisory';
    }
    return options;
  }

  g.OptimizerMetaAdvisory={
    getSnapshot:()=>snapshot,
    isAvailable:()=>validation().valid,
    isEnabled:()=>toggle.checked&&validation().valid,
    getEngineOptions,
    refresh:()=>refreshLocalSnapshot()
  };

  function publish(){
    g.__optimizerLocalMetaSnapshot=snapshot;
    g.__optimizerResearchAdvisory=publicAdvisory;
    try{g.dispatchEvent(new CustomEvent('optimizer-meta-advisory-updated',{detail:{available:validation().valid,enabled:toggle.checked,dataVersion}}));}catch{}
  }

  async function refreshLocalSnapshot({quiet=false}={}){
    const model=localMeta();
    if(!model)throw new Error('V6 local-meta model is unavailable');
    const bundleBase=String(config.bundlesBase||'./apkfiles/entries/bundles').replace(/\/$/,'');
    const url=`${bundleBase}/character_families.bundle.json?v=${encodeURIComponent(dataVersion)}`;
    if(!quiet)setStatus('Refreshing the generated latest-unit cache…');
    const response=await fetch(url,{cache:'default'});
    if(!response.ok)throw new Error(`Latest-unit bundle request failed: ${response.status}`);
    const bundle=await response.json();
    snapshot=model.buildSnapshot(bundle,{dataVersion,cachedAt:Date.now()});
    if(!model.validateSnapshot(snapshot,context).valid)throw new Error('Generated latest-unit cache failed validation');
    writeJson(SNAPSHOT_KEY,snapshot);
    toggle.disabled=false;
    toggle.checked=enabledPreference();
    publish();
    renderStatus(quiet?'':`Latest-unit cache refreshed from ${Number(snapshot.entryCount)||0} generated families.`);
    return snapshot;
  }

  async function json(url,options){
    const response=await fetch(url,options);
    if(!response.ok)throw new Error(`Research request failed: ${response.status}`);
    return response.json();
  }

  async function poll(jobId){
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      const job=await json(`${base}/api/research/jobs/${encodeURIComponent(jobId)}`);
      setStatus(`${job.progress||0}% — ${job.events?.slice(-1)[0]?.message||job.stage}`);
      if(job.status==='complete'){
        publicAdvisory={schemaVersion:1,dataVersion,advisoryOnly:true,observations:job.results||[],fetchedAt:Date.now()};
        writeJson(RESEARCH_KEY,publicAdvisory);
        publish();
        const newest=Math.max(0,...(job.results||[]).map(row=>Number(row.fetchedAt)||0));
        renderStatus(`Public advisory complete: ${(job.results||[]).length} observations${newest?` (${new Date(newest*1000).toLocaleDateString()})`:''}.`);
        return;
      }
      if(job.status==='failed')throw new Error(job.errors?.[0]?.error||'Research job failed');
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    throw new Error('Research job timed out');
  }

  async function runRefresh(){
    button.disabled=true;
    try{
      await refreshLocalSnapshot();
      if(backendConfigured){
        setStatus('Queuing approved public sources…');
        const job=await json(`${base}/api/research/jobs`,{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sources})
        });
        await poll(job.jobId);
      }
    }catch(error){
      const check=validation();
      renderStatus(`Refresh unavailable: ${String(error?.message||error)}.${check.valid?' Using the last valid local cache.':' Deterministic V6 is unaffected.'}`);
    }finally{
      button.disabled=false;
    }
  }

  async function boot(){
    try{await g.OptimizerV6Loader?.ready;}catch{}
    snapshot=readJson(SNAPSHOT_KEY);
    publicAdvisory=readJson(RESEARCH_KEY);
    if(publicAdvisory?.dataVersion===dataVersion){
      const now=Math.floor(Date.now()/1000);
      publicAdvisory={
        ...publicAdvisory,
        observations:(publicAdvisory.observations||[]).filter(record=>!(Number(record?.expiresAt)>0&&Number(record.expiresAt)<=now))
      };
      writeJson(RESEARCH_KEY,publicAdvisory);
    }else publicAdvisory=null;
    const check=validation();
    toggle.checked=check.valid&&enabledPreference();
    toggle.disabled=!check.valid;
    button.disabled=false;
    button.textContent=backendConfigured?'Research Current Strategies':'Refresh Latest Unit Cache';
    button.title=backendConfigured
      ?'Refresh generated release-order data, then query configured approved public sources.'
      :'Refresh the local generated release-order snapshot. No backend or cookies are required.';
    toggle.title='Applies the valid local latest-unit snapshot inside the existing bounded 0–10% meta slice.';
    publish();
    if(check.valid)renderStatus();
    else{
      try{await refreshLocalSnapshot();}catch(error){renderStatus(`Latest-unit cache unavailable: ${String(error?.message||error)}.`);}
    }
  }

  toggle.addEventListener('change',()=>{
    if(toggle.disabled)return;
    setEnabledPreference(toggle.checked);
    publish();
    renderStatus(toggle.checked?'Advisory meta enabled.':'Advisory meta disabled.');
  });
  button.addEventListener('click',runRefresh);
  boot();
})(window,document);
