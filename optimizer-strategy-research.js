(function(g,d){
  'use strict';

  const SNAPSHOT_KEY='evertale_optimizer_local_meta_snapshot_v1';
  const LOCAL_ENABLED_KEY='evertale_optimizer_use_advisory_meta_v1';
  const INTERNET_CACHE_KEY='evertale_optimizer_public_research_v2';
  const INTERNET_ENABLED_KEY='evertale_optimizer_use_public_research_v1';
  const refreshLocalButton=d.getElementById('refreshLatestUnitCache');
  const researchButton=d.getElementById('researchStrategies');
  const localStatus=d.getElementById('localMetaStatus');
  const internetStatus=d.getElementById('researchStatus');
  const findings=d.getElementById('researchFindings');
  const findingsSummary=d.getElementById('researchFindingsSummary');
  const findingsList=d.getElementById('researchFindingsList');
  const localToggle=d.getElementById('useAdvisoryMetaPrior');
  const internetToggle=d.getElementById('useInternetResearchPrior');
  if(!refreshLocalButton||!researchButton||!localStatus||!internetStatus||!localToggle||!internetToggle||!findings||!findingsSummary||!findingsList)return;

  const config=g.EVERTALE_LIVE_CONFIG||{};
  const dataVersion=String(config.dataVersion||config.version||'live');
  const context={dataVersion};
  let snapshot=null;
  let internetAdvisory=null;
  let sourceProfiles=[];

  const rows=value=>Array.isArray(value)?value:[];
  const MAX_SOURCE_PROFILES=32;
  const MAX_ADVISORY_RECORDS=50;
  const MAX_RECORD_CLAIMS=96;
  const MAX_RECORD_UNRESOLVED=48;
  const MAX_RECORD_UNITS=64;
  const SOURCE_ID_PATTERN=/^[a-z0-9][a-z0-9-]{2,63}$/;
  const CLAIM_ID_PATTERN=/^[a-f0-9]{20}$/;
  const PLAN_PATTERN=/^[a-z][a-z0-9-]{1,31}$/;
  const localMeta=()=>g.OptimizerV6?.localMeta||null;
  const setLocalStatus=text=>{localStatus.textContent=text;};
  const setInternetStatus=text=>{internetStatus.textContent=text;};
  const readJson=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}};
  const writeJson=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const readPreference=key=>{try{return localStorage.getItem(key)==='true';}catch{return false;}};
  const writePreference=(key,value)=>{try{localStorage.setItem(key,value?'true':'false');}catch{}};

  function safeApiBase(raw){
    if(!raw)return'';
    try{
      const url=new URL(String(raw),g.location.href);
      const loopback=url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
      if(url.protocol!=='https:'&&!loopback)return'';
      url.search='';url.hash='';
      return url.toString().replace(/\/$/,'');
    }catch{return'';}
  }

  const configuredBase=String(g.EVERTALE_RESEARCH_API_BASE||'');
  const base=safeApiBase(configuredBase);
  const backendConfigured=!!base;

  function localValidation(){
    const model=localMeta();
    return model?model.validateSnapshot(snapshot,context):{valid:false,errors:['V6 local-meta model unavailable']};
  }

  function latestLabel(){
    const row=snapshot?.latest?.[0];
    return row?.name?[row.name,row.title].filter(Boolean).join(' — '):'the newest generated family';
  }

  function internetValidation(advisory=internetAdvisory){
    const errors=[];
    if(!advisory||typeof advisory!=='object')errors.push('internet advisory missing');
    if(Number(advisory?.schemaVersion)!==2)errors.push('internet advisory schema mismatch');
    if(advisory?.advisoryOnly!==true)errors.push('advisory-only marker missing');
    const catalogHash=String(advisory?.catalogHash||advisory?.catalog?.contentHash||'');
    if(!catalogHash)errors.push('canonical catalog hash missing');
    if(advisory?.catalog?.contentHash&&String(advisory.catalog.contentHash)!==catalogHash)errors.push('catalog hash fields disagree');
    if(snapshot?.contentHash&&catalogHash&&snapshot.contentHash!==catalogHash)errors.push('canonical catalog differs from this data build');
    if(!Array.isArray(advisory?.observations))errors.push('observations missing');
    if(rows(advisory?.observations).length>MAX_ADVISORY_RECORDS)errors.push('too many advisory records');
    if(sourceProfiles.length>MAX_SOURCE_PROFILES)errors.push('too many source profiles');
    const now=Math.floor(Date.now()/1000);
    let resolvedUnits=0,claims=0,activeSources=0;
    const verifiedRecords=[];
    const verifiedUnits=[];
    for(const record of rows(advisory?.observations).slice(0,MAX_ADVISORY_RECORDS)){
      const checked=validateInternetRecord(record,catalogHash,now);
      if(checked.expired)continue;
      if(!checked.valid){errors.push(...checked.errors);continue;}
      activeSources+=1;
      claims+=checked.claimCount;
      resolvedUnits+=checked.units.length;
      verifiedRecords.push(record);
      for(const unit of checked.units)verifiedUnits.push({record,unit});
    }
    return{
      valid:errors.length===0,
      usable:errors.length===0&&resolvedUnits>0,
      errors:[...new Set(errors)].slice(0,20),
      resolvedUnits,claims,activeSources,catalogHash,verifiedRecords,verifiedUnits
    };
  }

  function finiteInRange(value,min,max){
    return typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  }

  function canonicalPlans(value){
    const plans=rows(value).filter(plan=>typeof plan==='string'&&PLAN_PATTERN.test(plan));
    return [...new Set(plans)].sort();
  }

  function sameStrings(left,right){
    const a=[...new Set(rows(left).map(String))].sort();
    const b=[...new Set(rows(right).map(String))].sort();
    return a.length===b.length&&a.every((value,index)=>value===b[index]);
  }

  function enabledProfile(sourceId){
    if(!SOURCE_ID_PATTERN.test(String(sourceId||'')))return null;
    const matches=sourceProfiles.filter(row=>row?.id===sourceId&&row?.policyState==='enabled');
    if(matches.length!==1)return null;
    const hosts=rows(matches[0]?.allowedHosts);
    if(!hosts.length||hosts.length>16||hosts.some(host=>typeof host!=='string'||host.length>253))return null;
    return matches[0];
  }

  function validatedHttpsUrl(value,profile){
    try{
      const url=new URL(String(value||''));
      if(url.protocol!=='https:'||url.username||url.password||!["","443"].includes(url.port))return'';
      const hosts=new Set(rows(profile?.allowedHosts).map(item=>String(item).trim().toLowerCase()).filter(Boolean));
      return hosts.has(url.hostname.toLowerCase())?url.href:'';
    }catch{return'';}
  }

  function validateInternetRecord(record,catalogHash,now){
    const sourceId=String(record?.sourceId||'');
    const label=sourceId||'unknown source';
    const fail=message=>({valid:false,expired:false,errors:[`${label}: ${message}`],claimCount:0,units:[]});
    if(!record||typeof record!=='object')return fail('record is not an object');
    if(Number(record.schemaVersion)!==2)return fail('record schema is invalid');
    if(record.advisoryOnly!==true||record.sourcePolicyState!=='enabled')return fail('advisory policy marker is invalid');
    if(record.catalogHash!==catalogHash)return fail('catalog hash is not bound to the advisory');
    const profile=enabledProfile(sourceId);
    if(!profile)return fail('enabled source policy profile is missing or duplicated');
    if(record.sourceType!==profile.sourceType)return fail('source type is not bound to its policy profile');
    if(typeof record.title!=='string'||record.title.length>300)return fail('source title is invalid');
    const sourceUrl=validatedHttpsUrl(record.sourceUrl,profile);
    const fetchedUrl=validatedHttpsUrl(record.fetchedUrl,profile);
    if(!sourceUrl||!fetchedUrl)return fail('source URLs are not HTTPS policy-bound URLs');
    const fetchedAt=record.fetchedAt;
    const expiresAt=record.expiresAt;
    if(!Number.isSafeInteger(fetchedAt)||fetchedAt<=0||fetchedAt>now+300)return fail('fetch timestamp is invalid');
    if(!Number.isSafeInteger(expiresAt)||expiresAt<=fetchedAt||expiresAt>fetchedAt+86400)return fail('expiry is invalid');
    if(expiresAt<=now)return{valid:false,expired:true,errors:[],claimCount:0,units:[]};
    if(!/^[a-f0-9]{64}$/.test(String(record.contentHash||'')))return fail('content hash is invalid');
    if(!Array.isArray(record.claims)||record.claims.length>MAX_RECORD_CLAIMS)return fail('claim count is invalid');
    if(!Array.isArray(record.observedUnits)||record.observedUnits.length>MAX_RECORD_UNITS)return fail('observed unit count is invalid');
    if(!Array.isArray(record.unresolvedMentions)||record.unresolvedMentions.length>MAX_RECORD_UNRESOLVED)return fail('unresolved mention count is invalid');

    const claimById=new Map();
    for(const claim of record.claims){
      const claimId=String(claim?.claimId||'');
      const family=claim?.family;
      const plans=canonicalPlans(claim?.plans);
      const provenance=claim?.provenance;
      if(claim?.identityStatus!=='resolved'||!CLAIM_ID_PATTERN.test(claimId)||claimById.has(claimId))return fail('claim identity is invalid or duplicated');
      if(typeof family!=='string'||!family||family.length>128||rows(claim?.plans).length>16||!plans.length||!sameStrings(plans,claim.plans))return fail('claim family or plans are invalid');
      if(!finiteInRange(claim.confidence,0,1))return fail('claim confidence is invalid');
      if(
        provenance?.sourceId!==sourceId||
        provenance?.sourceUrl!==record.sourceUrl||
        provenance?.fetchedUrl!==record.fetchedUrl||
        provenance?.sourceTitle!==record.title||
        !validatedHttpsUrl(provenance.sourceUrl,profile)||
        !validatedHttpsUrl(provenance.fetchedUrl,profile)
      )return fail('claim provenance is not bound to its source record');
      claimById.set(claimId,{claim,family,plans});
    }
    const recordConfidence=Math.max(0,...[...claimById.values()].map(item=>Number(item.claim.confidence)));
    if(!finiteInRange(record.confidence,0,1)||Math.abs(Number(record.confidence)-recordConfidence)>0.001)return fail('record confidence is not claim-bound');

    const units=[];
    const seenFamilies=new Set();
    const usedClaimIds=new Set();
    for(const unit of record.observedUnits){
      const family=unit?.family;
      const claimIds=rows(unit?.claimIds).map(String);
      if(unit?.identityStatus!=='resolved'||typeof family!=='string'||!family||family.length>128||seenFamilies.has(family))return fail('observed unit identity is invalid or duplicated');
      if(!claimIds.length||claimIds.length>MAX_RECORD_CLAIMS||claimIds.length!==new Set(claimIds).size)return fail('observed unit claim links are invalid');
      if(rows(unit?.plans).length>16)return fail('observed unit plan count is invalid');
      const linked=claimIds.map(id=>claimById.get(id));
      if(linked.some(item=>!item||item.family!==family))return fail('claim family does not match its observed unit');
      const supportedPlans=[...new Set(linked.flatMap(item=>item.plans))].sort();
      if(!supportedPlans.length||!sameStrings(supportedPlans,unit.plans))return fail('observed unit plans are not exactly supported by linked claims');
      const confidence=Math.max(...linked.map(item=>Number(item.claim.confidence)));
      if(!finiteInRange(unit.confidence,0.6,1)||Math.abs(Number(unit.confidence)-confidence)>0.001)return fail('observed unit confidence is not claim-bound');
      if(!finiteInRange(unit.score,0,100)||Math.abs(Number(unit.score)-confidence*100)>0.05)return fail('observed unit score is not confidence-bound');
      for(const claimId of claimIds)usedClaimIds.add(claimId);
      seenFamilies.add(family);
      units.push(unit);
    }
    return{valid:true,expired:false,errors:[],claimCount:usedClaimIds.size,units};
  }

  function renderLocalStatus(prefix=''){
    const check=localValidation();
    localToggle.disabled=!check.valid;
    if(!check.valid){
      localToggle.checked=false;
      setLocalStatus(prefix||'Latest-unit cache is unavailable. Deterministic V6 remains fully active.');
      return;
    }
    const mode=localToggle.checked?'enabled':'available';
    const note=`Local newer-unit prior ${mode}: ${snapshot.latest.length} recent families through ${latestLabel()}. Generated release order only; not an internet ranking.`;
    setLocalStatus(prefix?`${prefix} ${note}`:note);
  }

  function safeEvidenceUrl(record){
    return validatedHttpsUrl(record?.fetchedUrl||record?.sourceUrl,enabledProfile(record?.sourceId));
  }

  function addFindingLine(parent,text,className='muted'){
    const line=d.createElement('div');
    line.className=className;
    line.textContent=text;
    parent.appendChild(line);
    return line;
  }

  function renderInternetFindings(){
    findingsList.replaceChildren();
    const policyCounts=sourceProfiles.reduce((out,row)=>{
      const state=String(row?.policyState||'unknown');
      out[state]=(out[state]||0)+1;
      return out;
    },{});
    if(sourceProfiles.length){
      addFindingLine(findingsList,`Source policy: ${policyCounts.enabled||0} enabled, ${policyCounts.disabled||0} disabled, ${policyCounts.blocked||0} blocked.`);
    }
    const check=internetValidation();
    const records=check.valid?check.verifiedRecords:[];
    findings.hidden=!records.length&&!sourceProfiles.length;
    findingsSummary.textContent=check.usable
      ?`Internet findings — ${check.resolvedUnits} resolved unit observations`
      :'Internet research source report';
    for(const record of records.slice(0,20)){
      const card=d.createElement('div');
      card.style.marginTop='8px';
      const title=String(record?.title||record?.sourceId||'Approved source');
      const href=safeEvidenceUrl(record);
      if(href){
        const link=d.createElement('a');
        link.href=href;
        link.target='_blank';
        link.rel='noopener noreferrer';
        link.textContent=title;
        card.appendChild(link);
      }else addFindingLine(card,title,'');
      const fetched=Number(record?.fetchedAt)>0?new Date(Number(record.fetchedAt)*1000).toLocaleString():'unknown time';
      addFindingLine(card,`${record?.sourceType||'public'} • fetched ${fetched} • ${rows(record?.claims).length} claims`);
      for(const unit of rows(record?.observedUnits).filter(unit=>unit?.identityStatus==='resolved').slice(0,12)){
        const label=[unit?.name,unit?.title].filter(Boolean).join(' — ')||unit?.family;
        const plans=rows(unit?.plans).join(', ')||'unclassified plan';
        addFindingLine(card,`${label}: ${plans} (${Math.round(Number(unit?.confidence||0)*100)}% source confidence)`);
      }
      const ambiguous=rows(record?.unresolvedMentions).length;
      if(ambiguous)addFindingLine(card,`${ambiguous} ambiguous name mention${ambiguous===1?' was':'s were'} withheld from scoring.`);
      findingsList.appendChild(card);
    }
  }

  function renderInternetStatus(prefix=''){
    renderInternetFindings();
    if(!backendConfigured){
      internetToggle.checked=false;
      internetToggle.disabled=true;
      researchButton.disabled=true;
      const reason=configuredBase?'The configured research API URL is not HTTPS or local loopback.':'No internet research backend is configured.';
      setInternetStatus(prefix||`${reason} Local cache and deterministic V6 remain available.`);
      return;
    }
    const check=internetValidation();
    internetToggle.disabled=!check.usable;
    if(!check.usable)internetToggle.checked=false;
    researchButton.disabled=false;
    if(!check.valid){
      setInternetStatus(prefix||'Internet research is available on demand; no compatible cached advisory is loaded.');
      return;
    }
    if(!check.usable){
      setInternetStatus(prefix||`Internet cache checked ${check.activeSources} approved sources but found no unambiguous unit-plan claims. The internet prior remains off.`);
      return;
    }
    if(!localToggle.checked){
      internetToggle.checked=false;
      internetToggle.disabled=true;
      setInternetStatus(prefix||`Internet advisory available with ${check.claims} provenance-backed claims. Enable the local newer-unit prior before adding internet evidence.`);
      return;
    }
    const mode=internetToggle.checked?'enabled':'available';
    const note=`Internet advisory ${mode}: ${check.resolvedUnits} resolved unit observations and ${check.claims} provenance-backed claims from ${check.activeSources} approved sources.`;
    setInternetStatus(prefix?`${prefix} ${note}`:note);
  }

  function backendScores(){
    const out={};
    const check=internetValidation();
    if(!check.usable)return out;
    for(const {unit} of check.verifiedUnits){
      const key=localMeta()?.identityKey(unit?.family||unit?.sourceIds?.[0]);
      if(!key)continue;
      const score=Math.max(0,Math.min(100,Number(unit.score)));
      out[key]=Math.max(Number(out[key])||0,score);
    }
    return out;
  }

  function getEngineOptions(){
    const model=localMeta();
    if(!model)return{enabled:false,schemaVersion:1,dataVersion,source:'none',validationErrors:['model unavailable']};
    const useLocal=localToggle.checked&&localValidation().valid;
    const useInternet=useLocal&&internetToggle.checked&&internetValidation().usable;
    const options=model.engineOptions(snapshot,useLocal||useInternet,context);
    if(!options.enabled)return options;
    const scores={};
    if(useLocal)Object.assign(scores,snapshot.scoresByIdentity||{});
    if(useInternet){
      for(const [key,value] of Object.entries(backendScores()))scores[key]=Math.max(Number(scores[key])||0,value);
    }
    options.scoresByIdentity=scores;
    options.source=[useLocal?'generated-release-order':'',useInternet?'public-research-advisory':''].filter(Boolean).join('+');
    options.advisoryModes={localReleaseOrder:useLocal,internetResearch:useInternet};
    options.internetClaimCount=useInternet?internetValidation().claims:0;
    if(useInternet)options.cachedAt=Math.max(Number(options.cachedAt)||0,Number(internetAdvisory?.fetchedAt)||0);
    return options;
  }

  g.OptimizerMetaAdvisory={
    getSnapshot:()=>snapshot,
    getInternetAdvisory:()=>internetAdvisory,
    getSourceProfiles:()=>sourceProfiles.slice(),
    isAvailable:()=>localValidation().valid,
    isEnabled:()=>getEngineOptions().enabled,
    isInternetAvailable:()=>internetValidation().usable,
    validateInternetAdvisory:advisory=>internetValidation(advisory),
    getEngineOptions,
    refresh:()=>refreshLocalSnapshot(),
    research:()=>runInternetResearch()
  };

  function publish(){
    g.__optimizerLocalMetaSnapshot=snapshot;
    g.__optimizerResearchAdvisory=internetAdvisory;
    try{
      g.dispatchEvent(new CustomEvent('optimizer-meta-advisory-updated',{detail:{
        localAvailable:localValidation().valid,
        localEnabled:localToggle.checked,
        internetAvailable:internetValidation().usable,
        internetEnabled:internetToggle.checked,
        dataVersion
      }}));
    }catch{}
  }

  async function refreshLocalSnapshot({quiet=false}={}){
    const model=localMeta();
    if(!model)throw new Error('V6 local-meta model is unavailable');
    const bundleBase=String(config.bundlesBase||'./apkfiles/entries/bundles').replace(/\/$/,'');
    const url=`${bundleBase}/character_families.bundle.json?v=${encodeURIComponent(dataVersion)}`;
    if(!quiet)setLocalStatus('Refreshing the generated latest-unit cache…');
    const response=await fetch(url,{cache:'default'});
    if(!response.ok)throw new Error(`Latest-unit bundle request failed: ${response.status}`);
    const bundle=await response.json();
    snapshot=model.buildSnapshot(bundle,{dataVersion,cachedAt:Date.now()});
    if(!model.validateSnapshot(snapshot,context).valid)throw new Error('Generated latest-unit cache failed validation');
    writeJson(SNAPSHOT_KEY,snapshot);
    localToggle.disabled=false;
    localToggle.checked=readPreference(LOCAL_ENABLED_KEY);
    if(!internetValidation().valid)internetToggle.checked=false;
    publish();
    renderLocalStatus(quiet?'':`Latest-unit cache refreshed from ${Number(snapshot.entryCount)||0} generated families.`);
    renderInternetStatus();
    return snapshot;
  }

  async function requestJson(url,options={},timeoutMs=15000){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(url,{...options,signal:controller.signal});
      if(!response.ok)throw new Error(`Research request failed: ${response.status}`);
      const contentType=String(response.headers.get('Content-Type')||'').toLowerCase();
      if(!contentType.startsWith('application/json'))throw new Error('Research response was not JSON');
      const advertised=Number(response.headers.get('Content-Length')||0);
      if(advertised>2*1024*1024)throw new Error('Research response exceeds size limit');
      const text=await response.text();
      if(text.length>2*1024*1024)throw new Error('Research response exceeds size limit');
      return JSON.parse(text);
    }finally{clearTimeout(timeout);}
  }

  function normalizeInternetAdvisory(payload){
    return{
      schemaVersion:2,
      advisoryOnly:true,
      dataVersion,
      catalogHash:String(payload?.catalog?.contentHash||payload?.catalogHash||''),
      catalog:payload?.catalog||null,
      sources:rows(payload?.sources).length?rows(payload.sources):sourceProfiles,
      observations:rows(payload?.observations||payload?.results),
      fetchedAt:Date.now()
    };
  }

  async function loadInternetLatest({quiet=false}={}){
    if(!backendConfigured)return null;
    try{
      const [profiles,latest]=await Promise.all([
        requestJson(`${base}/api/research/sources`),
        requestJson(`${base}/api/research/latest`)
      ]);
      sourceProfiles=rows(profiles?.sources);
      const candidate=normalizeInternetAdvisory({...latest,sources:sourceProfiles});
      if(!internetValidation(candidate).valid)throw new Error('Research advisory failed provenance validation');
      internetAdvisory=candidate;
      writeJson(INTERNET_CACHE_KEY,internetAdvisory);
      internetToggle.checked=localToggle.checked&&internetValidation().usable&&readPreference(INTERNET_ENABLED_KEY);
      publish();
      renderInternetFindings();
      renderInternetStatus(quiet?'':'Loaded the backend’s latest cached advisory.');
      return internetAdvisory;
    }catch(error){
      if(!quiet)renderInternetStatus(`Research backend unavailable: ${String(error?.message||error)}. Using any last compatible browser cache.`);
      return null;
    }
  }

  async function poll(jobId){
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      const job=await requestJson(`${base}/api/research/jobs/${encodeURIComponent(jobId)}`,{},20000);
      setInternetStatus(`${job.progress||0}% — ${job.events?.slice(-1)[0]?.message||job.stage}`);
      if(job.status==='complete'){
        const candidate=normalizeInternetAdvisory({catalog:job.catalog,results:job.results,sources:sourceProfiles});
        if(!internetValidation(candidate).valid)throw new Error('Research job returned an invalid advisory');
        internetAdvisory=candidate;
        writeJson(INTERNET_CACHE_KEY,internetAdvisory);
        internetToggle.checked=localToggle.checked&&internetValidation().usable&&readPreference(INTERNET_ENABLED_KEY);
        publish();
        renderInternetFindings();
        renderInternetStatus(`Public research completed across ${rows(job.sourceIds).length} server-approved sources.`);
        return internetAdvisory;
      }
      if(job.status==='failed')throw new Error(job.errors?.[0]?.error||'Research job failed');
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    throw new Error('Research job timed out');
  }

  async function runInternetResearch(){
    if(!backendConfigured){renderInternetStatus();return null;}
    researchButton.disabled=true;
    try{
      if(!localValidation().valid)await refreshLocalSnapshot({quiet:true});
      setInternetStatus('Queuing server-approved public sources…');
      const job=await requestJson(`${base}/api/research/jobs`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceIds:[]})
      });
      return await poll(job.jobId);
    }catch(error){
      renderInternetStatus(`Internet research unavailable: ${String(error?.message||error)}. Deterministic V6 and the local cache are unaffected.`);
      return null;
    }finally{researchButton.disabled=false;}
  }

  async function runLocalRefresh(){
    refreshLocalButton.disabled=true;
    try{await refreshLocalSnapshot();}
    catch(error){renderLocalStatus(`Local refresh unavailable: ${String(error?.message||error)}. Using the last valid cache when possible.`);}
    finally{refreshLocalButton.disabled=false;}
  }

  async function boot(){
    try{await g.OptimizerV6Loader?.ready;}catch{}
    snapshot=readJson(SNAPSHOT_KEY);
    internetAdvisory=readJson(INTERNET_CACHE_KEY);
    sourceProfiles=rows(internetAdvisory?.sources);
    localToggle.checked=localValidation().valid&&readPreference(LOCAL_ENABLED_KEY);
    internetToggle.checked=localToggle.checked&&internetValidation().usable&&readPreference(INTERNET_ENABLED_KEY);
    researchButton.textContent='Research Public Strategies';
    researchButton.title=backendConfigured
      ?'Ask the optional backend to inspect only its server-approved public sources.'
      :'Requires an HTTPS research backend. No live research runs in the browser.';
    refreshLocalButton.title='Refresh generated release-order data from this site; no internet research service is used.';
    localToggle.title='Use the generated release-order cache inside the optimizer’s bounded meta slice.';
    internetToggle.title='Use only unambiguous, provenance-backed unit-plan claims inside the same bounded meta slice.';
    publish();
    renderInternetFindings();
    renderLocalStatus();
    renderInternetStatus();
    if(!localValidation().valid){
      try{await refreshLocalSnapshot();}catch(error){renderLocalStatus(`Latest-unit cache unavailable: ${String(error?.message||error)}.`);}
    }
    if(backendConfigured)await loadInternetLatest({quiet:true});
  }

  localToggle.addEventListener('change',()=>{
    if(localToggle.disabled)return;
    writePreference(LOCAL_ENABLED_KEY,localToggle.checked);
    if(!localToggle.checked){
      internetToggle.checked=false;
      writePreference(INTERNET_ENABLED_KEY,false);
    }
    publish();
    renderLocalStatus(localToggle.checked?'Local newer-unit prior enabled.':'Local newer-unit prior disabled.');
    renderInternetStatus();
  });
  internetToggle.addEventListener('change',()=>{
    if(internetToggle.disabled)return;
    writePreference(INTERNET_ENABLED_KEY,internetToggle.checked);
    publish();
    renderInternetStatus(internetToggle.checked?'Internet research prior enabled.':'Internet research prior disabled.');
  });
  refreshLocalButton.addEventListener('click',runLocalRefresh);
  researchButton.addEventListener('click',runInternetResearch);
  boot();
})(window,document);
