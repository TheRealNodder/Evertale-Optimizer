(function(g,d){
  'use strict';
  const button=d.getElementById('researchStrategies'),status=d.getElementById('researchStatus'),toggle=d.getElementById('useAdvisoryMetaPrior');
  if(!button||!status)return;
  const base=String(g.EVERTALE_RESEARCH_API_BASE||'').replace(/\/$/,''),sources=Array.isArray(g.EVERTALE_RESEARCH_SOURCES)?g.EVERTALE_RESEARCH_SOURCES:[];
  const setStatus=text=>{status.textContent=text;};
  if(!base||!sources.length){button.disabled=true;toggle&&(toggle.disabled=true);setStatus('Optional research backend is not configured. Deterministic V6 remains fully active.');return;}
  async function json(url,options){const response=await fetch(url,options);if(!response.ok)throw new Error(`Research request failed: ${response.status}`);return response.json();}
  async function poll(jobId){
    for(;;){const job=await json(`${base}/api/research/jobs/${encodeURIComponent(jobId)}`);setStatus(`${job.progress||0}% — ${job.events?.slice(-1)[0]?.message||job.stage}`);if(job.status==='complete'){g.__optimizerResearchAdvisory={advisoryOnly:true,observations:job.results||[],fetchedAt:Date.now()};const newest=Math.max(0,...(job.results||[]).map(row=>Number(row.fetchedAt)||0));setStatus(`Research complete: ${(job.results||[]).length} advisory observations${newest?` (${new Date(newest*1000).toLocaleDateString()})`:''}. Deterministic weights are unchanged.`);return;}if(job.status==='failed')throw new Error(job.errors?.[0]?.error||'Research job failed');await new Promise(resolve=>setTimeout(resolve,1000));}
  }
  button.addEventListener('click',async()=>{button.disabled=true;try{setStatus('Queuing approved public sources…');const job=await json(`${base}/api/research/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sources})});await poll(job.jobId);}catch(error){setStatus(`Research unavailable: ${String(error?.message||error)}. Deterministic V6 is unaffected.`);}finally{button.disabled=false;}});
})(window,document);
