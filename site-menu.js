(function(){
  const themes=[['auto','Auto Style'],['spring','Spring'],['summer','Summer'],['autumn','Autumn'],['winter','Winter'],['newyear','New Year'],['valentine','Valentine'],['stpatrick',"St. Patrick's"],['easter','Easter'],['independence','Independence Day'],['halloween','Halloween'],['thanksgiving','Thanksgiving'],['christmas','Christmas']];
  function q(p){ return './index.html?' + new URLSearchParams(p).toString(); }
  function current(){ const p=location.pathname.toLowerCase(); return p.includes('optimizer')?'optimizer':p.includes('roster')?'roster':'catalog'; }
  function themeSelect(){
    const wrap=document.createElement('label'); wrap.className='siteThemeField'; wrap.innerHTML='<span>Style</span>';
    const s=document.createElement('select'); s.className='siteThemeSelect'; s.ariaLabel='Style selector';
    themes.forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; s.appendChild(o); });
    s.value=window.EvertaleTheme?.getPreference?.()||localStorage.getItem('evertale_theme_pref_v1')||'auto';
    s.addEventListener('change',()=>{ if(window.EvertaleTheme?.setPreference) window.EvertaleTheme.setPreference(s.value); else localStorage.setItem('evertale_theme_pref_v1',s.value); });
    wrap.appendChild(s); return wrap;
  }
  function build(){
    if(document.getElementById('siteSideMenu')) return;
    const c=current();
    const overlay=document.createElement('div'); overlay.className='siteMenuOverlay';
    const aside=document.createElement('aside'); aside.id='siteSideMenu'; aside.className='siteSideMenu'; aside.ariaHidden='true';
    aside.innerHTML=`<div class="siteMenuHead"><div><div class="siteMenuTitle">Evertale Optimizer</div><div class="siteMenuSub">Quick Navigation</div></div><button class="siteMenuClose" type="button" aria-label="Close menu">×</button></div><div class="siteMenuTheme"></div><nav class="siteMenuNav"><details class="siteMenuGroup" ${c==='catalog'?'open':''}><summary>Catalog</summary><a href="./index.html">All</a><a href="${q({type:'characters'})}">Characters</a><a href="${q({type:'weapons'})}">Weapons</a><a href="${q({type:'accessories'})}">Accessories</a><a href="${q({type:'bosses'})}">Bosses</a></details><details class="siteMenuGroup" ${c==='roster'?'open':''}><summary>Roster</summary><a href="./roster.html">Owned Roster</a><a href="./roster.html?view=compact">Compact View</a><a href="./roster.html?view=detailed">Detailed View</a></details><details class="siteMenuGroup" ${c==='optimizer'?'open':''}><summary>Optimizer</summary><a href="./optimizer.html">Build Teams</a><a href="./optimizer.html#storySection">Story Team</a><a href="./optimizer.html#platoonsSection">Platoons</a></details></nav>`;
    aside.querySelector('.siteMenuTheme').appendChild(themeSelect());
    document.body.append(overlay,aside);
    overlay.addEventListener('click',close); aside.querySelector('.siteMenuClose').addEventListener('click',close); aside.addEventListener('click',e=>{ if(e.target.closest('a')) close(); });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') close(); });
  }
  function open(){ build(); document.body.classList.add('site-menu-open'); document.getElementById('siteSideMenu')?.setAttribute('aria-hidden','false'); }
  function close(){ document.body.classList.remove('site-menu-open'); document.getElementById('siteSideMenu')?.setAttribute('aria-hidden','true'); }
  function init(){
    const inner=document.querySelector('.topbar-inner'); if(inner&&!document.querySelector('.siteMenuButton')){ const b=document.createElement('button'); b.className='siteMenuButton'; b.type='button'; b.ariaLabel='Open menu'; b.innerHTML='<span class="siteMenuIcon" aria-hidden="true"><i></i><i></i><i></i></span><span class="siteMenuText">Menu</span>'; b.title='Open menu'; inner.insertBefore(b,inner.firstChild); b.addEventListener('click',open); }
    build();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
