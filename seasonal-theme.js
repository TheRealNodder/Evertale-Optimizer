(function(){
  const TZ='America/Los_Angeles';
  const KEY='evertale_theme_pref_v1';
  const themes={
    spring:['#153b2b','#3f7d57','#91d18b','#f1ffe8'],
    summer:['#0b2e4f','#145da0','#f7b733','#fff3b0'],
    autumn:['#2d1b12','#7b3f00','#c97a40','#f2c572'],
    winter:['#0a1f33','#183a5c','#7fb3d5','#eaf6ff'],
    newyear:['#0b1020','#1e2a78','#7c4dff','#d7c8ff'],
    valentine:['#3b0a23','#8b1e4f','#d94f70','#ffd1dc'],
    stpatrick:['#062b16','#0f6b3a','#5dbb63','#daf7dc'],
    easter:['#2e245c','#7c70d8','#f7c6e0','#fff7c2'],
    independence:['#081f5c','#b22234','#ffffff','#6ea8fe'],
    halloween:['#140b1f','#4a235a','#d35400','#f39c12'],
    thanksgiving:['#2b1a10','#8c4a1f','#d4a373','#f6e7cb'],
    christmas:['#072a1f','#0f5132','#b22222','#f3fff6']
  };
  const displayAccents={
    christmas:'#44d17a',
    halloween:'#f39c12',
    valentine:'#ff7aa8',
    stpatrick:'#5dbb63',
    newyear:'#d7c8ff',
    independence:'#ffffff'
  };
  function dateLA(){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date());
    const get=type=>Number(parts.find(x=>x.type===type)?.value||0);
    return{year:get('year'),month:get('month'),day:get('day')};
  }
  function inRange(m,d,sm,sd,em,ed){
    const x=m*100+d,start=sm*100+sd,end=em*100+ed;
    return start<=end?x>=start&&x<=end:x>=start||x<=end;
  }
  function season(m,d){
    const x=m*100+d;
    if(x>=320&&x<621)return'spring';
    if(x>=621&&x<923)return'summer';
    if(x>=923&&x<1221)return'autumn';
    return'winter';
  }
  function easter(y){
    const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
    return{month:mo,day:da};
  }
  function chooseTheme(){
    const now=dateLA(),ea=easter(now.year);
    if(inRange(now.month,now.day,12,1,12,31))return'christmas';
    if(inRange(now.month,now.day,1,1,1,10))return'newyear';
    if(inRange(now.month,now.day,2,1,2,15))return'valentine';
    if(inRange(now.month,now.day,3,10,3,18))return'stpatrick';
    if(inRange(now.month,now.day,ea.month,Math.max(1,ea.day-5),ea.month,Math.min(31,ea.day+2)))return'easter';
    if(inRange(now.month,now.day,7,1,7,7))return'independence';
    if(inRange(now.month,now.day,10,1,10,31))return'halloween';
    if(inRange(now.month,now.day,11,20,11,30))return'thanksgiving';
    return season(now.month,now.day);
  }
  function urlPreference(){
    try{
      const value=new URLSearchParams(location.search).get('theme');
      return themes[value]||value==='auto'?value:'';
    }catch{return'';}
  }
  function themedHref(href,theme){
    if(!theme||theme==='auto')return href;
    const raw=String(href||'').trim();
    if(!raw||raw.startsWith('#')||/^(mailto|tel|javascript):/i.test(raw))return href;
    try{
      const url=new URL(raw,location.href);
      if(url.origin!==location.origin)return href;
      if(!/\.html$/i.test(url.pathname)&&url.pathname!==location.pathname)return href;
      url.searchParams.set('theme',theme);
      const file=url.pathname.slice(url.pathname.lastIndexOf('/')+1)||'index.html';
      return `./${file}${url.search}${url.hash}`;
    }catch{return href;}
  }
  let observingLinks=false;
  function syncThemeLinks(root=document){
    const theme=urlPreference();
    if(!theme||theme==='auto'||!root?.querySelectorAll)return;
    root.querySelectorAll('a[href]').forEach(link=>{
      link.setAttribute('href',themedHref(link.getAttribute('href'),theme));
    });
  }
  function observeThemeLinks(){
    if(observingLinks||!urlPreference()||!window.MutationObserver)return;
    observingLinks=true;
    new MutationObserver(records=>{
      records.forEach(record=>{
        record.addedNodes.forEach(node=>{
          if(node?.nodeType!==1)return;
          if(node.matches?.('a[href]'))node.setAttribute('href',themedHref(node.getAttribute('href'),urlPreference()));
          syncThemeLinks(node);
        });
      });
    }).observe(document.documentElement,{childList:true,subtree:true});
  }
  function storedPreference(){
    try{return localStorage.getItem(KEY)||'auto';}
    catch{return'auto';}
  }
  function pref(){
    const value=urlPreference()||storedPreference();
    return themes[value]||value==='auto'?value:'auto';
  }
  function hexToRgb(hex){
    const clean=String(hex||'').replace('#','').trim();
    const full=clean.length===3?clean.split('').map(ch=>ch+ch).join(''):clean;
    const n=Number.parseInt(full,16);
    if(!Number.isFinite(n))return'246,202,94';
    return[(n>>16)&255,(n>>8)&255,n&255].join(',');
  }
  function setVar(root,name,value){root.style.setProperty(name,value);}
  function applyTheme(){
    const requested=pref();
    const key=requested==='auto'?chooseTheme():requested;
    const colors=themes[key]||themes.winter;
    const root=document.documentElement;
    const accent=displayAccents[key]||colors[2];
    const ink=colors[3];
    const rgb=hexToRgb(accent);
    setVar(root,'--bg',colors[0]);
    setVar(root,'--season-a',colors[0]);
    setVar(root,'--season-b',colors[1]);
    setVar(root,'--season-c',accent);
    setVar(root,'--season-d',ink);
    setVar(root,'--site-theme-bg',colors[0]);
    setVar(root,'--site-theme-surface',colors[1]);
    setVar(root,'--site-theme-accent',accent);
    setVar(root,'--site-theme-ink',ink);
    setVar(root,'--site-theme-secondary',colors[1]);
    setVar(root,'--site-theme-rgb',rgb);
    setVar(root,'--v2-theme-rgb',rgb);
    setVar(root,'--v2-theme-trim',accent);
    setVar(root,'--v2-theme-secondary',colors[1]);
    setVar(root,'--v2-theme-soft',`rgba(${rgb},.16)`);
    setVar(root,'--v2-theme-mid',`rgba(${rgb},.28)`);
    setVar(root,'--v2-theme-strong',`rgba(${rgb},.48)`);
    setVar(root,'--v2-theme-overlay',`rgba(${rgb},.12)`);
    setVar(root,'--v2-ink',ink);
    setVar(root,'--gold',accent);
    setVar(root,'--purple',colors[1]);
    setVar(root,'--blue',ink);
    if(document.body){
      const now=dateLA();
      document.body.setAttribute('data-theme-key',key);
      document.body.setAttribute('data-theme-pref',requested);
      document.body.setAttribute('data-theme-season',['spring','summer','autumn','winter'].includes(key)?key:season(now.month,now.day));
      document.body.setAttribute('data-theme-holiday',['spring','summer','autumn','winter'].includes(key)?'':key);
    }
    syncThemeLinks();
    observeThemeLinks();
  }
  window.EvertaleTheme={
    themes,
    chooseTheme,
    applyTheme,
    syncThemeLinks,
    getPreference:pref,
    setPreference(value){
      try{localStorage.setItem(KEY,themes[value]||value==='auto'?value:'auto');}
      catch{}
      applyTheme();
    }
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',applyTheme,{once:true}):applyTheme();
})();
