/* test-catalog-v2-leader-detail-fix.js
   Fixes only the sidebar Leader Skill detail text.
*/
(function(){
  const URL='./apkfiles/entries/localization/leader_skill_localization.json';
  let cache=null;
  const q=(s,r=document)=>r.querySelector(s);
  const clean=v=>String(v||'').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');
  function cardById(id){
    if(!id)return null;
    const esc=window.CSS&&window.CSS.escape?window.CSS.escape(String(id)):String(id).replace(/"/g,'\\"');
    return q(`#catalogGrid .unitCard[data-id="${esc}"],#catalogGrid .unitCard[data-source-id="${esc}"],#catalogGrid .unitCard[data-family="${esc}"]`);
  }
  function card(){
    return window.EvertaleCatalogV2?.selectedCard?.()||
      q('#catalogGrid .unitCard.v2-selected')||
      cardById(window.EvertaleCatalogV2?.getSelectedId?.()||q('#v2AwakenTabs')?.dataset?.v2ActiveCard||'');
  }
  async function data(){
    if(cache)return cache;
    try{const r=await fetch(URL,{cache:'no-store'});const j=await r.json();cache=j&&j.skills?j.skills:{};}catch{cache={};}
    return cache;
  }
  function keys(c){return [c?.getAttribute('data-source-id'),c?.getAttribute('data-family'),c?.getAttribute('data-id'),c?.getAttribute('data-duo-root'),c?.getAttribute('data-duo-active-id'),q('.unitName',c)?.textContent,q('.unitTitle',c)?.textContent].map(clean).filter(Boolean);}
  function setPanel(name,desc){
    const panel=q('#v2SidebarDetailPanel');
    if(!panel)return;
    panel.textContent='';
    const p=document.createElement('p');
    const strong=document.createElement('strong');
    strong.textContent=name||'Leader Skill';
    p.appendChild(strong);
    p.appendChild(document.createElement('br'));
    p.appendChild(document.createTextNode(desc||'No leader skill loaded.'));
    panel.appendChild(p);
  }
  async function fix(){
    const active=q('#v2SidebarDetailTabs button.active');
    if(active?.dataset?.sidebarDetail!=='leader')return;
    const c=card(); if(!c)return;
    const name=q('.leaderName',c)?.textContent?.trim()||'';
    const desc=q('.leaderDesc',c)?.textContent?.trim()||'';
    if(desc&&!/no leader skill|does not provide|not loaded/i.test(desc)){setPanel(name,desc);return;}
    const list=await data();
    const k=new Set(keys(c));
    for(const item of Object.values(list)){
      const ids=Array.isArray(item.sourceIds)?item.sourceIds:[];
      if(ids.some(id=>k.has(clean(id)))){setPanel(item.name||name||'Leader Skill',item.description||item.affected||desc||'No leader skill loaded.');return;}
    }
  }
  function later(){setTimeout(()=>fix().catch(()=>{}),90);}
  document.addEventListener('click',e=>{if(e.target.closest('#v2SidebarDetailTabs button,#catalogGrid .unitCard,#v2AwakenTabs button'))later();},true);
  document.addEventListener('v2:hero-state-change',later);
  document.addEventListener('DOMContentLoaded',()=>{later();setTimeout(later,800);setTimeout(later,1600);});
})();
