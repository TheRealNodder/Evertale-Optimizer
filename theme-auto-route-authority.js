/* theme-auto-route-authority.js
   Keeps Auto theme explicit across Catalog, Roster, and Optimizer links.
   Scope: theme routing only. No layout, data, sidebar, catalog, roster, optimizer, or stat logic ownership.
*/
(function(){
  const AUTO='auto';
  const HTML_RE=/\.html$/i;

  function normalize(value){
    return window.EvertaleTheme?.normalizeThemeKey?.(value)||String(value||'').trim().toLowerCase();
  }

  function activePreference(){
    try{
      const fromUrl=normalize(new URLSearchParams(location.search).get('theme'));
      if(fromUrl)return fromUrl;
    }catch{}
    return normalize(window.EvertaleTheme?.getPreference?.())||AUTO;
  }

  function shouldCarryAuto(){
    return activePreference()===AUTO;
  }

  function withTheme(href,theme){
    const raw=String(href||'').trim();
    if(!raw||raw.startsWith('#')||/^(mailto|tel|javascript):/i.test(raw))return href;
    try{
      const url=new URL(raw,location.href);
      if(url.origin!==location.origin)return href;
      if(!HTML_RE.test(url.pathname)&&url.pathname!==location.pathname)return href;
      const key=normalize(theme)||AUTO;
      url.searchParams.set('theme',key);
      const file=url.pathname.slice(url.pathname.lastIndexOf('/')+1)||'index.html';
      return `./${file}${url.search}${url.hash}`;
    }catch{return href;}
  }

  function syncLinks(root=document){
    const theme=activePreference();
    if(!root?.querySelectorAll)return;
    root.querySelectorAll('a[href]').forEach(link=>{
      const next=withTheme(link.getAttribute('href'),theme);
      if(next&&next!==link.getAttribute('href'))link.setAttribute('href',next);
    });
  }

  function syncCurrentUrl(){
    if(!shouldCarryAuto())return;
    try{
      const url=new URL(location.href);
      if(url.searchParams.get('theme')===AUTO)return;
      url.searchParams.set('theme',AUTO);
      history.replaceState(null,'',`${url.pathname}${url.search}${url.hash}`);
    }catch{}
  }

  let scheduled=false;
  function schedule(root=document){
    if(scheduled)return;
    scheduled=true;
    const run=()=>{
      scheduled=false;
      syncCurrentUrl();
      syncLinks(root);
    };
    if('requestAnimationFrame'in window)requestAnimationFrame(run);
    else setTimeout(run,16);
  }

  function install(){
    syncCurrentUrl();
    syncLinks(document);
    document.addEventListener('evertale:theme-applied',()=>schedule(document),true);
    document.addEventListener('click',()=>schedule(document),true);
    window.addEventListener('popstate',()=>schedule(document));
    if(window.MutationObserver){
      new MutationObserver(records=>{
        records.forEach(record=>{
          record.addedNodes.forEach(node=>{
            if(node?.nodeType===1)schedule(node);
          });
        });
      }).observe(document.documentElement,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
