(function(){
  function currentThemeParam(){
    try{
      const value=new URLSearchParams(location.search).get('theme');
      return value&&value!=='auto'?value:'';
    }catch{return'';}
  }
  function themedUrl(href){
    const theme=currentThemeParam();
    if(!theme)return href;
    try{
      const url=new URL(href,location.href);
      if(url.origin!==location.origin)return href;
      if(!/\.html$/i.test(url.pathname)&&url.pathname!==location.pathname)return href;
      url.searchParams.set('theme',theme);
      const file=url.pathname.slice(url.pathname.lastIndexOf('/')+1)||'index.html';
      return `./${file}${url.search}${url.hash}`;
    }catch{return href;}
  }
  function syncThemeLinks(root=document){
    if(!currentThemeParam()||!root?.querySelectorAll)return;
    root.querySelectorAll('a[href]').forEach(link=>{
      link.setAttribute('href',themedUrl(link.getAttribute('href')));
    });
  }
  function catalogUrl(type){
    const href='./index.html' + (type ? '?' + new URLSearchParams({type}).toString() : '');
    return themedUrl(href);
  }
  function themeItems(){
    const list=window.EvertaleTheme?.listThemes?.()||[];
    return Array.isArray(list)?list:[];
  }
  function activeThemePreference(){
    try{
      const fromUrl=new URLSearchParams(location.search).get('theme');
      if(fromUrl)return fromUrl;
    }catch{}
    return window.EvertaleTheme?.getPreference?.()||'auto';
  }
  function setThemePreference(value){
    const next=themeItems().some(item=>item.key===value)||value==='auto'?value:'auto';
    try{
      const url=new URL(location.href);
      if(next==='auto')url.searchParams.delete('theme');
      else url.searchParams.set('theme',next);
      history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
    }catch{}
    window.EvertaleTheme?.setPreference?.(next);
    syncThemeLinks();
    hydrateThemeControl(document.getElementById('siteSideMenu')||document);
  }
  function hydrateThemeControl(root=document){
    const select=root?.querySelector?.('#siteThemeSelect');
    if(!select)return;
    const items=themeItems();
    const active=activeThemePreference();
    select.innerHTML=`<option value="auto">Auto</option>${items.map(item=>`<option value="${item.key}">${item.label}</option>`).join('')}`;
    select.value=items.some(item=>item.key===active)||active==='auto'?active:'auto';
    if(!select.dataset.bound){
      select.dataset.bound='1';
      select.addEventListener('change',()=>setThemePreference(select.value));
    }
    const swatches=root.querySelector('.siteThemeSwatches');
    if(swatches){
      swatches.innerHTML=items.map(item=>`<button type="button" class="siteThemeSwatch${item.key===select.value?' active':''}" data-theme-key="${item.key}" aria-label="${item.label}" title="${item.label}" style="--swatch-a:${item.bg};--swatch-b:${item.surface};--swatch-c:${item.accent};"></button>`).join('');
      if(!swatches.dataset.bound){
        swatches.dataset.bound='1';
        swatches.addEventListener('click',event=>{
          const btn=event.target.closest('[data-theme-key]');
          if(btn)setThemePreference(btn.dataset.themeKey||'auto');
        });
      }
    }
  }
  function injectStyles(){
    if(document.getElementById('site-menu-clean-style')) return;
    const style=document.createElement('style');
    style.id='site-menu-clean-style';
    style.textContent=`
      .siteMenuButton{display:inline-flex!important;align-items:center!important;gap:8px!important;border:1px solid var(--v2-surface-border,rgba(255,255,255,.18))!important;background:linear-gradient(135deg,var(--v2-theme-soft,rgba(var(--site-theme-rgb,246,202,94),.16)),rgba(10,14,26,.88))!important;color:var(--v2-ink,var(--site-theme-ink,#fff))!important;border-radius:12px!important;padding:8px 10px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 8px 24px rgba(0,0,0,.28),0 0 18px var(--v2-theme-soft,rgba(var(--site-theme-rgb,246,202,94),.16))!important;}
      .siteMenuIcon{display:inline-flex!important;flex-direction:column!important;gap:3px!important;width:18px!important;}
      .siteMenuIcon i{display:block!important;height:2px!important;border-radius:99px!important;background:currentColor!important;}
      .siteMenuText{font-size:12px!important;letter-spacing:.04em!important;text-transform:uppercase!important;}
      .siteMenuOverlay{position:fixed!important;inset:0!important;z-index:9000!important;background:rgba(0,0,0,.46)!important;opacity:0!important;pointer-events:none!important;transition:opacity .18s ease!important;}
      .siteSideMenu{position:fixed!important;z-index:9001!important;left:0!important;top:0!important;bottom:0!important;width:min(82vw,310px)!important;transform:translateX(-102%)!important;transition:transform .22s ease!important;background:linear-gradient(145deg,var(--v2-theme-soft,rgba(var(--site-theme-rgb,246,202,94),.16)),transparent 34%),linear-gradient(180deg,color-mix(in srgb,var(--site-theme-bg,#0e1426) 88%,#050713),rgba(7,10,18,.98))!important;border-right:1px solid var(--v2-surface-border,rgba(255,255,255,.14))!important;box-shadow:28px 0 70px rgba(0,0,0,.45),0 0 34px var(--v2-theme-soft,rgba(var(--site-theme-rgb,246,202,94),.16))!important;padding:18px 16px!important;color:var(--v2-ink,var(--site-theme-ink,#fff))!important;display:flex!important;flex-direction:column!important;gap:18px!important;}
      body.site-menu-open .siteMenuOverlay{opacity:1!important;pointer-events:auto!important;}
      body.site-menu-open .siteSideMenu{transform:translateX(0)!important;}
      .siteMenuHead{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;padding-bottom:12px!important;border-bottom:1px solid var(--v2-surface-border,rgba(255,255,255,.10))!important;}
      .siteMenuTitle{font-weight:950!important;letter-spacing:.08em!important;text-transform:uppercase!important;}
      .siteMenuSub{font-size:12px!important;color:color-mix(in srgb,var(--v2-theme-trim,var(--site-theme-accent,#f6ca5e)) 32%,var(--muted,#aab1d6))!important;margin-top:2px!important;}
      .siteMenuClose{border:1px solid var(--v2-surface-border,rgba(255,255,255,.16))!important;background:var(--v2-theme-soft,rgba(255,255,255,.06))!important;color:var(--v2-ink,var(--site-theme-ink,#fff))!important;border-radius:10px!important;width:34px!important;height:34px!important;font-size:22px!important;line-height:1!important;cursor:pointer!important;}
      .siteMenuNav{display:flex!important;flex-direction:column!important;gap:13px!important;}
      .siteMenuSection{display:flex!important;flex-direction:column!important;gap:7px!important;}
      .siteMenuMain,.siteMenuSubLink{color:var(--v2-ink,var(--site-theme-ink,#fff))!important;text-decoration:none!important;border-radius:12px!important;line-height:1.1!important;}
      .siteMenuMain{font-size:15px!important;font-weight:950!important;letter-spacing:.04em!important;text-transform:uppercase!important;padding:9px 10px!important;background:linear-gradient(135deg,var(--v2-theme-soft,rgba(255,255,255,.06)),rgba(255,255,255,.035))!important;border:1px solid var(--v2-surface-border,rgba(255,255,255,.10))!important;}
      .siteMenuSubLink{font-size:14px!important;font-weight:800!important;color:var(--muted,#aab1d6)!important;padding:6px 10px 6px 20px!important;}
      .siteMenuSubLink::before{content:'- ';color:var(--v2-theme-trim,var(--site-theme-accent,#fff))!important;}
      .siteMenuMain:hover,.siteMenuSubLink:hover{background:var(--v2-theme-soft,rgba(255,255,255,.10))!important;color:var(--v2-ink,var(--site-theme-ink,#fff))!important;}
      .brandCredit{font-size:12px!important;line-height:1.2!important;color:var(--muted,#aab1d6)!important;margin-top:2px!important;font-weight:800!important;letter-spacing:.02em!important;}
      .siteThemePanel{display:flex!important;flex-direction:column!important;gap:9px!important;padding:12px!important;border-radius:14px!important;border:1px solid var(--v2-surface-border,rgba(255,255,255,.12))!important;background:linear-gradient(135deg,var(--v2-theme-soft,rgba(255,255,255,.06)),rgba(255,255,255,.035))!important;}
      .siteThemeLabel{font-size:12px!important;font-weight:950!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:var(--v2-ink,var(--site-theme-ink,#fff))!important;}
      .siteThemeSelect{width:100%!important;min-height:36px!important;border-radius:10px!important;border:1px solid var(--v2-surface-border,rgba(255,255,255,.16))!important;background:rgba(4,7,15,.74)!important;color:var(--v2-ink,var(--site-theme-ink,#fff))!important;padding:8px 10px!important;font-weight:850!important;}
      .siteThemeSwatches{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:7px!important;}
      .siteThemeSwatch{aspect-ratio:1!important;min-width:0!important;border-radius:10px!important;border:1px solid rgba(255,255,255,.20)!important;background:linear-gradient(135deg,var(--swatch-a),var(--swatch-b) 52%,var(--swatch-c))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 8px 18px rgba(0,0,0,.24)!important;cursor:pointer!important;}
      .siteThemeSwatch.active{outline:2px solid var(--v2-theme-trim,var(--site-theme-accent,#f6ca5e))!important;outline-offset:2px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 0 20px var(--v2-theme-soft,rgba(255,255,255,.18))!important;}
    `;
    document.head.appendChild(style);
  }
  function hasStylesheet(file){return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(l=>String(l.href||l.getAttribute('href')||'').includes(file));}
  function addCss(href,attr,file){
    if((attr&&document.querySelector(`link[${attr}]`))||(file&&hasStylesheet(file)))return;
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href=href;
    if(attr)l.setAttribute(attr,'1');
    document.head.appendChild(l);
  }
  function applyV2Shell(){
    const path=String(location.pathname||'');
    const isRoster=/roster\.html$/i.test(path);
    const isOptimizer=/optimizer\.html$/i.test(path);
    if(!isRoster&&!isOptimizer)return;
    document.body.classList.add(isRoster?'page-roster-v2':'page-optimizer-v2');
    if(isOptimizer)document.body.classList.add('page-optimizer');
    addCss('./v2-site-ui-pass.css?v=4','data-v2-site-ui-pass','v2-site-ui-pass.css');
    if(isRoster)addCss('./v2-roster-decramp.css?v=7','data-v2-roster-decramp','v2-roster-decramp.css');
    const sub=document.querySelector('.brandSub');
    if(sub)sub.textContent='Made By TheRealNodder for Everyone!';
  }
  function addCredit(){
    const title=document.querySelector('.brandTitle');
    const sub=document.querySelector('.brandSub');
    if(!title||document.querySelector('.brandCredit')||/Made By TheRealNodder/i.test(sub?.textContent||''))return;
    const credit=document.createElement('div');
    credit.className='brandCredit';
    credit.textContent='Made By TheRealNodder';
    title.insertAdjacentElement('afterend',credit);
  }
  function build(){
    injectStyles();
    applyV2Shell();
    addCredit();
    syncThemeLinks();
    const existing=document.getElementById('siteSideMenu');
    if(existing){hydrateThemeControl(existing);return;}
    const overlay=document.createElement('div'); overlay.className='siteMenuOverlay';
    const aside=document.createElement('aside'); aside.id='siteSideMenu'; aside.className='siteSideMenu'; aside.ariaHidden='true';
    aside.innerHTML=`<div class="siteMenuHead"><div><div class="siteMenuTitle">Menu</div><div class="siteMenuSub">Pages</div></div><button class="siteMenuClose" type="button" aria-label="Close menu">&times;</button></div><nav class="siteMenuNav" aria-label="Site navigation"><div class="siteMenuSection"><a class="siteMenuMain" href="${themedUrl('./index.html')}">Catalog</a><a class="siteMenuSubLink" href="${catalogUrl('characters')}">Character</a><a class="siteMenuSubLink" href="${catalogUrl('weapons')}">Weapon</a><a class="siteMenuSubLink" href="${catalogUrl('accessories')}">Accessories</a><a class="siteMenuSubLink" href="${catalogUrl('bosses')}">Bosses</a></div><div class="siteMenuSection"><a class="siteMenuMain" href="${themedUrl('./roster.html')}">Roster</a></div><div class="siteMenuSection"><a class="siteMenuMain" href="${themedUrl('./optimizer.html')}">Optimizer</a><a class="siteMenuSubLink" href="${themedUrl('./optimizer.html#storySection')}">Story</a><a class="siteMenuSubLink" href="${themedUrl('./optimizer.html#platoonsSection')}">Platoon</a></div></nav><section class="siteThemePanel" aria-label="Theme"><label class="siteThemeLabel" for="siteThemeSelect">Theme</label><select id="siteThemeSelect" class="siteThemeSelect"></select><div class="siteThemeSwatches"></div></section>`;
    document.body.append(overlay,aside);
    hydrateThemeControl(aside);
    overlay.addEventListener('click',close); aside.querySelector('.siteMenuClose').addEventListener('click',close); aside.addEventListener('click',e=>{ if(e.target.closest('a')) close(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
  }
  function open(){ build(); document.body.classList.add('site-menu-open'); document.getElementById('siteSideMenu')?.setAttribute('aria-hidden','false'); }
  function close(){ document.body.classList.remove('site-menu-open'); document.getElementById('siteSideMenu')?.setAttribute('aria-hidden','true'); }
  function init(){
    injectStyles();
    applyV2Shell();
    addCredit();
    syncThemeLinks();
    const inner=document.querySelector('.topbar-inner');
    if(inner&&!document.querySelector('.siteMenuButton')){
      const b=document.createElement('button');
      b.className='siteMenuButton'; b.type='button'; b.ariaLabel='Open menu';
      b.innerHTML='<span class="siteMenuIcon" aria-hidden="true"><i></i><i></i><i></i></span><span class="siteMenuText">Menu</span>';
      b.title='Open menu'; inner.insertBefore(b,inner.firstChild); b.addEventListener('click',open);
    }
    build();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
