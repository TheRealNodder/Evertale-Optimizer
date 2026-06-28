(function(){
  const TZ='America/Los_Angeles';
  const KEY='evertale_theme_pref_v1';
  const AUTO='auto';
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
    christmas:['#072a1f','#0f5132','#b22222','#f3fff6'],
    midnight:['#040814','#14213d','#38bdf8','#f4fbff'],
    aurora:['#071b2f','#123c4d','#67e8f9','#ecfeff'],
    sakura:['#251321','#6d2848','#f9a8d4','#fff1f7'],
    ocean:['#031926','#0b4f6c','#2dd4bf','#ecfeff'],
    ember:['#160b08','#5b1f16','#fb7185','#fff7ed'],
    royal:['#0f1028','#352069','#facc15','#fff8d6'],
    cyber:['#050816','#1e1b4b','#22d3ee','#f8fafc'],
    forest:['#061a12','#14532d','#84cc16','#f7fee7'],
    cosmic:['#080517','#2d1b69','#c084fc','#faf5ff'],
    quartz:['#121826','#334155','#f0abfc','#f8fafc'],
    sunrise:['#1f1307','#9a3412','#fbbf24','#fff7ed']
  };
  const themeLabels={
    spring:'Spring',summer:'Summer',autumn:'Autumn',winter:'Winter',
    newyear:'New Year',valentine:'Valentine',stpatrick:'St. Patrick',easter:'Easter',
    independence:'Independence',halloween:'Halloween',thanksgiving:'Thanksgiving',christmas:'Christmas',
    midnight:'Midnight',aurora:'Aurora',sakura:'Sakura',ocean:'Ocean',ember:'Ember',
    royal:'Royal',cyber:'Cyber',forest:'Forest',cosmic:'Cosmic',quartz:'Quartz',sunrise:'Sunrise'
  };
  const displayAccents={
    christmas:'#44d17a',
    halloween:'#f39c12',
    valentine:'#ff7aa8',
    stpatrick:'#5dbb63',
    newyear:'#d7c8ff',
    independence:'#ffffff',
    midnight:'#38bdf8',
    aurora:'#67e8f9',
    sakura:'#f9a8d4',
    ocean:'#2dd4bf',
    ember:'#fb7185',
    royal:'#facc15',
    cyber:'#22d3ee',
    forest:'#84cc16',
    cosmic:'#c084fc',
    quartz:'#f0abfc',
    sunrise:'#fbbf24'
  };
  const themeAliases={
    automatic:AUTO,
    default:AUTO,
    fall:'autumn',
    xmas:'christmas',
    christmasday:'christmas',
    newyears:'newyear',
    newyearsday:'newyear',
    valentines:'valentine',
    valentinesday:'valentine',
    stpaddy:'stpatrick',
    stpatty:'stpatrick',
    stpatricks:'stpatrick',
    stpatricksday:'stpatrick',
    saintpatrick:'stpatrick',
    saintpatricksday:'stpatrick',
    july4:'independence',
    fourthofjuly:'independence',
    independenceday:'independence',
    turkeyday:'thanksgiving'
  };
  function compactKey(value){
    return String(value??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  }
  function normalizeThemeKey(value){
    const raw=String(value??'').trim();
    if(!raw)return'';
    const lower=raw.toLowerCase();
    const compact=compactKey(raw);
    if(compact===AUTO)return AUTO;
    if(themes[raw])return raw;
    if(themes[lower])return lower;
    const found=Object.keys(themes).find(key=>compactKey(key)===compact);
    return found||themeAliases[compact]||'';
  }
  function dateLA(input=new Date()){
    const date=input instanceof Date?input:new Date(input);
    const safe=Number.isNaN(date.getTime())?new Date():date;
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'numeric',day:'numeric'}).formatToParts(safe);
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
  function nthWeekday(year,month,weekday,nth){
    const first=new Date(Date.UTC(year,month-1,1)).getUTCDay();
    return 1+((7+weekday-first)%7)+(nth-1)*7;
  }
  function daysFrom(now,target){
    const a=Date.UTC(now.year,now.month-1,now.day);
    const b=Date.UTC(now.year,target.month-1,target.day);
    return Math.round((a-b)/86400000);
  }
  function nearDate(now,target,before,after){
    const delta=daysFrom(now,target);
    return delta>=-before&&delta<=after;
  }
  function chooseTheme(input){
    const now=input&&typeof input==='object'&&'month'in input&&'day'in input?input:dateLA(input);
    const year=now.year||dateLA().year;
    const ea=easter(year);
    const thanksgiving={month:11,day:nthWeekday(year,11,4,4)};
    if(inRange(now.month,now.day,12,1,12,31))return'christmas';
    if(inRange(now.month,now.day,1,1,1,10))return'newyear';
    if(inRange(now.month,now.day,2,1,2,15))return'valentine';
    if(inRange(now.month,now.day,3,10,3,18))return'stpatrick';
    if(nearDate(now,ea,5,2))return'easter';
    if(inRange(now.month,now.day,7,1,7,7))return'independence';
    if(inRange(now.month,now.day,10,1,10,31))return'halloween';
    if(nearDate(now,thanksgiving,4,3))return'thanksgiving';
    return season(now.month,now.day);
  }
  function urlPreference(){
    try{
      return normalizeThemeKey(new URLSearchParams(location.search).get('theme'));
    }catch{return'';}
  }
  function themedHref(href,theme){
    const key=normalizeThemeKey(theme);
    const raw=String(href||'').trim();
    if(!raw||raw.startsWith('#')||/^(mailto|tel|javascript):/i.test(raw))return href;
    try{
      const url=new URL(raw,location.href);
      if(url.origin!==location.origin)return href;
      if(!/\.html$/i.test(url.pathname)&&url.pathname!==location.pathname)return href;
      if(!key||key===AUTO)url.searchParams.delete('theme');
      else url.searchParams.set('theme',key);
      const file=url.pathname.slice(url.pathname.lastIndexOf('/')+1)||'index.html';
      return `./${file}${url.search}${url.hash}`;
    }catch{return href;}
  }
  function linkPreference(){
    const explicit=urlPreference();
    return explicit||storedPreference();
  }
  let observingLinks=false;
  function syncThemeLinks(root=document){
    const theme=linkPreference();
    if(!root?.querySelectorAll)return;
    root.querySelectorAll('a[href]').forEach(link=>{
      link.setAttribute('href',themedHref(link.getAttribute('href'),theme));
    });
  }
  function observeThemeLinks(){
    if(observingLinks||!window.MutationObserver)return;
    observingLinks=true;
    new MutationObserver(records=>{
      records.forEach(record=>{
        record.addedNodes.forEach(node=>{
          if(node?.nodeType!==1)return;
          if(node.matches?.('a[href]'))node.setAttribute('href',themedHref(node.getAttribute('href'),linkPreference()));
          syncThemeLinks(node);
        });
      });
    }).observe(document.documentElement,{childList:true,subtree:true});
  }
  function storedPreference(){
    try{return normalizeThemeKey(localStorage.getItem(KEY))||AUTO;}
    catch{return AUTO;}
  }
  function pref(){
    const value=urlPreference()||storedPreference();
    return normalizeThemeKey(value)||AUTO;
  }
  function themeState(key,requested,input){
    const cfg=themeConfig(key);
    const now=input&&typeof input==='object'&&'month'in input&&'day'in input?input:dateLA(input);
    const seasonKey=['spring','summer','autumn','winter'].includes(key)?key:season(now.month,now.day);
    const holidayKey=['spring','summer','autumn','winter'].includes(key)?'':key;
    return{requested,key,mode:requested===AUTO?AUTO:'manual',season:seasonKey,holiday:holidayKey,...cfg};
  }
  function autoTheme(input){
    return themeState(chooseTheme(input),AUTO,input);
  }
  function resolvedTheme(input){
    const requested=pref();
    return requested===AUTO?autoTheme(input):themeState(requested,requested,input);
  }
  function themeConfig(key){
    const colors=themes[key]||themes.winter;
    const accent=displayAccents[key]||colors[2];
    return {
      key,
      label:themeLabels[key]||String(key||'Theme').replace(/(^|[-_])\w/g,s=>s.replace(/[-_]/,'').toUpperCase()),
      bg:colors[0],
      surface:colors[1],
      secondary:colors[1],
      accent,
      ink:colors[3],
      gradientA:colors[0],
      gradientB:colors[1],
      gradientC:accent
    };
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
    const active=resolvedTheme();
    const requested=active.requested;
    const key=active.key;
    const cfg=active;
    const colors=[cfg.bg,cfg.surface,cfg.accent,cfg.ink];
    const root=document.documentElement;
    const accent=cfg.accent;
    const ink=cfg.ink;
    const rgb=hexToRgb(accent);
    const surfaceRgb=hexToRgb(cfg.surface);
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
    setVar(root,'--site-theme-surface-rgb',surfaceRgb);
    setVar(root,'--site-theme-gradient-a',cfg.gradientA);
    setVar(root,'--site-theme-gradient-b',cfg.gradientB);
    setVar(root,'--site-theme-gradient-c',cfg.gradientC);
    setVar(root,'--site-theme-glow',`rgba(${rgb},.18)`);
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
    root.setAttribute('data-theme-key',key);
    root.setAttribute('data-theme-label',cfg.label);
    root.setAttribute('data-theme-pref',requested);
    root.setAttribute('data-theme-mode',cfg.mode);
    root.setAttribute('data-theme-season',cfg.season);
    root.setAttribute('data-theme-holiday',cfg.holiday);
    if(document.body){
      document.body.setAttribute('data-theme-key',key);
      document.body.setAttribute('data-theme-label',cfg.label);
      document.body.setAttribute('data-theme-pref',requested);
      document.body.setAttribute('data-theme-mode',cfg.mode);
      document.body.setAttribute('data-theme-season',cfg.season);
      document.body.setAttribute('data-theme-holiday',cfg.holiday);
    }
    syncThemeLinks();
    observeThemeLinks();
    try{
      document.dispatchEvent(new CustomEvent('evertale:theme-applied',{detail:{...cfg}}));
    }catch{}
  }
  window.EvertaleTheme={
    themes,
    listThemes(){return Object.keys(themes).map(key=>themeConfig(key));},
    listThemeOptions(){
      const active=autoTheme();
      return [{...active,key:AUTO,label:`Auto (${active.label})`,auto:true,resolvedKey:active.key},...Object.keys(themes).map(key=>themeConfig(key))];
    },
    getActiveTheme(){return resolvedTheme();},
    getResolvedTheme:resolvedTheme,
    getAutoTheme:autoTheme,
    getCalendarPreview(year=dateLA().year){
      const ea=easter(year);
      return{year,easter:ea,thanksgiving:{month:11,day:nthWeekday(year,11,4,4)}};
    },
    normalizeThemeKey,
    chooseTheme,
    applyTheme,
    syncThemeLinks,
    getPreference:pref,
    setPreference(value){
      const next=normalizeThemeKey(value)||AUTO;
      try{localStorage.setItem(KEY,next);}
      catch{}
      applyTheme();
    }
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',applyTheme,{once:true}):applyTheme();
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&pref()===AUTO)applyTheme();});
  setInterval(()=>{if(pref()===AUTO)applyTheme();},30*60*1000);
})();
