/* Lightweight badge/state authority for live Catalog.
   Removed document-wide MutationObserver and capture click rescans.
*/
(function(){
  const STATE_LABELS=['5\u2605','6\u2605','FA'];
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const kindLabel=k=>k==='characters'?'Character':k==='weapons'?'Weapon':k==='accessories'?'Accessories':k==='bosses'?'Boss':'';
  const clean=v=>String(v||'').trim().toLowerCase();
  const rarityLimit=card=>{const r=clean(q('.tag.rarity',card)?.textContent||card?.dataset?.rarity||'');if(/ssr|5|6/.test(r))return 3;if(/sr|3|4/.test(r))return 2;return 0;};
  function inject(){
    if(document.getElementById('v2-source-badge-authority-style'))return;
    const style=document.createElement('style');
    style.id='v2-source-badge-authority-style';
    style.textContent=`
      body.page-catalog-v2 .unitCard[data-kind="weapons"] .stateRow,
      body.page-catalog-v2 .unitCard[data-kind="accessories"] .stateRow,
      body.page-catalog-v2 .unitCard[data-kind="weapons"] .tag.element,
      body.page-catalog-v2 .unitCard[data-kind="accessories"] .tag.element,
      body.page-catalog-v2 #v2AwakenTabs[data-v2-kind="weapons"],
      body.page-catalog-v2 #v2AwakenTabs[data-v2-kind="accessories"]{display:none!important;}
      body.page-catalog-v2 #v2AwakenTabs button.v2-state-hidden,
      body.page-catalog-v2 .stateRow .stateBtn.v2-state-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important;}
      body.page-catalog-v2 #v2Pills[data-v2-kind="weapons"],
      body.page-catalog-v2 #v2Pills[data-v2-kind="accessories"]{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
    `;
    document.head.appendChild(style);
  }
  function stateRows(card){
    if(window.EvertaleCatalogV2&&typeof window.EvertaleCatalogV2.readStateRows==='function'){
      try{return window.EvertaleCatalogV2.readStateRows(card).filter(Boolean).slice(0,3);}catch{}
    }
    try{
      const rows=JSON.parse(decodeURIComponent(card?.getAttribute('data-state-rows')||q('.stateRow',card)?.getAttribute('data-states')||'[]'));
      return Array.isArray(rows)?rows.filter(Boolean).slice(0,3):[];
    }catch{return[];}
  }
  function stateCount(card){
    return Math.max(stateRows(card).length,qa('.stateRow .stateBtn',card).length,0);
  }
  function applyCard(card){
    if(!card||card.dataset.v2BadgeAuthorityDone==='1')return;
    card.dataset.v2BadgeAuthorityDone='1';
    const kind=card.getAttribute('data-kind')||'';
    if(!kind||kind==='bosses')return;
    const kindTag=q('.tag.kind',card);if(kindTag)kindTag.textContent=kindLabel(kind);
    if(kind==='weapons'||kind==='accessories'){qa('.tag.element',card).forEach(n=>n.remove());q('.stateRow',card)?.remove();return;}
    if(kind==='characters'){
      const row=q('.stateRow',card);if(!row)return;
      const rows=stateCount(card);const limit=rarityLimit(card);const count=Math.max(1,Math.min(limit||rows||1,rows||limit||1,3));
      row.dataset.smartStateCount=String(count);
      qa('.stateBtn',row).forEach((btn,i)=>{const show=i<count;btn.classList.toggle('v2-state-hidden',!show);btn.hidden=!show;btn.setAttribute('aria-label',STATE_LABELS[i]||`State ${i+1}`);btn.setAttribute('aria-pressed',String(btn.classList.contains('active')));});
    }
  }
  function syncVisible(){inject();qa('#catalogGrid .unitCard').forEach(applyCard);}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(syncVisible,0));
  document.addEventListener('click',e=>{const card=e.target.closest('#catalogGrid .unitCard');if(card)applyCard(card);},true);
  document.addEventListener('change',e=>{if(e.target.closest('#catalogType,#catalogSort'))setTimeout(syncVisible,0);},true);
  window.addEventListener('scroll',()=>{if(!syncVisible._t)syncVisible._t=requestAnimationFrame(()=>{syncVisible._t=0;syncVisible();});},{passive:true});
})();
