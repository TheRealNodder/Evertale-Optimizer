/* test-catalog-v2-source-badge-authority.js
   Single badge/state authority for Test Catalog V2.
   Runs before desktop layout scripts so cards/sidebar start from one rule set.
   Boss rules are intentionally not customized yet.
*/
(function(){
  const STATE_LABELS=['5★','6★','FA'];
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const kindLabel=k=>k==='characters'?'Character':k==='weapons'?'Weapon':k==='accessories'?'Accessories':k==='bosses'?'Boss':'';
  const clean=v=>String(v||'').trim().toLowerCase();
  const rarityLimit=card=>{const r=clean(q('.tag.rarity',card)?.textContent||card?.dataset?.rarity||'');if(/ssr|5/.test(r))return 3;if(/sr|4/.test(r))return 2;return 1;};
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
      body.page-catalog-v2 #v2AwakenTabs button[data-sidebar-synthetic="1"],
      body.page-catalog-v2 #v2AwakenTabs button.v2-state-hidden,
      body.page-catalog-v2 .stateRow .stateBtn.v2-state-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important;}
      body.page-catalog-v2 #v2Pills[data-v2-kind="weapons"],
      body.page-catalog-v2 #v2Pills[data-v2-kind="accessories"]{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
    `;
    document.head.appendChild(style);
  }
  function imageRows(card){try{return JSON.parse(decodeURIComponent(q('.stateRow',card)?.getAttribute('data-imgs')||q('.unitThumb img',card)?.getAttribute('data-imgs')||'[]')).filter(Boolean).slice(0,3);}catch{return[];}}
  function applyCard(card){
    const kind=card?.getAttribute('data-kind')||'';
    if(!kind||kind==='bosses')return;
    const kindTag=q('.tag.kind',card);if(kindTag)kindTag.textContent=kindLabel(kind);
    if(kind==='weapons'||kind==='accessories'){qa('.tag.element',card).forEach(n=>n.remove());q('.stateRow',card)?.remove();return;}
    if(kind==='characters'){
      const row=q('.stateRow',card);if(!row)return;
      const imgs=imageRows(card);const count=Math.max(1,Math.min(rarityLimit(card),imgs.length||1,3));
      row.dataset.smartStateCount=String(count);
      qa('.stateBtn',row).forEach((btn,i)=>{const show=i<count;btn.classList.toggle('v2-state-hidden',!show);btn.hidden=!show;btn.setAttribute('aria-label',STATE_LABELS[i]||`State ${i+1}`);});
    }
  }
  function sidebarCard(){return q('#catalogGrid .unitCard.v2-selected')||q('#catalogGrid .unitCard');}
  function syncSidebar(){
    const card=sidebarCard();if(!card)return;
    const kind=card.getAttribute('data-kind')||'';if(!kind||kind==='bosses')return;
    const pills=q('#v2Pills');
    if(pills){
      pills.dataset.v2Kind=kind;
      const rarity=q('.tag.rarity',card)?.textContent?.trim()||'Rarity';
      let html=`<span class="v2-sidebar-badge" data-sidebar-badge="kind">${kindLabel(kind)}</span>`;
      if(kind==='characters')html+=`<span class="v2-sidebar-badge" data-sidebar-badge="element">${q('.tag.element',card)?.textContent?.trim()||'Element'}</span>`;
      html+=`<span class="v2-sidebar-badge" data-sidebar-badge="rarity">${rarity}</span>`;
      if(pills.innerHTML!==html)pills.innerHTML=html;
    }
    const tabs=q('#v2AwakenTabs');if(!tabs)return;
    tabs.dataset.v2Kind=kind;
    if(kind==='weapons'||kind==='accessories')return;
    const count=Math.max(1,Math.min(rarityLimit(card),imageRows(card).length||1,3));
    qa('button',tabs).forEach((btn,i)=>{const show=i<count&&!btn.dataset.sidebarSynthetic;btn.classList.toggle('v2-state-hidden',!show);btn.hidden=!show;btn.setAttribute('aria-label',STATE_LABELS[i]||`State ${i+1}`);});
  }
  let t=null;
  function run(){inject();qa('#catalogGrid .unitCard').forEach(applyCard);syncSidebar();}
  function schedule(delay=0){clearTimeout(t);t=setTimeout(run,delay);}
  document.addEventListener('DOMContentLoaded',()=>{run();setTimeout(run,80);setTimeout(run,260);});
  document.addEventListener('click',e=>{if(e.target.closest('#catalogGrid,.stateBtn,.duoFormBtn,#v2AwakenTabs'))schedule(0);},true);
  document.addEventListener('change',e=>{if(e.target.closest('#catalogType,#catalogSort'))setTimeout(run,0);},true);
  new MutationObserver(()=>schedule(0)).observe(document.documentElement,{childList:true,subtree:true});
})();
