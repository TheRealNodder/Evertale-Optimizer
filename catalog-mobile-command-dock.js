/* Fixed mobile catalog command dock and compact-landscape layout state. */
(function(){
  const PHONE_QUERY='(max-width: 820px)';
  const LANDSCAPE_QUERY='(orientation: landscape) and (max-width: 1180px) and (max-height: 600px)';
  const TYPES=[
    ['all','All'],
    ['characters','Characters'],
    ['weapons','Weapons'],
    ['bosses','Bosses'],
    ['accessories','Accessories'],
  ];

  const phoneMedia=window.matchMedia(PHONE_QUERY);
  const landscapeMedia=window.matchMedia(LANDSCAPE_QUERY);
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMobileLayout=()=>phoneMedia.matches||landscapeMedia.matches;
  const isLandscapeCardMode=()=>landscapeMedia.matches&&document.body.classList.contains('catalog-mobile-landscape');

  function decodeRows(card,attribute){
    try{
      const rows=JSON.parse(decodeURIComponent(card?.getAttribute(attribute)||''));
      return Array.isArray(rows)?rows:[];
    }catch{return[];}
  }

  function currentDescription(card){
    const direct=String(card?.getAttribute('data-description')||'').trim();
    if(direct)return direct;
    const rows=decodeRows(card,'data-state-rows');
    const index=Number(card?.querySelector('.stateBtn.active')?.dataset?.idx||card?.querySelector('.unitThumb img')?.dataset?.state||0);
    return String(rows[index]?.description||rows[0]?.description||'').trim();
  }

  function appendDetailCopy(panel,title,description,meta=''){
    const article=document.createElement('article');
    article.className='v2-landscape-detail-copy';
    const heading=document.createElement('strong');
    heading.textContent=title;
    article.appendChild(heading);
    if(meta){
      const badge=document.createElement('span');
      badge.textContent=meta;
      article.appendChild(badge);
    }
    const copy=document.createElement('p');
    copy.textContent=description;
    article.appendChild(copy);
    panel.appendChild(article);
  }

  function renderLandscapeDetail(card,kind){
    const detail=card?.querySelector('.v2-landscape-detail');
    const panel=detail?.querySelector('.v2-landscape-detail-panel');
    if(!detail||!panel)return;
    detail.dataset.activeTab=kind;
    detail.querySelectorAll('[data-landscape-detail-tab]').forEach(button=>{
      const active=button.dataset.landscapeDetailTab===kind;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    });
    panel.replaceChildren();
    if(kind==='leader'){
      const name=card.querySelector('.leaderName')?.textContent?.trim()||'No Leader Skill';
      const description=card.querySelector('.leaderDesc')?.textContent?.trim()||'This entry does not provide a leader skill.';
      appendDetailCopy(panel,name,description);
    }else if(kind==='description'){
      appendDetailCopy(panel,'Description',currentDescription(card)||'No description is loaded for this state.');
    }else{
      const attribute=kind==='active'?'data-active-skills':'data-passive-skills';
      const label=kind==='active'?'Active Skill':'Passive Skill';
      const rows=decodeRows(card,attribute);
      if(!rows.length)appendDetailCopy(panel,`No ${label}s`,`No ${label.toLowerCase()} details are loaded for this entry.`);
      rows.forEach(row=>{
        const meta=kind==='active'?[row?.tu?`${row.tu} TU`:'',row?.sp!==undefined?`${Number(row.sp)>0?'+':''}${row.sp} SP`:''].filter(Boolean).join(' • '):'';
        appendDetailCopy(panel,String(row?.name||row?.id||label),String(row?.description||'No description loaded.'),meta);
      });
    }
    panel.scrollTop=0;
  }

  function ensureLandscapeDetail(card){
    const meta=card?.querySelector(':scope > .meta');
    if(!meta)return null;
    let detail=meta.querySelector(':scope > .v2-landscape-detail');
    if(!detail){
      detail=document.createElement('section');
      detail.className='v2-landscape-detail';
      detail.hidden=true;
      detail.setAttribute('aria-label','Entry details');
      detail.innerHTML=`
        <button class="v2-landscape-back" type="button">← Back to card</button>
        <div class="v2-landscape-detail-stats" aria-label="Entry stats"></div>
        <div class="v2-landscape-detail-tabs" role="tablist" aria-label="Entry detail sections">
          <button type="button" role="tab" data-landscape-detail-tab="leader">Leader</button>
          <button type="button" role="tab" data-landscape-detail-tab="active">Active</button>
          <button type="button" role="tab" data-landscape-detail-tab="passive">Passive</button>
          <button type="button" role="tab" data-landscape-detail-tab="description">Desc</button>
        </div>
        <div class="v2-landscape-detail-panel" role="tabpanel" tabindex="0"></div>`;
      meta.appendChild(detail);
    }
    const sourceStats=card.querySelector('.unitDetails > .statLine');
    const detailStats=detail.querySelector('.v2-landscape-detail-stats');
    if(sourceStats&&detailStats)detailStats.innerHTML=sourceStats.innerHTML;
    return detail;
  }

  function hideLandscapeDetails(card,restoreFocus=true){
    if(!card)return false;
    const detail=card.querySelector('.v2-landscape-detail');
    card.classList.remove('v2-landscape-detail-open');
    if(detail)detail.hidden=true;
    if(restoreFocus)requestAnimationFrame(()=>{
      card.querySelector('.nameBlock > .v2-detail-btn')?.focus({preventScroll:true});
      if(isLandscapeCardMode())card.scrollIntoView({block:'start',behavior:reduceMotion.matches?'auto':'smooth'});
    });
    return true;
  }

  function showLandscapeDetails(card){
    if(!isLandscapeCardMode()||!card)return false;
    document.querySelectorAll('#catalogGrid .unitCard.v2-landscape-detail-open').forEach(openCard=>{
      if(openCard!==card)hideLandscapeDetails(openCard,false);
    });
    window.EvertaleCatalogV2?.selectCard?.(card);
    const detail=ensureLandscapeDetail(card);
    if(!detail)return false;
    detail.hidden=false;
    card.classList.add('v2-landscape-detail-open');
    renderLandscapeDetail(card,'leader');
    requestAnimationFrame(()=>{
      detail.querySelector('.v2-landscape-back')?.focus({preventScroll:true});
      card.scrollIntoView({block:'start',behavior:reduceMotion.matches?'auto':'smooth'});
    });
    return true;
  }

  // Publish the landscape controller as soon as this authority loads. The catalog
  // renderer can then delegate Details consistently, even before dock setup ends.
  window.EvertaleLandscapeCatalog={isActive:isLandscapeCardMode,showDetails:showLandscapeDetails,hideDetails:hideLandscapeDetails};

  function buildDock(){
    if(document.getElementById('mobileCatalogDock'))return document.getElementById('mobileCatalogDock');
    const dock=document.createElement('section');
    dock.id='mobileCatalogDock';
    dock.className='mobileCatalogDock';
    dock.setAttribute('aria-label','Mobile catalog controls');
    dock.innerHTML=`
      <label class="mobileCatalogDock__search" for="catalogSearch">
        <span class="mobileCatalogDock__searchIcon" aria-hidden="true">⌕</span>
      </label>
      <button id="mobileCatalogTop" class="mobileCatalogDock__button" type="button"><span aria-hidden="true">↑</span><span>Return to Top</span></button>
      <button id="mobileCatalogTypeToggle" class="mobileCatalogDock__button" type="button" aria-haspopup="menu" aria-controls="mobileCatalogTypeMenu" aria-expanded="false"><span>Entries: <span id="mobileCatalogTypeLabel">Characters</span></span><span aria-hidden="true">▾</span></button>
      <div id="mobileCatalogTypeMenu" class="mobileCatalogDock__menu" role="menu" aria-label="Entries viewed" hidden>
        ${TYPES.map(([value,label])=>`<button class="mobileCatalogDock__menuButton" type="button" role="menuitemradio" data-catalog-type="${value}" aria-checked="false">${label}</button>`).join('')}
      </div>`;
    document.body.insertBefore(dock,document.body.firstChild);
    return dock;
  }

  function boot(){
    const sourceSearch=document.getElementById('catalogSearch');
    const sourceType=document.getElementById('catalogType');
    if(!sourceSearch||!sourceType)return;

    const dock=buildDock();
    const searchHost=dock.querySelector('.mobileCatalogDock__search');
    const topButton=dock.querySelector('#mobileCatalogTop');
    const typeToggle=dock.querySelector('#mobileCatalogTypeToggle');
    const typeLabel=dock.querySelector('#mobileCatalogTypeLabel');
    const menu=dock.querySelector('#mobileCatalogTypeMenu');
    const menuButtons=Array.from(menu.querySelectorAll('[data-catalog-type]'));
    const originalSearchParent=sourceSearch.parentNode;
    const originalSearchNext=sourceSearch.nextSibling;
    const originalSearchPlaceholder=sourceSearch.getAttribute('placeholder')||'';
    const originalSearchLabel=sourceSearch.getAttribute('aria-label');

    function updateLayoutState(){
      const active=isMobileLayout();
      if(active){
        if(sourceSearch.parentNode!==searchHost)searchHost.appendChild(sourceSearch);
        sourceSearch.classList.add('mobileCatalogDock__input');
        sourceSearch.setAttribute('inputmode','search');
        sourceSearch.setAttribute('autocomplete','off');
        sourceSearch.setAttribute('placeholder','Search the catalog...');
        sourceSearch.setAttribute('aria-label','Search the catalog');
      }else{
        if(sourceSearch.parentNode!==originalSearchParent){
          if(originalSearchNext&&originalSearchNext.parentNode===originalSearchParent)originalSearchParent.insertBefore(sourceSearch,originalSearchNext);
          else originalSearchParent.appendChild(sourceSearch);
        }
        sourceSearch.classList.remove('mobileCatalogDock__input');
        sourceSearch.setAttribute('placeholder',originalSearchPlaceholder);
        if(originalSearchLabel===null)sourceSearch.removeAttribute('aria-label');
        else sourceSearch.setAttribute('aria-label',originalSearchLabel);
      }
      document.body.classList.toggle('catalog-mobile-command-active',active);
      document.body.classList.toggle('catalog-mobile-landscape',active&&landscapeMedia.matches);
      dock.setAttribute('aria-hidden',String(!active));
      if(!active)closeMenu(false);
      if(!(active&&landscapeMedia.matches))document.querySelectorAll('#catalogGrid .unitCard.v2-landscape-detail-open').forEach(card=>hideLandscapeDetails(card,false));
    }

    function closeMenu(restoreFocus=false){
      menu.hidden=true;
      typeToggle.setAttribute('aria-expanded','false');
      if(restoreFocus)typeToggle.focus({preventScroll:true});
    }

    function openMenu(){
      if(!isMobileLayout())return;
      menu.hidden=false;
      typeToggle.setAttribute('aria-expanded','true');
      const active=menu.querySelector('.is-active')||menuButtons[0];
      requestAnimationFrame(()=>active?.focus({preventScroll:true}));
    }

    function syncTypeFromSource(){
      const value=TYPES.some(([key])=>key===sourceType.value)?sourceType.value:'characters';
      const label=TYPES.find(([key])=>key===value)?.[1]||'Characters';
      typeLabel.textContent=label;
      menuButtons.forEach(button=>{
        const active=button.dataset.catalogType===value;
        button.classList.toggle('is-active',active);
        button.setAttribute('aria-checked',String(active));
      });
    }

    typeToggle.addEventListener('click',()=>{
      if(menu.hidden)openMenu();
      else closeMenu(false);
    });

    menuButtons.forEach(button=>button.addEventListener('click',()=>{
      const value=button.dataset.catalogType;
      if(!value)return;
      sourceType.value=value;
      sourceType.dispatchEvent(new Event('change',{bubbles:true}));
      syncTypeFromSource();
      closeMenu(true);
    }));
    sourceType.addEventListener('change',syncTypeFromSource);

    menu.addEventListener('keydown',event=>{
      const index=menuButtons.indexOf(document.activeElement);
      let next=-1;
      if(event.key==='ArrowDown')next=(index+1+menuButtons.length)%menuButtons.length;
      if(event.key==='ArrowUp')next=(index-1+menuButtons.length)%menuButtons.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=menuButtons.length-1;
      if(next>=0){event.preventDefault();menuButtons[next].focus({preventScroll:true});}
      if(event.key==='Escape'){event.preventDefault();closeMenu(true);}
    });

    document.addEventListener('click',event=>{
      if(!menu.hidden&&!dock.contains(event.target))closeMenu(false);
      const details=event.target.closest?.('#catalogGrid .unitCard .v2-detail-btn');
      if(details&&isLandscapeCardMode()){
        const card=details.closest('.unitCard');
        if(card&&showLandscapeDetails(card)){
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }
      const back=event.target.closest('.v2-landscape-back');
      if(back){
        event.preventDefault();
        hideLandscapeDetails(back.closest('.unitCard'));
        return;
      }
      const tab=event.target.closest('[data-landscape-detail-tab]');
      if(tab&&isLandscapeCardMode()){
        event.preventDefault();
        renderLandscapeDetail(tab.closest('.unitCard'),tab.dataset.landscapeDetailTab||'leader');
      }
    },true);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!menu.hidden)closeMenu(true);
      const openCard=event.target.closest?.('.unitCard.v2-landscape-detail-open');
      if(event.key==='Escape'&&openCard){
        event.preventDefault();
        hideLandscapeDetails(openCard);
        return;
      }
      const tab=event.target.closest?.('[data-landscape-detail-tab]');
      if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        const tabs=Array.from(tab.parentElement.querySelectorAll('[data-landscape-detail-tab]'));
        const index=tabs.indexOf(tab);
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(index+1)%tabs.length:(index-1+tabs.length)%tabs.length;
        event.preventDefault();
        tabs[next].focus({preventScroll:true});
        tabs[next].click();
      }
    });

    topButton.addEventListener('click',()=>{
      closeMenu(false);
      window.scrollTo({top:0,left:0,behavior:reduceMotion.matches?'auto':'smooth'});
    });

    for(const media of [phoneMedia,landscapeMedia]){
      if(typeof media.addEventListener==='function')media.addEventListener('change',updateLayoutState);
      else media.addListener(updateLayoutState);
    }
    syncTypeFromSource();
    updateLayoutState();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
