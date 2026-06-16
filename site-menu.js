(function(){
  function catalogUrl(type){ return './index.html' + (type ? '?' + new URLSearchParams({type}).toString() : ''); }
  function injectStyles(){
    if(document.getElementById('site-menu-clean-style')) return;
    const style=document.createElement('style');
    style.id='site-menu-clean-style';
    style.textContent=`
      .siteMenuButton{display:inline-flex!important;align-items:center!important;gap:8px!important;border:1px solid rgba(255,255,255,.18)!important;background:rgba(10,14,26,.88)!important;color:#fff!important;border-radius:12px!important;padding:8px 10px!important;font-weight:900!important;cursor:pointer!important;box-shadow:0 8px 24px rgba(0,0,0,.28)!important;}
      .siteMenuIcon{display:inline-flex!important;flex-direction:column!important;gap:3px!important;width:18px!important;}
      .siteMenuIcon i{display:block!important;height:2px!important;border-radius:99px!important;background:currentColor!important;}
      .siteMenuText{font-size:12px!important;letter-spacing:.04em!important;text-transform:uppercase!important;}
      .siteMenuOverlay{position:fixed!important;inset:0!important;z-index:9000!important;background:rgba(0,0,0,.46)!important;opacity:0!important;pointer-events:none!important;transition:opacity .18s ease!important;}
      .siteSideMenu{position:fixed!important;z-index:9001!important;left:0!important;top:0!important;bottom:0!important;width:min(82vw,310px)!important;transform:translateX(-102%)!important;transition:transform .22s ease!important;background:linear-gradient(180deg,rgba(14,20,38,.98),rgba(7,10,18,.98))!important;border-right:1px solid rgba(255,255,255,.14)!important;box-shadow:28px 0 70px rgba(0,0,0,.45)!important;padding:18px 16px!important;color:#fff!important;display:flex!important;flex-direction:column!important;gap:18px!important;}
      body.site-menu-open .siteMenuOverlay{opacity:1!important;pointer-events:auto!important;}
      body.site-menu-open .siteSideMenu{transform:translateX(0)!important;}
      .siteMenuHead{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:12px!important;padding-bottom:12px!important;border-bottom:1px solid rgba(255,255,255,.10)!important;}
      .siteMenuTitle{font-weight:950!important;letter-spacing:.08em!important;text-transform:uppercase!important;}
      .siteMenuSub{font-size:12px!important;color:var(--muted,#aab1d6)!important;margin-top:2px!important;}
      .siteMenuClose{border:1px solid rgba(255,255,255,.16)!important;background:rgba(255,255,255,.06)!important;color:#fff!important;border-radius:10px!important;width:34px!important;height:34px!important;font-size:22px!important;line-height:1!important;cursor:pointer!important;}
      .siteMenuNav{display:flex!important;flex-direction:column!important;gap:13px!important;}
      .siteMenuSection{display:flex!important;flex-direction:column!important;gap:7px!important;}
      .siteMenuMain,.siteMenuSubLink{color:#fff!important;text-decoration:none!important;border-radius:12px!important;line-height:1.1!important;}
      .siteMenuMain{font-size:15px!important;font-weight:950!important;letter-spacing:.04em!important;text-transform:uppercase!important;padding:9px 10px!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.10)!important;}
      .siteMenuSubLink{font-size:14px!important;font-weight:800!important;color:var(--muted,#aab1d6)!important;padding:6px 10px 6px 20px!important;}
      .siteMenuSubLink::before{content:'- ';color:#fff!important;}
      .siteMenuMain:hover,.siteMenuSubLink:hover{background:rgba(255,255,255,.10)!important;color:#fff!important;}
      .brandCredit{font-size:12px!important;line-height:1.2!important;color:var(--muted,#aab1d6)!important;margin-top:2px!important;font-weight:800!important;letter-spacing:.02em!important;}
    `;
    document.head.appendChild(style);
  }
  function applyV2Shell(){
    const path=String(location.pathname||'');
    const isRoster=/roster\.html$/i.test(path);
    const isOptimizer=/optimizer\.html$/i.test(path);
    if(!isRoster&&!isOptimizer)return;
    document.body.classList.add(isRoster?'page-roster-v2':'page-optimizer-v2');
    if(isOptimizer)document.body.classList.add('page-optimizer');
    if(!document.querySelector('link[data-v2-site-ui-pass]')){
      const l=document.createElement('link');
      l.rel='stylesheet';
      l.href='./v2-site-ui-pass.css?v=1';
      l.setAttribute('data-v2-site-ui-pass','1');
      document.head.appendChild(l);
    }
    const sub=document.querySelector('.brandSub');
    if(sub)sub.textContent='Made By TheRealNodder for Everyone!';
  }
  function addCredit(){
    const title=document.querySelector('.brandTitle');
    if(!title||document.querySelector('.brandCredit'))return;
    const credit=document.createElement('div');
    credit.className='brandCredit';
    credit.textContent='Made By TheRealNodder';
    title.insertAdjacentElement('afterend',credit);
  }
  function build(){
    injectStyles();
    applyV2Shell();
    addCredit();
    if(document.getElementById('siteSideMenu')) return;
    const overlay=document.createElement('div'); overlay.className='siteMenuOverlay';
    const aside=document.createElement('aside'); aside.id='siteSideMenu'; aside.className='siteSideMenu'; aside.ariaHidden='true';
    aside.innerHTML=`<div class="siteMenuHead"><div><div class="siteMenuTitle">Menu</div><div class="siteMenuSub">Pages</div></div><button class="siteMenuClose" type="button" aria-label="Close menu">×</button></div><nav class="siteMenuNav" aria-label="Site navigation"><div class="siteMenuSection"><a class="siteMenuMain" href="./index.html">Catalog</a><a class="siteMenuSubLink" href="${catalogUrl('characters')}">Character</a><a class="siteMenuSubLink" href="${catalogUrl('weapons')}">Weapon</a><a class="siteMenuSubLink" href="${catalogUrl('accessories')}">Accessories</a><a class="siteMenuSubLink" href="${catalogUrl('bosses')}">Bosses</a></div><div class="siteMenuSection"><a class="siteMenuMain" href="./roster.html">Roster</a></div><div class="siteMenuSection"><a class="siteMenuMain" href="./optimizer.html">Optimizer</a><a class="siteMenuSubLink" href="./optimizer.html#storySection">Story</a><a class="siteMenuSubLink" href="./optimizer.html#platoonsSection">Platoon</a></div></nav>`;
    document.body.append(overlay,aside);
    overlay.addEventListener('click',close); aside.querySelector('.siteMenuClose').addEventListener('click',close); aside.addEventListener('click',e=>{ if(e.target.closest('a')) close(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
  }
  function open(){ build(); document.body.classList.add('site-menu-open'); document.getElementById('siteSideMenu')?.setAttribute('aria-hidden','false'); }
  function close(){ document.body.classList.remove('site-menu-open'); document.getElementById('siteSideMenu')?.setAttribute('aria-hidden','true'); }
  function init(){
    injectStyles();
    applyV2Shell();
    addCredit();
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