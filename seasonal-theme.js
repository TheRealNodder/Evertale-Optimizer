(function(){
  const TZ='America/Los_Angeles';
  const KEY='evertale_theme_pref_v1';
  const AUTO='auto';
  const SEASON_KEYS=new Set(['spring','summer','autumn','winter']);
  const HOLIDAY_KEYS=new Set(['newyear','valentine','stpatrick','easter','independence','halloween','thanksgiving','christmas']);
  const GEM_KEYS=new Set(['gold','silver','ruby','sapphire','emerald','amethyst','diamond','pearl','platinum','opal','topaz','jade','obsidian','quartz']);
  const POKEMON_KEYS=new Set(['gold','silver','ruby','sapphire','emerald','diamond','pearl','platinum']);
  const HANDHELD_META={
    crimsonblack:{effect:'ds-lite',finish:'gloss-crimson',hardware:'ds-lite',aura:'Gloss crimson lid over a matte black body'},
    cobaltblack:{effect:'ds-lite',finish:'gloss-cobalt',hardware:'ds-lite',aura:'Gloss cobalt lid over a matte black body'},
    metallicrose:{effect:'dsi-xl',finish:'metallic-rose',hardware:'dsi-xl',aura:'Metallic pink shell with a luminous modern sheen'},
    bronzexl:{effect:'dsi-xl',finish:'bronze',hardware:'dsi-xl',aura:'Dark bronze upper shell with a warm matte base'},
    blackwhitedsi:{effect:'dsi-split',finish:'black-white',hardware:'dsi',aura:'Paired black and white DSi edition shells with restrained dual-dragon traces'},
    galaxystyle:{effect:'galaxy-shell',finish:'galaxy',hardware:'new-3ds-xl',aura:'Deep navy and violet galaxy lid over a black inner shell'},
    superfamicom:{effect:'super-famicom',finish:'warm-plastic',hardware:'new-3ds-ll',aura:'Warm grey hardware with the four Super Famicom button colors'}
  };
  const HANDHELD_KEYS=new Set(Object.keys(HANDHELD_META));
  const LEGENDARY_META={
    hooh:{group:'Pokémon · Johto',body:'#d84a32',energy:'#f6c94e',detail:'#32a976',effect:'rebirth',aura:'Prismatic feather arcs and a warm rekindling pulse'},
    lugia:{group:'Pokémon · Johto',body:'#eef4f5',energy:'#4e88c3',detail:'#80d7e5',effect:'abyss-wind',aura:'Deep-water caustics and broad atmospheric pressure waves'},
    suicune:{group:'Pokémon · Johto',body:'#315fb8',energy:'#8ce8f1',detail:'#7658c9',effect:'aurora-water',aura:'North-wind ribbons and clear purification ripples'},
    groudon:{group:'Pokémon · Hoenn',body:'#a62d29',energy:'#e0b34b',detail:'#c99736',effect:'magma',aura:'Fault lines, ground heat, and drought pressure'},
    kyogre:{group:'Pokémon · Hoenn',body:'#125aa2',energy:'#8ddff0',detail:'#e9f7fb',effect:'ocean-pressure',aura:'Rain bands, ocean pressure rings, and underwater caustics'},
    rayquaza:{group:'Pokémon · Hoenn',body:'#168657',energy:'#e6c14b',detail:'#b42e35',effect:'delta-stream',aura:'High-altitude streams, ozone currents, and sparse meteors'},
    shinyprimalgroudon:{group:'Pokémon · Hoenn Shiny',body:'#241313',energy:'#ffd45a',detail:'#f05a24',effect:'magma',aura:'Molten fissures, convection, and harsh solar pressure'},
    shinyprimalkyogre:{group:'Pokémon · Hoenn Shiny',body:'#531442',energy:'#32e3ee',detail:'#f4faff',effect:'ocean-pressure',aura:'Magenta primal body light, cyan lines, heavy rain, and broad ocean swells'},
    shinymegarayquaza:{group:'Pokémon · Hoenn Shiny',body:'#080a09',energy:'#ffd84b',detail:'#e33d37',effect:'delta-stream',aura:'Black form, gold tendrils, red trim, and a controlled high-altitude vortex'},
    dialga:{group:'Pokémon · Sinnoh',body:'#476f9a',energy:'#78d8e8',detail:'#c8d6df',effect:'time-rings',aura:'Concentric temporal rings and stepped time scans'},
    palkia:{group:'Pokémon · Sinnoh',body:'#f0ecec',energy:'#d17ba7',detail:'#9175c5',effect:'space-rift',aura:'Parallax planes and a subtle spatial seam'},
    giratina:{group:'Pokémon · Sinnoh',body:'#17151b',energy:'#c79a38',detail:'#a82837',effect:'distortion',aura:'Reverse-falling particles and folded broken planes'},
    arceus:{group:'Pokémon · Sinnoh',body:'#f2f0e4',energy:'#d6b64a',detail:'#ffffff',effect:'creation',aura:'Ordered cosmic rings and a calm creation halo'},
    reshiram:{group:'Pokémon · Unova',body:'#f2f0e8',energy:'#f17b45',detail:'#bfe8f3',effect:'white-flame',aura:'Atmospheric convection and a white-hot turbine spiral'},
    zekrom:{group:'Pokémon · Unova',body:'#11151b',energy:'#41d2e5',detail:'#2879c8',effect:'thunder-generator',aura:'Cloud pressure and a restrained electric generator pulse'},
    blackkyurem:{group:'Pokémon · Unova',body:'#1d242c',energy:'#87e6f3',detail:'#398dde',effect:'freeze-shock',aura:'Electric bridges through angular frozen structures'},
    whitekyurem:{group:'Pokémon · Unova',body:'#e9f4f3',energy:'#f07a3e',detail:'#89ddeb',effect:'ice-burn',aura:'Warm light moving beneath cold crystalline layers'},
    xerneas:{group:'Pokémon · Kalos / Z-A',body:'#13213c',energy:'#73e3d1',detail:'#d0aa42',effect:'life-antlers',aura:'Structured antler light rising from root-like lines'},
    yveltal:{group:'Pokémon · Kalos / Z-A',body:'#a92232',energy:'#101014',detail:'#d2cbd0',effect:'cocoon-drain',aura:'Particles drawn inward toward a wing-shaped shadow'},
    zygarde:{group:'Pokémon · Kalos / Z-A',body:'#101414',energy:'#74d84d',detail:'#d33b42',effect:'cell-grid',aura:'Cells assembling on a corrective hex grid'},
    solgaleo:{group:'Pokémon · Alola',body:'#f5f3e9',energy:'#f3c445',detail:'#67bfd7',effect:'solar-corona',aura:'A breathing solar corona and clean radiant flare'},
    lunala:{group:'Pokémon · Alola',body:'#111637',energy:'#b847a4',detail:'#4cc7d7',effect:'lunar-phase',aura:'Moon halo, constellation edges, and slow phase breathing'},
    ultranecrozma:{group:'Pokémon · Alola',body:'#fff2a4',energy:'#58d9e9',detail:'#f9d834',effect:'prism-rays',aura:'Hard-edged refraction from brilliant crystalline facets'},
    zacian:{group:'Pokémon · Galar',body:'#4ebccb',energy:'#e8be4d',detail:'#b44985',effect:'blade-trail',aura:'Poised directional streaks and a single clean blade trail'},
    zamazenta:{group:'Pokémon · Galar',body:'#b12e3d',energy:'#ddb94e',detail:'#5db9c9',effect:'shield-wave',aura:'Stable shield geometry and a rebounding pressure wave'},
    eternatus:{group:'Pokémon · Galar',body:'#090b18',energy:'#cb2c79',detail:'#5acad7',effect:'dynamax-core',aura:'Skeletal radial limbs around a controlled energy core'},
    koraidon:{group:'Pokémon · Paldea',body:'#c83e35',energy:'#e65c37',detail:'#e8d5b5',effect:'ancient-pulse',aura:'Organic rhythm, sunlight, and grounded dust pulses'},
    miraidon:{group:'Pokémon · Paldea',body:'#6b4acb',energy:'#43d8e4',detail:'#d9e655',effect:'future-grid',aura:'Smooth hover energy, plasma rings, and an electric terrain grid'},
    terapagos:{group:'Pokémon · Paldea',body:'#42c9c5',energy:'#8070dc',detail:'#ebffff',effect:'stellar-crystal',aura:'Crystal tessellation and slow stellar refraction'}
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
    crimsonblack:['#050609','#361017','#c63d48','#f7f5f4'],
    cobaltblack:['#04070e','#132551','#315ea4','#f2f6ff'],
    metallicrose:['#180d15','#6b3a50','#d69bad','#fff2f7'],
    bronzexl:['#15110c','#4b3027','#a67850','#e9decb'],
    blackwhitedsi:['#090a0c','#27292d','#aeb3b8','#f4f3ef'],
    galaxystyle:['#050617','#161b57','#a84c9a','#f1f4ff'],
    superfamicom:['#202024','#4d4d52','#c94238','#f7f3e9'],
    hooh:['#1c0806','#713025','#f2b13d','#fff0df'],
    lugia:['#080c1c','#38436d','#6fa7ff','#f3f6ff'],
    suicune:['#07171d','#356f78','#a26bc2','#effcff'],
    groudon:['#230605','#8e231c','#e0b34b','#fff0ea'],
    kyogre:['#03152b','#07579a','#8ddff0','#edf7ff'],
    rayquaza:['#04180f','#24754c','#f2cf3f','#efffe9'],
    shinyprimalgroudon:['#070706','#292724','#fff0b5','#fffaf0'],
    shinyprimalkyogre:['#09030c','#4a123f','#32e3ee','#fff5fb'],
    shinymegarayquaza:['#050505','#1e1715','#ffd84b','#fff2e6'],
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
    blackwhitedsi:'DSi · Pokémon Black / White Editions',galaxystyle:'New 3DS XL · Galaxy',
    superfamicom:'New 3DS LL · Super Famicom',
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
    const legendary=LEGENDARY_META[key]||null;
    const handheld=HANDHELD_META[key]||null;
    const accent=displayAccents[key]||legendary?.energy||colors[2];
    const material=legendary?'legendary':(handheld?'handheld':(GEM_KEYS.has(key)?'gem':'standard'));
    const group=legendary?.group||(POKEMON_KEYS.has(key)?'Pokémon · Versions':(GEM_KEYS.has(key)?'Gems & Minerals':(HANDHELD_KEYS.has(key)?'DS & 3DS':(SEASON_KEYS.has(key)||HOLIDAY_KEYS.has(key)?'Calendar':'Signature'))));
    return {
      key,
      label:themeLabels[key]||String(key||'Theme').replace(/(^|[-_])\w/g,s=>s.replace(/[-_]/,'').toUpperCase()),
      material,
      group,
      effect:legendary?.effect||handheld?.effect||'',
      finish:handheld?.finish||'',
      hardware:handheld?.hardware||'',
      aura:legendary?.aura||handheld?.aura||'',
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
  function ensureEffectLayer(){
    if(!document.body)return null;
    let layer=document.getElementById('siteThemeFx');
    if(layer)return layer;
    layer=document.createElement('div');
    layer.id='siteThemeFx';
    layer.className='siteThemeFx';
    layer.setAttribute('aria-hidden','true');
    const field=document.createElement('div');
    const particles=document.createElement('div');
    field.className='siteThemeFx__field';
    particles.className='siteThemeFx__particles';
    layer.append(field,particles);
    document.body.insertBefore(layer,document.body.firstChild);
    return layer;
  }
  function syncThemeMotion(){
    const value=document.hidden?'paused':'running';
    document.documentElement.setAttribute('data-theme-motion',value);
    if(document.body)document.body.setAttribute('data-theme-motion',value);
  }
  function applyTheme(){
    ensureEffectLayer();
    syncThemeMotion();
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
    root.setAttribute('data-theme-family',cfg.material);
    root.setAttribute('data-theme-effect',cfg.effect||'');
    root.setAttribute('data-theme-finish',cfg.finish||'');
    root.setAttribute('data-theme-hardware',cfg.hardware||'');
    if(document.body){
      document.body.setAttribute('data-theme-key',key);
      document.body.setAttribute('data-theme-label',cfg.label);
      document.body.setAttribute('data-theme-pref',requested);
      document.body.setAttribute('data-theme-mode',cfg.mode);
      document.body.setAttribute('data-theme-season',cfg.season);
      document.body.setAttribute('data-theme-holiday',cfg.holiday);
      document.body.setAttribute('data-theme-material',cfg.material);
      document.body.setAttribute('data-theme-family',cfg.material);
      document.body.setAttribute('data-theme-effect',cfg.effect||'');
      document.body.setAttribute('data-theme-finish',cfg.finish||'');
      document.body.setAttribute('data-theme-hardware',cfg.hardware||'');
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
  document.addEventListener('visibilitychange',()=>{syncThemeMotion();if(!document.hidden&&pref()===AUTO)applyTheme();});
  setInterval(()=>{if(pref()===AUTO)applyTheme();},30*60*1000);
})();
