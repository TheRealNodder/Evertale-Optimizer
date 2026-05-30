/* catalog-description-state-fix.js
   Hot fix: hydrate per-state descriptions from character_families.bundle.json states[].
   This avoids relying only on descriptionByForm, which is often empty.
*/
(function(){
  const URL='./apkfiles/entries/bundles/character_families.bundle.json';
  let cache=null;
  function key(v){return String(v||'').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');}
  async function load(){
    if(cache)return cache;
    const r=await fetch(URL,{cache:'no-store'});
    const j=await r.json();
    const m=new Map();
    (Array.isArray(j.entries)?j.entries:[]).forEach(e=>{
      const rows=(Array.isArray(e.states)?e.states:[]).slice(0,3).map(s=>({
        title:s.title||'',
        name:s.name||'',
        description:s.description||'',
        sourceId:s.sourceId||s.dataSourceId||''
      }));
      if(!rows.length)return;
      [e.family,e.id,e.sourceId,e.name,e.title].forEach(v=>{const k=key(v);if(k&&!m.has(k))m.set(k,rows);});
      rows.forEach(s=>{const k=key(s.sourceId);if(k&&!m.has(k))m.set(k,rows);});
    });
    cache=m;return m;
  }
  function cardKey(card){
    return [card.getAttribute('data-duo-root'),card.getAttribute('data-id'),card.querySelector('.unitName')?.textContent,card.querySelector('.unitTitle')?.textContent].map(key).find(Boolean)||'';
  }
  function applyRows(card,rows){
    const panel=card.querySelector('.descriptionPanel');
    if(!panel||!rows||!rows.length)return;
    panel.setAttribute('data-descriptions',encodeURIComponent(JSON.stringify(rows)));
    const idx=parseInt(card.querySelector('.unitThumb img')?.getAttribute('data-state')||card.getAttribute('data-duo-index')||'0',10)||0;
    const row=rows[Math.min(Math.max(idx,0),rows.length-1)];
    const desc=card.querySelector('.descriptionText');
    if(desc)desc.textContent=row.description||'';
  }
  async function hydrate(){
    const map=await load();
    document.querySelectorAll('.unitCard[data-kind="characters"]').forEach(card=>{
      const rows=map.get(cardKey(card));
      if(rows)applyRows(card,rows);
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>hydrate().catch(console.warn),800);
    document.getElementById('catalogGrid')?.addEventListener('click',e=>{
      if(e.target.closest('.stateBtn,.duoFormBtn'))setTimeout(()=>hydrate().catch(console.warn),30);
    });
  });
})();
