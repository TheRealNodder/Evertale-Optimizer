/* catalog-click-fast-authority.js
   Loaded live desktop sidebar authority. Kept at this path because index.html already loads it last.
   Grid renders cards; this script owns desktop selection, sidebar awaken state, hero, stats, skills, and descriptions.
   Performance rules: no document-wide MutationObserver, no per-click bundle refetch, no layout mutation.
   Mobile exits immediately so the mobile popup/detail flow remains untouched.
*/
(function(){
  if(!window.matchMedia('(min-width: 821px)').matches){
    window.__EVERTALE_DESKTOP_SIDEBAR_AUTHORITY_SKIPPED_ON_MOBILE = true;
    return;
  }

  const FAMILY_BUNDLE='./apkfiles/entries/bundles/character_families.bundle.json';
  const STATE_LABELS=['5\u2605','6\u2605','FA'];
  const state={selectedId:'',activeDetail:'leader',awakenById:new Map(),descMap:null,descPromise:null,raf:0,pendingCard:null,renderSeq:0};
  const $=id=>document.getElementById(id);
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const safe=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>');
  const key=v=>String(v||'').toLowerCase().replace(/\d+$/,'').replace(/[^a-z0-9]+/g,'');
  const stateLabel=i=>STATE_LABELS[i]||`State ${i+1}`;

  function injectDetailTabCss(){
    if(document.getElementById('catalog-desktop-detail-tab-active-visuals'))return;
    const style=document.createElement('style');
    style.id='catalog-desktop-detail-tab-active-visuals';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2 #v2AwakenTabs button{
          opacity:.46!important;
          filter:saturate(.7) brightness(.76)!important;
          border:1px solid rgba(255,255,255,.16)!important;
          background:rgba(255,255,255,.075)!important;
          color:rgba(255,255,255,.68)!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important;
          transform:none!important;
        }
        body.page-catalog-v2 #v2AwakenTabs button.active,
        body.page-catalog-v2 #v2AwakenTabs button[aria-pressed="true"]{
          opacity:1!important;
          filter:saturate(1.45) brightness(1.18)!important;
          border-color:rgba(255,255,255,.78)!important;
          background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,var(--v2-theme-trim,#f6ca5e)) 84%,#fff 16%),var(--element-primary,var(--v2-theme-trim,#f6ca5e)),color-mix(in srgb,var(--element-secondary,#a855f7) 78%,#111827 22%))!important;
          color:#fff!important;
          box-shadow:0 0 0 2px rgba(255,255,255,.26),0 0 24px color-mix(in srgb,var(--element-primary,var(--v2-theme-trim,#f6ca5e)) 74%,transparent),inset 0 1px 0 rgba(255,255,255,.34)!important;
          transform:translateY(-1px)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn{opacity:.72!important;filter:saturate(.9) brightness(.9)!important;}
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn.active,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn[aria-pressed="true"]{opacity:1!important;filter:saturate(1.28) brightness(1.1)!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function text(sel,root=document){return q(sel,root)?.textContent?.trim()||'';}
  function setText(id,value){const n=$(id);if(n&&n.textContent!==String(value??''))n.textContent=String(value??'');}
  function cardId(card){return String(card?.getAttribute('data-id')||card?.getAttribute('data-source-id')||card?.getAttribute('data-family')||text('.unitName',card)||'').trim();}
  function findCard(id){return id?q(`#catalogGrid .unitCard[data-id="${CSS.escape(id)}"]`)||q(`#catalogGrid .unitCard[data-source-id="${CSS.escape(id)}"]`)||q(`#catalogGrid .unitCard[data-family="${CSS.escape(id)}"]`):null;}
  function selectedCard(){
    const id=String(window.__EVERTALE_CATALOG_SELECTED_ID||window.EvertaleCatalogV2?.getSelectedId?.()||state.selectedId||'').trim();
    return findCard(id)||window.EvertaleCatalogV2?.selectedCard?.()||null;
  }
  function stat(card,k){return q(`.stat[data-stat="${k}"] .statVal`,card)?.textContent?.trim()||'—';}
  function readRows(card,type){try{const rows=JSON.parse(decodeURIComponent(card?.getAttribute(type==='active'?'data-active-skills':'data-passive-skills')||''));return Array.isArray(rows)?rows:[];}catch{return[];}}
  function visibleStateButtons(card){return qa('.stateRow .stateBtn',card).filter(b=>!b.hidden&&!b.classList.contains('v2-state-hidden'));}
  function legacyImageRows(card){
    const row=q('.stateRow',card),img=q('.unitThumb img',card);
    try{return JSON.parse(decodeURIComponent(row?.getAttribute('data-imgs')||img?.getAttribute('data-imgs')||'[]')).filter(Boolean).slice(0,3).map(image=>({image}));}catch{return[];}
  }
  function stateRows(card){
    if(window.EvertaleCatalogV2&&typeof window.EvertaleCatalogV2.readStateRows==='function'){
      try{return window.EvertaleCatalogV2.readStateRows(card).filter(Boolean).slice(0,3);}catch{}
    }
    try{
      const rows=JSON.parse(decodeURIComponent(card?.getAttribute('data-state-rows')||q('.stateRow',card)?.getAttribute('data-states')||'[]'));
      return Array.isArray(rows)?rows.filter(Boolean).slice(0,3):[];
    }catch{return legacyImageRows(card);}
  }
  function stateCount(card){return Math.max(stateRows(card).length,visibleStateButtons(card||document).length,qa('.stateRow .stateBtn',card||document).length,1);}
  function currentIndex(card){const id=cardId(card);if(id&&state.awakenById.has(id))return clampIndex(state.awakenById.get(id),card);return clampIndex(q('.stateRow .stateBtn.active',card)?.getAttribute('data-idx')||q('.unitThumb img',card)?.getAttribute('data-state')||card?.getAttribute('data-duo-index')||0,card);}
  function clampIndex(value,card){const count=stateCount(card);const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(count-1,Math.floor(n))):0;}
  function cardKeys(card){const src=q('.unitThumb img',card)?.getAttribute('src')||q('.unitThumb img',card)?.src||'';const imgKey=key(String(src).split('/').pop()?.replace(/\.png(?:\?.*)?$/i,''));return [card?.getAttribute('data-family'),card?.getAttribute('data-duo-root'),card?.getAttribute('data-duo-active-id'),card?.getAttribute('data-source-id'),card?.getAttribute('data-id'),imgKey,text('.unitName',card),text('.unitTitle',card)].map(key).filter(Boolean);}

  function notifyStructureState(card,idx){
    if(!card)return;
    try{document.dispatchEvent(new CustomEvent('v2:hero-state-change',{detail:{card,index:idx}}));}catch{}
  }

  function syncCardState(card,requestedIdx=currentIndex(card),writeImage=false){
    if(!card)return 0;
    const id=cardId(card);
    const rows=stateRows(card);
    const btns=visibleStateButtons(card);
    const max=Math.max(btns.length,rows.length,1);
    const idx=Math.max(0,Math.min(Number(requestedIdx)||0,max-1));
    if(id)state.awakenById.set(id,idx);
    if(writeImage&&rows.length&&window.EvertaleCatalogV2&&typeof window.EvertaleCatalogV2.applyState==='function'){
      window.EvertaleCatalogV2.applyState(card,idx,false);
    }
    btns.forEach((btn,i)=>{
      const on=i===idx;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
    });
    const img=q('.unitThumb img',card);
    const legacy=legacyImageRows(card);
    if(writeImage&&img&&!rows.length&&legacy[idx]?.image){img.setAttribute('src',legacy[idx].image);img.setAttribute('data-state',String(idx));}
    card.setAttribute('data-duo-index',String(idx));
    return idx;
  }

  function syncSidebarAwakenTabs(idx){
    const tabs=$('v2AwakenTabs');
    if(!tabs)return;
    qa('button',tabs).forEach((btn,i)=>{
      const on=i===idx;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
      btn.setAttribute('data-v2-idx',String(i));
      btn.setAttribute('data-awaken-index',String(i));
    });
  }

  async function loadDescMap(){
    if(state.descMap)return state.descMap;
    if(state.descPromise)return state.descPromise;
    state.descPromise=fetch(FAMILY_BUNDLE,{cache:'default'}).then(r=>r.ok?r.json():null).then(json=>{
      const map=new Map();
      const add=(raw,rows)=>{const k=key(raw);if(k&&rows?.length&&!map.has(k))map.set(k,rows);};
      (Array.isArray(json?.entries)?json.entries:[]).forEach(entry=>{
        const rows=(Array.isArray(entry?.states)?entry.states:[]).slice(0,3).map(s=>({sourceId:s?.sourceId||s?.dataSourceId||'',name:s?.name||entry?.name||'',title:s?.title||entry?.title||'',description:s?.description||''}));
        if(!rows.length)return;
        [entry?.family,entry?.id,entry?.sourceId,entry?.name,entry?.title].forEach(v=>add(v,rows));
        rows.forEach(row=>[row.sourceId,row.name,row.title].forEach(v=>add(v,rows)));
      });
      state.descMap=map;
      return map;
    }).catch(()=>new Map());
    return state.descPromise;
  }

  async function rowsFor(card){
    const map=await loadDescMap();
    for(const k of cardKeys(card)){const rows=map.get(k);if(rows?.length)return rows;}
    return [];
  }

  function ensureSidebar(){
    const box=q('.v2-description');if(!box)return null;
    let head=q('.v2-desc-head',box);if(!head){head=document.createElement('div');head.className='v2-desc-head';box.insertBefore(head,box.firstChild);}
    let tabs=q('.v2-detail-tabs',box);if(!tabs){tabs=document.createElement('div');tabs.className='v2-detail-tabs';head.appendChild(tabs);}
    if(!tabs.children.length){
      tabs.innerHTML=[['leader','Leader Skill'],['active','Active Skill'],['passive','Passive Skill'],['description','Description']].map(([kind,label])=>`<button type="button" class="v2-detail-tab-btn${kind===state.activeDetail?' active':''}" data-v2-detail-kind="${kind}">${label}</button>`).join('');
    }
    let panel=q('.v2-detail-scroll-panel',box);if(!panel){panel=document.createElement('div');panel.className='v2-detail-scroll-panel';box.appendChild(panel);}
    return panel;
  }

  function skillHtml(card,type){
    const rows=readRows(card,type);
    return rows.length?rows.map(s=>`<p><strong>${safe(s.name||s.id||'Skill')}</strong>${s.tu||s.sp!==undefined?`<br><span>${safe([s.tu?`${s.tu} TU`:'',s.sp!==undefined?`${Number(s.sp)>0?'+':''}${s.sp} SP`:''].filter(Boolean).join(' • '))}</span>`:''}<br>${safe(s.description||s.desc||'No description loaded.')}</p>`).join(''):'<p>No skills loaded.</p>';
  }
  function leaderHtml(card){return `<p><strong>${safe(text('.leaderName',card)||'Leader Skill')}</strong><br>${safe(text('.leaderDesc',card)||'No leader skill loaded.')}</p>`;}
  function fallbackDescription(card){return card?.getAttribute('data-description')||text('.descriptionText',card)||'No description loaded.';}
  function renderDetail(card,descText=fallbackDescription(card)){
    const panel=ensureSidebar();if(!panel||!card)return;
    qa('.v2-detail-tab-btn').forEach(btn=>{
      const on=btn.getAttribute('data-v2-detail-kind')===state.activeDetail;
      btn.classList.toggle('active',on);
      btn.setAttribute('aria-pressed',String(on));
    });
    const html=state.activeDetail==='leader'?leaderHtml(card):state.activeDetail==='active'?skillHtml(card,'active'):state.activeDetail==='passive'?skillHtml(card,'passive'):`<p>${safe(descText)}</p>`;
    if(panel.innerHTML!==html)panel.innerHTML=html;
  }

  function renderBase(card){
    if(!card||!document.contains(card))return;
    const id=cardId(card);if(!id)return;
    state.selectedId=id;
    window.__EVERTALE_CATALOG_SELECTED_ID=id;
    window.__EVERTALE_FAST_SELECTED_CARD_ID=id;
    qa('#catalogGrid .unitCard.v2-selected').forEach(c=>{if(c!==card)c.classList.remove('v2-selected');});
    card.classList.add('v2-selected');

    const activeIdx=syncCardState(card,currentIndex(card),false);
    const img=q('.unitThumb img',card);const src=img?.getAttribute('src')||img?.src||'';
    const art=$('v2FeatureArt');
    if(art&&src){const hero=q('img',art);if(hero){if(hero.getAttribute('src')!==src)hero.setAttribute('src',src);}else art.innerHTML=`<img src="${src}" alt="" loading="lazy" decoding="async">`;}
    setText('v2Kind',card.getAttribute('data-kind')||'Catalog');
    setText('v2Name',text('.unitName',card)||'Unknown');
    setText('v2Title',text('.unitTitle',card)||'');
    const pills=$('v2Pills');
    if(pills){const html=qa('.chipCol .tag,.slotBadges .tag',card).map(x=>`<span class="v2-pill">${safe(x.textContent.trim())}</span>`).join('');if(pills.innerHTML!==html)pills.innerHTML=html;}
    setText('v2Hp',stat(card,'hp'));setText('v2Atk',stat(card,'atk'));setText('v2Spd',stat(card,'spd'));setText('v2Cost',stat(card,'cost'));
    const tabs=$('v2AwakenTabs');
    if(tabs){
      const count=Math.min(3,Math.max(stateRows(card).length,visibleStateButtons(card).length));
      const html=count>1?Array.from({length:count},(_,i)=>`<button type="button" class="${i===activeIdx?'active':''}" data-v2-idx="${i}" data-awaken-index="${i}" aria-pressed="${i===activeIdx?'true':'false'}">${stateLabel(i)}</button>`).join(''):'';
      if(tabs.innerHTML!==html)tabs.innerHTML=html;
      tabs.dataset.v2ActiveCard=id;
      syncSidebarAwakenTabs(activeIdx);
    }
    const fallback=fallbackDescription(card);
    setText('v2Desc',fallback);
    renderDetail(card,fallback);
    hydrateDescription(card,++state.renderSeq);
  }

  async function hydrateDescription(card,seq){
    const id=cardId(card);const rows=await rowsFor(card);if(seq!==state.renderSeq||id!==state.selectedId||!rows.length)return;
    const idx=Math.min(currentIndex(card),rows.length-1);
    const desc=rows[idx]?.description||fallbackDescription(card);
    setText('v2Desc',desc);
    if(state.activeDetail==='description')renderDetail(card,desc);
  }

  function queue(card){state.pendingCard=card;if(state.raf)return;state.raf=requestAnimationFrame(()=>{state.raf=0;const c=state.pendingCard;state.pendingCard=null;renderBase(c);});}
  function select(card){if(card)queue(card);}

  function setCardState(card,idx){
    if(!card)return;
    const activeIdx=syncCardState(card,idx,true);
    syncSidebarAwakenTabs(activeIdx);
    notifyStructureState(card,activeIdx);
    renderBase(card);
  }

  function handleSidebarAwaken(event){
    const sidebarBtn=event.target.closest('#v2AwakenTabs button');
    if(!sidebarBtn)return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const card=selectedCard();
    if(card)setCardState(card,sidebarBtn.dataset.v2Idx??sidebarBtn.dataset.awakenIndex??0);
    return true;
  }

  function handleSidebarDetail(event){
    const detailTab=event.target.closest('.v2-detail-tab-btn');
    if(!detailTab)return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    state.activeDetail=detailTab.getAttribute('data-v2-detail-kind')||'leader';
    const card=selectedCard();
    if(card)renderBase(card);
    return true;
  }

  window.addEventListener('pointerdown',event=>{handleSidebarAwaken(event);},true);
  window.addEventListener('mousedown',event=>{handleSidebarAwaken(event);},true);
  window.addEventListener('mouseup',event=>{handleSidebarAwaken(event);},true);
  window.addEventListener('click',event=>{if(handleSidebarAwaken(event))return;handleSidebarDetail(event);},true);

  document.addEventListener('click',event=>{
    if(handleSidebarAwaken(event))return;
    if(handleSidebarDetail(event))return;
    const cardStateBtn=event.target.closest('#catalogGrid .unitCard .stateRow .stateBtn');
    if(cardStateBtn){return;}
    const card=event.target.closest('#catalogGrid .unitCard');
    if(card&&!event.target.closest('.duoFormBtn,[data-v2-skill],button,input,select,a')){select(card);return;}
    if(card&&event.target.closest('.duoFormBtn'))setTimeout(()=>select(card),0);
  },true);

  document.addEventListener('pointerup',event=>{const card=event.target.closest('#catalogGrid .unitCard');if(card&&!event.target.closest('.stateRow .stateBtn,.duoFormBtn,[data-v2-skill],button,input,select,a'))select(card);},{passive:true});
  document.addEventListener('v2:hero-state-change',event=>{
    const card=event?.detail?.card;
    if(!card||!document.contains(card))return;
    const idx=clampIndex(event?.detail?.index,card);
    const id=cardId(card);
    if(id)state.awakenById.set(id,idx);
    syncSidebarAwakenTabs(idx);
    queue(card);
  });
  document.addEventListener('v2:card-selected',event=>{
    const card=event?.detail?.card;
    if(card&&document.contains(card))select(card);
  });
  document.addEventListener('DOMContentLoaded',()=>{
    injectDetailTabCss();
    setTimeout(()=>{
      const seeded=selectedCard();
      if(seeded)select(seeded);
    },350);
  });
})();
