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
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!menu.hidden)closeMenu(true);
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
