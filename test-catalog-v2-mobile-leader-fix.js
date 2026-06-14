/* test-catalog-v2-mobile-leader-fix.js
   Mobile detail popover leader text hydrator.
   Logic only: no style or layout changes.
*/
(function(){
  const URL='./apkfiles/entries/localization/leader_skill_localization.json';
  let cache=null;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const clean=v=>String(v||'').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');

  async function skills(){
    if(cache)return cache;
    try{const r=await fetch(URL,{cache:'no-store'});const j=await r.json();cache=j&&j.skills?Object.values(j.skills):[];}catch{cache=[];}
    return cache;
  }

  function cardKeys(card){
    return [
      card?.getAttribute('data-source-id'),
      card?.getAttribute('data-family'),
      card?.getAttribute('data-id'),
      card?.getAttribute('data-duo-root'),
      card?.getAttribute('data-duo-active-id'),
      q('.unitName',card)?.textContent,
      q('.unitTitle',card)?.textContent
    ].map(clean).filter(Boolean);
  }

  function directLeader(card){
    const name=q('.leaderName',card)?.textContent?.trim()||'';
    const desc=q('.leaderDesc',card)?.textContent?.trim()||'';
    if(desc&&!/no leader skill|does not provide|not loaded/i.test(desc))return{name:name||'Leader Skill',description:desc};
    return null;
  }

  async function resolveLeader(card){
    const direct=directLeader(card);
    if(direct)return direct;
    const keys=new Set(cardKeys(card));
    for(const item of await skills()){
      const ids=Array.isArray(item?.sourceIds)?item.sourceIds:[];
      if(ids.some(id=>keys.has(clean(id))))return{name:item.name||'Leader Skill',description:item.description||item.affected||'No leader skill loaded.'};
    }
    return null;
  }

  function leaderPanel(card){
    const pop=q('.v2-detail-backdrop',card);
    if(!pop)return null;
    const sections=qa('.v2-detail-section',pop);
    return sections.find(sec=>/leader skill/i.test(q('summary',sec)?.textContent||''))?.querySelector('.v2-detail-panel')||null;
  }

  function writePanel(panel,leader){
    if(!panel||!leader)return;
    const next=`${leader.name}\n${leader.description}`;
    if(panel.textContent.trim()===next.trim())return;
    panel.textContent='';
    const strong=document.createElement('strong');
    strong.textContent=leader.name||'Leader Skill';
    panel.appendChild(strong);
    panel.appendChild(document.createElement('br'));
    panel.appendChild(document.createTextNode(leader.description||'No leader skill loaded.'));
  }

  async function hydrateCard(card){
    if(!card||card.getAttribute('data-kind')!=='characters')return;
    const panel=leaderPanel(card);
    if(!panel)return;
    const leader=await resolveLeader(card);
    if(leader)writePanel(panel,leader);
  }

  function hydrateVisible(){qa('#catalogGrid .unitCard').forEach(card=>hydrateCard(card).catch(()=>{}));}
  function schedule(){setTimeout(hydrateVisible,80);}

  document.addEventListener('DOMContentLoaded',()=>{schedule();setTimeout(hydrateVisible,900);setTimeout(hydrateVisible,1800);});
  document.addEventListener('click',e=>{if(e.target.closest('.v2-detail-btn,.unitCard,.stateBtn,.duoFormBtn'))schedule();},true);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
