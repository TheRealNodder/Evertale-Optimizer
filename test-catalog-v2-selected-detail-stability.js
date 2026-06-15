/* test-catalog-v2-selected-detail-stability.js
   Final selected-detail guard.
   Keeps the desktop detail panel tied to the currently selected card instead of falling back to the first card.
   No mobile, data, sorting, card rendering, or badge-count changes.
*/
(function(){
  const BREAKPOINT=821;
  let lastCard=null;
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const safe=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>');
  const decode=v=>{try{const rows=JSON.parse(decodeURIComponent(v||''));return Array.isArray(rows)?rows:[];}catch{return[];}};
  function isDesktop(){return window.innerWidth>=BREAKPOINT;}
  function currentCard(){return lastCard&&document.contains(lastCard)?lastCard:q('#catalogGrid .unitCard.v2-selected');}
  function activeKind(){return q('#v2SidebarDetailTabs button.active')?.dataset?.sidebarDetail||q('.v2-detail-tab-btn.active')?.getAttribute('data-v2-detail-kind')||'leader';}
  function rows(card,type){return decode(card?.getAttribute(type==='active'?'data-active-skills':'data-passive-skills'));}
  function skill(card,type){const r=rows(card,type);if(!r.length)return'<p>No skills loaded.</p>';return r.map(row=>`<p><strong>${safe(row?.name||row?.id||'Skill')}</strong>${row?.tu||row?.sp!==undefined?`<br><span>${safe([row?.tu?`${row.tu} TU`:'',row?.sp!==undefined?`${Number(row.sp)>0?'+':''}${row.sp} SP`:''].filter(Boolean).join(' • '))}</span>`:''}<br>${safe(row?.description||'No description loaded.')}</p>`).join('');}
  function leader(card){const name=q('.leaderName',card)?.textContent?.trim()||'Leader Skill';const desc=q('.leaderDesc',card)?.textContent?.trim()||'No leader skill loaded.';return`<p><strong>${safe(name)}</strong><br>${safe(desc)}</p>`;}
  function description(card){const desc=q('#v2Desc')?.textContent?.trim()||q('.descriptionText',card)?.textContent?.trim()||card?.getAttribute('data-description')||'No description loaded.';return`<p>${safe(desc)}</p>`;}
  function render(kind=activeKind()){
    if(!isDesktop())return;
    const card=currentCard();
    const panel=q('#v2SidebarDetailPanel')||q('.v2-detail-scroll-panel');
    if(!card||!panel)return;
    qa('#v2SidebarDetailTabs button').forEach(btn=>btn.classList.toggle('active',btn.dataset.sidebarDetail===kind));
    qa('.v2-detail-tab-btn').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('data-v2-detail-kind')===kind));
    const html=kind==='leader'?leader(card):kind==='active'?skill(card,'active'):kind==='passive'?skill(card,'passive'):description(card);
    if(panel.innerHTML!==html)panel.innerHTML=html;
  }
  function schedule(card,delay=90){if(card)lastCard=card;setTimeout(()=>render(activeKind()),delay);setTimeout(()=>render(activeKind()),delay+180);}
  document.addEventListener('click',event=>{
    const card=event.target.closest('#catalogGrid .unitCard');
    if(card)schedule(card,90);
    const tab=event.target.closest('#v2SidebarDetailTabs button,.v2-detail-tab-btn');
    if(tab)setTimeout(()=>render(tab.dataset.sidebarDetail||tab.getAttribute('data-v2-detail-kind')||'leader'),0);
  },true);
  document.addEventListener('v2:hero-state-change',event=>schedule(event.detail?.card||currentCard(),30));
  new MutationObserver(()=>{const c=q('#catalogGrid .unitCard.v2-selected');if(c)lastCard=c;}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();
