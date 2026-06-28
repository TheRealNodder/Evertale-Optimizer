(function(){
  const TZ='America/Los_Angeles';
  const KEY='evertale_theme_pref_v1';
  const AUTO='auto';
  const SEASON_KEYS=new Set(['spring','summer','autumn','winter']);
  const HOLIDAY_KEYS=new Set(['newyear','valentine','stpatrick','easter','independence','halloween','thanksgiving','christmas']);
  const GEM_KEYS=new Set(['gold','silver','ruby','sapphire','emerald','amethyst','diamond','pearl','platinum','opal','topaz','jade','obsidian','quartz']);
  const POKEMON_KEYS=new Set(['gold','silver','ruby','sapphire','emerald','diamond','pearl','platinum']);
  const HANDHELD_KEYS=new Set(['crimsonblack','cobaltblack','metallicrose','bronzexl','blackwhitedsi','galaxystyle','superfamicom']);
  const LEGENDARY_META={
    hooh:{group:'Pokémon · Johto',body:'#e84a32',energy:'#f4c84a',detail:'#3c9a68'},
    lugia:{group:'Pokémon · Johto',body:'#e7edf0',energy:'#4d65a8',detail:'#d76b72'},
    suicune:{group:'Pokémon · Johto',body:'#74bbc2',energy:'#9d72c5',detail:'#f5f7ef'},
    groudon:{group:'Pokémon · Hoenn',body:'#d83c2f',energy:'#00d9ff',detail:'#f5d44c'},
    kyogre:{group:'Pokémon · Hoenn',body:'#0964a8',energy:'#ff315f',detail:'#eef7ff'},
    rayquaza:{group:'Pokémon · Hoenn',body:'#247b4d',energy:'#f2cf3f',detail:'#df5872'},
    shinyprimalgroudon:{group:'Pokémon · Hoenn Shiny',body:'#24231f',energy:'#fff0b5',detail:'#f0a8a0'},
    shinyprimalkyogre:{group:'Pokémon · Hoenn Shiny',body:'#17191d',energy:'#f3dc54',detail:'#9a4da4'},
    shinymegarayquaza:{group:'Pokémon · Hoenn Shiny',body:'#171719',energy:'#ffb63d',detail:'#ff5a46'},
    dialga:{group:'Pokémon · Sinnoh',body:'#486187',energy:'#7cd9e8',detail:'#e2edf4'},
    palkia:{group:'Pokémon · Sinnoh',body:'#e7dfe4',energy:'#e88bc1',detail:'#8f6eb2'},
    giratina:{group:'Pokémon · Sinnoh',body:'#b9b4aa',energy:'#e2c451',detail:'#c9534e'},
    arceus:{group:'Pokémon · Sinnoh',body:'#e7e8e4',energy:'#c8ae52',detail:'#6fbf87'},
    reshiram:{group:'Pokémon · Unova',body:'#e9f3f1',energy:'#ff8450',detail:'#8eb6e8'},
    zekrom:{group:'Pokémon · Unova',body:'#24272b',energy:'#35d5e6',detail:'#ef4b5d'},
    blackkyurem:{group:'Pokémon · Unova',body:'#343a3d',energy:'#35b8e8',detail:'#f59e47'},
    whitekyurem:{group:'Pokémon · Unova',body:'#f4f1ec',energy:'#ff7048',detail:'#63c7e8'},
    xerneas:{group:'Pokémon · Kalos / Z-A',body:'#597ab6',energy:'#73e3d1',detail:'#e26b6b'},
    yveltal:{group:'Pokémon · Kalos / Z-A',body:'#e73725',energy:'#252a35',detail:'#eff1f5'},
    zygarde:{group:'Pokémon · Kalos / Z-A',body:'#373a30',energy:'#a7db3d',detail:'#5fd7d7'},
    solgaleo:{group:'Pokémon · Alola',body:'#f8f7ef',energy:'#e8b945',detail:'#d75135'},
    lunala:{group:'Pokémon · Alola',body:'#3b2c7b',energy:'#dc62e4',detail:'#d6c771'},
    ultranecrozma:{group:'Pokémon · Alola',body:'#fff2a3',energy:'#5ed7ff',detail:'#e85fc3'},
    zacian:{group:'Pokémon · Galar',body:'#4687c2',energy:'#e1b951',detail:'#d28d7b'},
    zamazenta:{group:'Pokémon · Galar',body:'#ac3f45',energy:'#e1b446',detail:'#2f416f'},
    eternatus:{group:'Pokémon · Galar',body:'#3c2756',energy:'#ff2f92',detail:'#56d6e5'},
    koraidon:{group:'Pokémon · Paldea',body:'#e94841',energy:'#1680cf',detail:'#f5efe7'},
    miraidon:{group:'Pokémon · Paldea',body:'#37328a',energy:'#f9ef80',detail:'#7edcf1'},
    terapagos:{group:'Pokémon · Paldea',body:'#67bda9',energy:'#8070dc',detail:'#f0f7ff'}
  };
  const LEGENDARY_KEYS=new Set(Object.keys(LEGENDARY_META));
  const THEME_GROUP_ORDER=[
    'Calendar','Pokémon · Versions','Pokémon · Johto','Pokémon · Hoenn',
    'Pokémon · Hoenn Shiny','Pokémon · Sinnoh','Pokémon · Unova',
    'Pokémon · Kalos / Z-A','Pokémon · Alola','Pokémon · Galar',
    'Pokémon · Paldea','Gems & Minerals','DS & 3DS','Signature'
  ];
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
    gold:['#171003','#573905','#f5c84c','#fff3bd'],
    silver:['#0d121a','#344150','#cbd5e1','#f8fafc'],
    ruby:['#240a08','#8f382e','#e84e30','#fff1ec'],
    sapphire:['#041827','#1a3351','#0388bf','#edf8ff'],
    emerald:['#061b12','#336e69','#00a64f','#f4f8dc'],
    amethyst:['#160725','#4c1d95','#c084fc','#faf5ff'],
    diamond:['#071723','#28536a','#a5f3fc','#ffffff'],
    pearl:['#1b141b','#6b5665','#f0bfd5','#fff7fa'],
    platinum:['#15140d','#57533d','#ded18f','#fffced'],
    opal:['#171226','#315e6d','#f9a8d4','#f0fdff'],
    topaz:['#211205','#854d0e','#f59e0b','#fff7d6'],
    jade:['#061d17','#176b51','#6ee7b7','#edfff8'],
    obsidian:['#030308','#1c1628','#8b5cf6','#f5f3ff'],
    crimsonblack:['#050609','#3b0b14','#c51f36','#f7f5f4'],
    cobaltblack:['#04070e','#10245b','#315fc4','#f2f6ff'],
    metallicrose:['#180d15','#6f3651','#d58aaa','#fff2f7'],
    bronzexl:['#15110c','#59432f','#a7835f','#f8ead7'],
    blackwhitedsi:['#050608','#3c4147','#e8ecec','#ffffff'],
    galaxystyle:['#050821','#193b8a','#c451d5','#f1f4ff'],
    superfamicom:['#17171c','#575762','#9b85c5','#f7f6f2'],
    hooh:['#1c0806','#713025','#f2b13d','#fff0df'],
    lugia:['#080c1c','#38436d','#6fa7ff','#f3f6ff'],
    suicune:['#07171d','#356f78','#a26bc2','#effcff'],
    groudon:['#230605','#8e231c','#00d9ff','#fff0ea'],
    kyogre:['#03152b','#07579a','#ff315f','#edf7ff'],
    rayquaza:['#04180f','#24754c','#f2cf3f','#efffe9'],
    shinyprimalgroudon:['#070706','#292724','#fff0b5','#fffaf0'],
    shinyprimalkyogre:['#04060a','#20232a','#f3dc54','#f5f8ff'],
    shinymegarayquaza:['#050505','#41231f','#ffb63d','#fff2e6'],
    dialga:['#071322','#2f4d74','#7cd9e8','#effbff'],
    palkia:['#160c1c','#665467','#e88bc1','#fff4fb'],
    giratina:['#120e0a','#4e4640','#e2c451','#fff6e4'],
    arceus:['#121317','#5a6471','#c8ae52','#ffffff'],
    reshiram:['#121418','#596677','#ff8450','#ffffff'],
    zekrom:['#040609','#20272a','#35d5e6','#efffff'],
    blackkyurem:['#05070a','#343a3d','#35b8e8','#f3f7f8'],
    whitekyurem:['#171412','#635d55','#ff7048','#fffdf8'],
    xerneas:['#07101b','#385785','#73e3d1','#fff7e8'],
    yveltal:['#1d0607','#71221f','#ff4b3d','#fff0ed'],
    zygarde:['#080b07','#343c29','#a7db3d','#f7ffe5'],
    solgaleo:['#15120c','#6b5941','#e8b945','#fffdf3'],
    lunala:['#08061b','#3a2a72','#dc62e4','#f4efff'],
    ultranecrozma:['#171306','#716229','#5ed7ff','#fffde8'],
    zacian:['#061526','#245a87','#e1b951','#eff9ff'],
    zamazenta:['#21090c','#7a2830','#e1b446','#fff0ec'],
    eternatus:['#080514','#351743','#ff2f92','#fcecff'],
    koraidon:['#24080a','#7f2930','#1680cf','#fff0e9'],
    miraidon:['#0a071f','#352d78','#f9ef80','#f2f2ff'],
    terapagos:['#051b1a','#326d68','#8070dc','#f1ffff'],
    sunrise:['#1f1307','#9a3412','#fbbf24','#fff7ed']
  };
  const themeLabels={
    spring:'Spring',summer:'Summer',autumn:'Autumn',winter:'Winter',
    newyear:'New Year',valentine:'Valentine',stpatrick:'St. Patrick',easter:'Easter',
    independence:'Independence',halloween:'Halloween',thanksgiving:'Thanksgiving',christmas:'Christmas',
    midnight:'Midnight',aurora:'Aurora',sakura:'Sakura',ocean:'Ocean',ember:'Ember',
    royal:'Royal',cyber:'Cyber',forest:'Forest',cosmic:'Cosmic',quartz:'Quartz',
    gold:'Gold',silver:'Silver',ruby:'Ruby',sapphire:'Sapphire',emerald:'Emerald',
    amethyst:'Amethyst',diamond:'Diamond',pearl:'Pearl',platinum:'Platinum',opal:'Opal',topaz:'Topaz',jade:'Jade',obsidian:'Obsidian',
    crimsonblack:'DS Lite · Crimson/Black',cobaltblack:'DS Lite · Cobalt/Black',
    metallicrose:'DSi XL · Metallic Rose',bronzexl:'DSi XL · Bronze',
    blackwhitedsi:'Pokémon Black & White DSi',galaxystyle:'New 3DS XL · Galaxy',
    superfamicom:'New 3DS · Super Famicom',
    hooh:'Ho-Oh',lugia:'Lugia',suicune:'Suicune',
    groudon:'Groudon',kyogre:'Kyogre',rayquaza:'Rayquaza',
    shinyprimalgroudon:'Shiny Primal Groudon',shinyprimalkyogre:'Shiny Primal Kyogre',
    shinymegarayquaza:'Shiny Mega Rayquaza',
    dialga:'Dialga',palkia:'Palkia',giratina:'Giratina',arceus:'Arceus',
    reshiram:'Reshiram',zekrom:'Zekrom',blackkyurem:'Black Kyurem',whitekyurem:'White Kyurem',
    xerneas:'Xerneas',yveltal:'Yveltal',zygarde:'Zygarde',
    solgaleo:'Solgaleo',lunala:'Lunala',ultranecrozma:'Ultra Necrozma',
    zacian:'Zacian',zamazenta:'Zamazenta',eternatus:'Eternatus',
    koraidon:'Koraidon',miraidon:'Miraidon',terapagos:'Terapagos',
    sunrise:'Sunrise'
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
    const seasonKey=SEASON_KEYS.has(key)?key:season(now.month,now.day);
    const holidayKey=HOLIDAY_KEYS.has(key)?key:'';
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
    const legendary=LEGENDARY_META[key]||null;
    const material=legendary?'legendary':(GEM_KEYS.has(key)?'gem':'standard');
    const group=legendary?.group||(POKEMON_KEYS.has(key)?'Pokémon · Versions':(GEM_KEYS.has(key)?'Gems & Minerals':(HANDHELD_KEYS.has(key)?'DS & 3DS':(SEASON_KEYS.has(key)||HOLIDAY_KEYS.has(key)?'Calendar':'Signature'))));
    return {
      key,
      label:themeLabels[key]||String(key||'Theme').replace(/(^|[-_])\w/g,s=>s.replace(/[-_]/,'').toUpperCase()),
      material,
      group,
      bg:colors[0],
      surface:colors[1],
      secondary:colors[1],
      accent,
      ink:colors[3],
      legendaryBody:legendary?.body||colors[1],
      legendaryEnergy:legendary?.energy||accent,
      legendaryDetail:legendary?.detail||colors[3],
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
  function installMaterialStyles(){
    if(document.getElementById('evertale-material-theme-style'))return;
    const style=document.createElement('style');
    style.id='evertale-material-theme-style';
    style.textContent=`
      @property --evertale-legendary-outline{
        syntax:'<color>';
        inherits:true;
        initial-value:#ffffff;
      }
      @keyframes evertale-gem-sheen{
        0%{background-position:180% 0,0 0,0 0,0 0;}
        50%{background-position:45% 0,0 0,0 0,0 0;}
        100%{background-position:-85% 0,0 0,0 0,0 0;}
      }
      @keyframes evertale-legendary-outline-pulse{
        0%,100%{--evertale-legendary-outline:var(--legendary-energy);}
        50%{--evertale-legendary-outline:color-mix(in srgb,var(--legendary-energy) 82%,#05070c);}
      }
      @keyframes evertale-legendary-aura{
        0%,100%{background-position:0% 0%,100% 0%,0 0,0 0;}
        50%{background-position:24% 10%,76% 16%,100% 0,0 0;}
      }
      html[data-theme-material="gem"] body,
      html[data-theme-material="gem"] body.page-catalog-v2,
      html[data-theme-material="gem"] body.page-roster-v2,
      html[data-theme-material="gem"] body.page-optimizer,
      html[data-theme-material="gem"] body.page-optimizer-v2{
        background:
          linear-gradient(112deg,transparent 0 38%,rgba(255,255,255,0) 43%,rgba(255,255,255,.13) 48%,rgba(var(--site-theme-rgb),.20) 52%,rgba(255,255,255,0) 59%,transparent 100%),
          radial-gradient(circle at 7% 4%,rgba(var(--site-theme-rgb),.28),transparent 31%),
          radial-gradient(circle at 92% 7%,color-mix(in srgb,var(--site-theme-secondary) 24%,transparent),transparent 29%),
          linear-gradient(180deg,color-mix(in srgb,var(--site-theme-bg) 82%,#03050a) 0%,color-mix(in srgb,var(--site-theme-surface) 58%,#060812) 48%,#030309 100%)!important;
        background-size:260% 100%,100% 100%,100% 100%,100% 100%!important;
        background-attachment:fixed!important;
        animation:evertale-gem-sheen 18s ease-in-out infinite!important;
      }
      html[data-theme-material="legendary"]{
        animation:evertale-legendary-outline-pulse 6.4s ease-in-out infinite!important;
      }
      html[data-theme-material="legendary"] body,
      html[data-theme-material="legendary"] body.page-catalog-v2,
      html[data-theme-material="legendary"] body.page-roster-v2,
      html[data-theme-material="legendary"] body.page-optimizer,
      html[data-theme-material="legendary"] body.page-optimizer-v2{
        background:
          radial-gradient(circle at 10% 3%,rgba(var(--legendary-body-rgb),.32),transparent 32%),
          radial-gradient(circle at 90% 6%,rgba(var(--legendary-energy-rgb),.27),transparent 30%),
          linear-gradient(118deg,rgba(var(--legendary-body-rgb),.10),transparent 38%,rgba(var(--legendary-energy-rgb),.13) 62%,transparent 84%),
          linear-gradient(180deg,color-mix(in srgb,var(--site-theme-bg) 84%,#020409) 0%,color-mix(in srgb,var(--site-theme-surface) 54%,#050711) 48%,#020308 100%)!important;
        background-size:120% 120%,120% 120%,220% 100%,100% 100%!important;
        background-attachment:fixed!important;
        animation:evertale-legendary-aura 11s ease-in-out infinite!important;
      }
      html[data-theme-material="legendary"] :is(.v2-panel,.v2-grid-panel,.v2-detail-panel,.v2-card-skill-panel){
        background:
          linear-gradient(142deg,rgba(var(--legendary-body-rgb),.16),transparent 36%,rgba(var(--legendary-energy-rgb),.09) 72%),
          linear-gradient(180deg,color-mix(in srgb,var(--site-theme-bg) 70%,#03050b),color-mix(in srgb,var(--site-theme-surface) 28%,#050712))!important;
        border-color:var(--evertale-legendary-outline)!important;
        box-shadow:0 14px 34px rgba(0,0,0,.38),0 0 18px color-mix(in srgb,var(--evertale-legendary-outline) 22%,transparent)!important;
      }
      html[data-theme-material="legendary"] body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-main .v2-hero .v2-filter-panel{
        background:
          linear-gradient(142deg,rgba(var(--legendary-body-rgb),.16),transparent 36%,rgba(var(--legendary-energy-rgb),.09) 72%),
          linear-gradient(180deg,color-mix(in srgb,var(--site-theme-bg) 70%,#03050b),color-mix(in srgb,var(--site-theme-surface) 28%,#050712))!important;
        border-color:var(--evertale-legendary-outline)!important;
        box-shadow:0 14px 34px rgba(0,0,0,.38),0 0 18px color-mix(in srgb,var(--evertale-legendary-outline) 22%,transparent)!important;
      }
      html[data-theme-material="legendary"] :is(.v2-grid-head h2,.v2-filter-title,.v2-detail-title){
        color:var(--legendary-detail)!important;
        text-shadow:0 0 14px rgba(var(--legendary-detail-rgb),.32)!important;
      }
      html[data-theme-material="legendary"] body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-main .v2-hero .v2-filter-panel .v2-filter-title{
        color:var(--legendary-detail)!important;
        text-shadow:0 0 14px rgba(var(--legendary-detail-rgb),.32)!important;
      }
      html[data-theme-material="legendary"] .v2-filter-panel :is(input,select){
        background:color-mix(in srgb,var(--site-theme-bg) 54%,#070a14)!important;
        border-color:color-mix(in srgb,var(--evertale-legendary-outline) 48%,#374057)!important;
      }
      @media (prefers-reduced-motion:reduce){
        html[data-theme-material="gem"] body{animation:none!important;background-position:45% 0,0 0,0 0,0 0!important;}
        html[data-theme-material="legendary"]{animation:none!important;--evertale-legendary-outline:var(--legendary-energy)!important;}
        html[data-theme-material="legendary"] body{animation:none!important;background-position:12% 4%,88% 6%,50% 0,0 0!important;}
      }
    `;
    document.head.appendChild(style);
  }
  function applyTheme(){
    installMaterialStyles();
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
    const legendaryBody=cfg.legendaryBody||cfg.surface;
    const legendaryEnergy=cfg.legendaryEnergy||accent;
    const legendaryDetail=cfg.legendaryDetail||ink;
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
    setVar(root,'--legendary-body',legendaryBody);
    setVar(root,'--legendary-energy',legendaryEnergy);
    setVar(root,'--legendary-detail',legendaryDetail);
    setVar(root,'--legendary-body-rgb',hexToRgb(legendaryBody));
    setVar(root,'--legendary-energy-rgb',hexToRgb(legendaryEnergy));
    setVar(root,'--legendary-detail-rgb',hexToRgb(legendaryDetail));
    setVar(root,'--evertale-legendary-outline',legendaryEnergy);
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
    root.setAttribute('data-theme-material',cfg.material);
    if(document.body){
      document.body.setAttribute('data-theme-key',key);
      document.body.setAttribute('data-theme-label',cfg.label);
      document.body.setAttribute('data-theme-pref',requested);
      document.body.setAttribute('data-theme-mode',cfg.mode);
      document.body.setAttribute('data-theme-season',cfg.season);
      document.body.setAttribute('data-theme-holiday',cfg.holiday);
      document.body.setAttribute('data-theme-material',cfg.material);
    }
    syncThemeLinks();
    observeThemeLinks();
    try{
      document.dispatchEvent(new CustomEvent('evertale:theme-applied',{detail:{...cfg}}));
    }catch{}
  }
  window.EvertaleTheme={
    themes,
    groupOrder:[...THEME_GROUP_ORDER],
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
