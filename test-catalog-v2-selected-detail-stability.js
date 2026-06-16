/* test-catalog-v2-selected-detail-stability.js
   Final selected-detail guard plus click-selection authority.
   Keeps the desktop detail panel tied to the currently selected card and makes card selection immediate.
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
  function txt(sel,root=document){return q(sel,root)?.textContent?.trim()||'';}
  function skill(card,type){const r=rows(card,type);if(!r.length)return'<p>No skills loaded.</p>';return r.map(row=>`<p><strong>${safe(row?.name||row?.id||'Skill')}</strong>${row?.tu||row?.sp!==undefined?`<br><span>${safe([row?.tu?`${row.tu} TU`:'',row?.sp!==undefined?`${Number(row.sp)>0?'+':''}${row.sp} SP`:''].filter(Boolean).join(' • '))}</span>`:''}<br>${safe(row?.description||'No description loaded.')}</p>`).join('');}
  function leader(card){const name=txt('.leaderName',card)||'Leader Skill';const desc=txt('.leaderDesc',card)||'No leader skill loaded.';return`<p><strong>${safe(name)}</strong><br>${safe(desc)}</p>`;}
  function description(card){const desc=q('#v2Desc')?.textContent?.trim()||txt('.descriptionText',card)||card?.getAttribute('data-description')||'No description loaded.';return`<p>${safe(desc)}</p>`;}
  function stat(card,key){return q(`.stat[data-stat="${key}"] .statVal`,card)?.textContent?.trim()||'—';}
  function setText(id,value){const node=q(`#${id}`);if(node&&node.textContent!==String(value??''))node.textContent=String(value??'');}
  function updateHeroFast(card){
    if(!card)return;
    const img=q('.unitThumb img',card);
    const host=q('#v2FeatureArt');
    if(host){
      const src=img?.getAttribute('src')||img?.src||'';
      const hero=host.querySelector('img');
      if(src&&hero){if(hero.getAttribute('src')!==src)hero.setAttribute('src',src);}
      else if(src)host.innerHTML=`<img src="${src}" alt="" loading="lazy" decoding="async">`;
    }
    setText('v2Kind',card.getAttribute('data-kind')||card.getAttribute('data-type')||'Catalog');
    setText('v2Name',txt('.unitName',card)||'Unknown');
    setText('v2Title',txt('.unitTitle',card)||'');
    const pills=q('#v2Pills');
    if(pills){
      const html=qa('.chipCol .tag,.slotBadges .tag',card).map(x=>`<span class="v2-pill">${safe(x.textContent.trim())}</span>`).join('');
      if(html&&pills.innerHTML!==html)pills.innerHTML=html;
    }
    setText('v2Hp',stat(card,'hp'));
    setText('v2Atk',stat(card,'atk'));
    setText('v2Spd',stat(card,'spd'));
    setText('v2Cost',stat(card,'cost'));
  }
  function selectImmediately(card){
    if(!card)return;
    lastCard=card;
    qa('#catalogGrid .unitCard.v2-selected').forEach(c=>{if(c!==card)c.classList.remove('v2-selected');});
    card.classList.add('v2-selected');
    updateHeroFast(card);
    render(activeKind());
  }
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
  function schedule(card,delay=90){if(card){lastCard=card;updateHeroFast(card);}setTimeout(()=>render(activeKind()),delay);setTimeout(()=>render(activeKind()),delay+180);}
  document.addEventListener('pointerdown',event=>{
    const card=event.target.closest('#catalogGrid .unitCard');
    if(card&&!event.target.closest('.stateBtn,.duoFormBtn,.v2-detail-btn,[data-v2-skill],button,select,input,a'))selectImmediately(card);
  },true);
  document.addEventListener('click',event=>{
    const card=event.target.closest('#catalogGrid .unitCard');
    if(card)selectImmediately(card);
    const tab=event.target.closest('#v2SidebarDetailTabs button,.v2-detail-tab-btn');
    if(tab)setTimeout(()=>render(tab.dataset.sidebarDetail||tab.getAttribute('data-v2-detail-kind')||'leader'),0);
  },true);
  document.addEventListener('v2:hero-state-change',event=>schedule(event.detail?.card||currentCard(),30));
  new MutationObserver(()=>{const c=q('#catalogGrid .unitCard.v2-selected');if(c)lastCard=c;}).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
})();