/* One reusable decorative stage. Theme data and keyframes are built offline.
   CSS owns movement; there is no render loop, polling, or application data. */
(function(g,d){
  'use strict';
  const profiles=g.EvertaleMotionProfiles;
  if(!profiles||!g.EvertaleTheme)return;
  const assetBase=new URL('.',d.currentScript?.src||new URL('theme-motion.js',d.baseURI||g.location.href).href);
  const mobile=g.matchMedia?.('(max-width:480px)');
  const density=g.matchMedia?.('(max-width:700px)');
  const technology=Object.freeze(['miraidon','cyber','crimsonblack','cobaltblack','metallicrose','bronzexl','blackwhitedsi','galaxystyle','superfamicom']);
  let scene=null,active='',artNode=null,particles=null,particleKey='',moduleHost=null;
  /* Sixteen shared primitives, authored geometry and per-theme events. Counts include
     separately animated children; mobile keeps the signature before its atmosphere. */
  function part(type,shape,count,phone,duration,size,region='edges'){
    return Object.freeze({type,shape,count,phone,duration,size,region});
  }
  const P=part;
  const SIGNATURES={
    thunderwake:[P('arc','storm',1,1,8,160)],
    spring:[P('fall','petal',16,6,13,12),P('burst','flower',3,1,22,64)],
    summer:[P('heat','sunbeam',3,1,19,110,'top'),P('glint','droplet',8,3,10,7)],
    autumn:[P('fall','leaf',18,7,13,16),P('gust','leaf',3,1,21,75)],
    winter:[P('fall','snow',20,8,16,7),P('prism','frost',2,1,25,90)],
    newyear:[P('burst','firework',4,1,18,100,'top'),P('fall','confetti',12,5,11,9)],
    valentine:[P('rise','heart',10,4,14,12),P('orbit','ribbon',3,1,20,70)],
    stpatrick:[P('fall','clover',14,6,14,15),P('prism','gold',2,1,20,65)],
    easter:[P('fall','blossom',14,6,14,13),P('burst','flower',3,1,22,54)],
    independence:[P('burst','firework',5,2,20,110,'top'),P('glint','star',6,2,10,7)],
    halloween:[P('swell','fog',3,1,24,160),P('heat','lantern',4,2,19,20)],
    thanksgiving:[P('fall','leaf',14,6,15,17),P('gust','wheat',3,1,24,85)],
    christmas:[P('fall','snow',18,7,16,7),P('glint','light',6,2,12,6)],
    midnight:[P('glint','star',12,5,8,5,'top'),P('ripple','water',3,1,18,100)],
    aurora:[P('swell','aurora',4,2,23,190,'top'),P('glint','star',6,2,14,4,'top')],
    sakura:[P('fall','blossom',20,8,14,14),P('gust','ribbon',3,1,22,100)],
    ocean:[P('swell','wave',4,2,20,170),P('ripple','foam',3,1,14,105)],
    ember:[P('rise','ember',14,6,11,6),P('heat','coal',2,1,18,60)],
    royal:[P('prism','gold',4,2,22,105),P('ripple','water',3,1,16,70)],
    cyber:[P('arc','electric',2,1,8,160)],
    forest:[P('fall','leaf',10,4,17,11),P('glint','seed',8,3,12,5)],
    cosmic:[P('orbit','star',6,2,26,14,'top'),P('swell','nebula',3,1,24,145)],
    sunrise:[P('heat','sunbeam',3,1,22,140,'top'),P('burst','sun',3,1,26,95,'top')],
    /* Version identities are journeys through their regions, not mineral finishes. */
    gold:[P('swell','sunlight',2,1,18,110,'top'),P('gust','leaf',4,2,13,35)],
    silver:[P('swell','fog',2,1,18,160),P('ripple','water',2,1,12,90)],
    ruby:[P('gust','dust',5,2,12,35),P('swell','terrain',2,1,18,150)],
    sapphire:[P('swell','wave',3,1,18,145),P('ripple','foam',2,1,12,75)],
    emerald:[P('swell','corridor',3,1,18,150),P('gust','leaf',4,2,12,45)],
    diamond:[P('fall','snow',6,3,14,6),P('prism','frost',2,1,18,90)],
    pearl:[P('ripple','water',3,1,16,90),P('swell','reflection',2,1,20,145)],
    platinum:[P('swell','fog',2,1,22,130),P('fall','snow',4,2,15,7)],
    quartz:[P('prism','crystal',5,2,21,105),P('glint','facet',4,2,18,8)],
    opal:[P('prism','opal',5,2,20,80),P('glint','soft',4,2,15,10)],
    topaz:[P('prism','facet',4,2,19,100),P('heat','amber',2,1,20,55)],
    jade:[P('prism','jade',3,1,25,120),P('ripple','water',3,1,20,65)],
    obsidian:[P('prism','fracture',4,2,24,130),P('heat','coal',2,1,24,30)],
    amethyst:[P('prism','cluster',5,2,22,90),P('glint','facet',5,2,16,7)],
    crimsonblack:[P('prism','shell',2,1,20,80)],
    cobaltblack:[P('gust','reflection',2,1,20,85)],
    metallicrose:[P('prism','rose',2,1,22,105)],
    bronzexl:[P('prism','bronze',2,1,25,115)],
    blackwhitedsi:[P('prism','split',2,1,18,90)],
    galaxystyle:[P('glint','star',7,3,12,5,'top')],
    superfamicom:[P('glint','button',4,2,22,9)],
    hooh:[P('burst','feather',5,2,18,85,'top'),P('rise','feather',8,3,13,24)],
    lugia:[P('swell','pressure',3,1,22,175),P('gust','wing',5,2,9,145)],
    suicune:[P('swell','cleansing',3,1,12,130),P('swell','aurora',2,1,19,150)],
    groudon:[P('heat','fault',4,2,15,120),P('burst','fissure',3,1,20,90)],
    kyogre:[P('swell','wave',4,2,22,170),P('fall','rain',14,6,11,22)],
    rayquaza:[P('gust','serpent',7,3,8,165),P('orbit','air',3,1,18,75,'top')],
    shinyprimalgroudon:[P('heat','magma',5,2,12,145),P('burst','fissure',4,1,18,105)],
    shinyprimalkyogre:[P('swell','pressure',4,2,22,180),P('prism','primal',3,1,18,100)],
    shinymegarayquaza:[P('gust','tendril',7,3,12,190),P('burst','ray',4,1,20,115,'top')],
    dialga:[P('swell','terrace',3,1,20,100),P('clock','ticks',1,1,24,80,'top')],
    palkia:[P('rift','space',2,1,18,140),P('orbit','pearl',4,2,14,14)],
    giratina:[P('invert','shard',10,4,14,30),P('rift','fold',2,1,21,100)],
    arceus:[P('heat','stair',3,1,24,110,'top'),P('invert','order',5,2,24,8,'top')],
    reshiram:[P('heat','turbine',3,1,16,95),P('rise','flame',10,4,11,22)],
    zekrom:[P('trace','generator',3,1,8,160,'charge'),P('arc','generator',3,1,8,160,'charge')],
    blackkyurem:[P('arc','ice',3,1,8,160),P('fall','ice',10,4,14,17)],
    whitekyurem:[P('heat','iceheat',4,2,16,90),P('rise','steam',7,3,14,32)],
    xerneas:[P('burst','antler',5,2,20,110,'top'),P('glint','life',7,3,13,7)],
    yveltal:[P('invert','drain',10,4,16,24),P('heat','shadow',2,1,22,90)],
    zygarde:[],
    solgaleo:[P('heat','corona',3,1,18,125,'top'),P('burst','sun',4,2,22,105,'top')],
    lunala:[P('orbit','crescent',1,1,27,85,'top'),P('swell','moon-shadow',2,1,22,95,'top')],
    ultranecrozma:[P('prism','ray',5,2,16,125),P('burst','prism',4,1,22,110,'top')],
    zacian:[P('gust','blade',5,2,10,145),P('prism','blade',2,1,19,95)],
    zamazenta:[P('ripple','shield',4,2,15,95),P('gust','deflect',2,1,21,115)],
    eternatus:[P('heat','core',2,1,18,100),P('arc','energy',3,1,8,160)],
    koraidon:[P('gust','dust',6,3,12,55),P('swell','grass',3,1,16,90)],
    miraidon:[P('arc','junction',2,1,8,160,'charge')],
    terapagos:[P('prism','stellar',5,2,20,85,'top'),P('orbit','facet',4,2,24,20,'top')]
  };
  for(const value of Object.values(SIGNATURES))Object.freeze(value);
  Object.freeze(SIGNATURES);
  const ROUTES=[[[0,20],[48,20],[48,64],[104,64],[104,30],[154,30]],[[0,64],[36,64],[36,20],[98,20],[98,64],[154,64]],[[0,36],[62,36],[62,70],[122,70],[122,12],[154,12]]];
  const SVG_OPEN='<svg viewBox="-8 -8 176 100" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">';
  const TRACE_OPEN='<svg viewBox="0 0 160 90" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">';
  function clearModule(){
    if(!moduleHost)return;
    g.EvertaleMotherboard?.clear(moduleHost);g.EvertaleCells?.clear(moduleHost);
    moduleHost.remove();moduleHost=null;
  }
  function mountModule(key){
    const engine=technology.includes(key)?g.EvertaleMotherboard:key==='zygarde'?g.EvertaleCells:null;
    if(!engine)return;
    moduleHost=node('div','themeMotionModuleHost');moduleHost.setAttribute('data-engine',key==='zygarde'?'cells':'motherboard');
    particles.appendChild(moduleHost);engine.render(moduleHost,{key,mobile:!!density?.matches});
  }
  function seeded(key){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^(h>>>15),2246822507);h=Math.imul(h^(h>>>13),3266489909);return((h^=h>>>16)>>>0)/4294967296;};}
  function syncParticles(key){
    const parts=key&&SIGNATURES[key];
    if(!parts){clearModule();if(particles){particles.hidden=true;particles.replaceChildren();}particleKey='';return;}
    if(!particles){particles=node('div','themeMotionParticles');particles.id='themeMotionParticles';particles.setAttribute('aria-hidden','true');}
    if(particles.parentNode!==d.body)d.body.appendChild(particles);
    particles.hidden=false;
    const bucket=`${key}:${!!density?.matches}`;
    if(particleKey===bucket)return;
    clearModule();
    const rand=seeded(key),colors=['var(--site-theme-accent)','color-mix(in srgb,var(--site-theme-accent) 65%,var(--site-theme-ink))','var(--site-theme-ink)'],spans=[];
    parts.forEach((part,group)=>{
      for(let i=0;i<part.count;i++){
        const p=node('span','themeMotionParticle');
        p.setAttribute('data-primitive',part.type);p.setAttribute('data-shape',part.shape);p.setAttribute('data-mobile',String(i<part.phone));
        const x=4+rand()*90;
        const y=part.region==='top'?8+rand()*20:part.region==='charge'?18+i*19:8+rand()*80;
        const duration=['arc','clock'].includes(part.type)||part.region==='charge'||part.shape==='stellar'?part.duration:part.duration*(.9+rand()*.2);
        const phase=part.region==='charge'?-duration*.3:part.shape==='stellar'?-i*3:-rand()*duration;
        const vars={'--x':`${x.toFixed(2)}%`,'--y':`${y.toFixed(2)}vh`,'--mx':`${(4+rand()*84).toFixed(2)}%`,'--my':`${(8+rand()*80).toFixed(2)}vh`,
          '--s':`${(part.size*(.85+rand()*.3)).toFixed(1)}px`,'--d':`${duration.toFixed(2)}s`,'--delay':`${phase.toFixed(2)}s`,
          '--dx':`${((rand()-.5)*18).toFixed(2)}vw`,'--r':`${Math.round((rand()-.5)*120)}deg`,'--o':(.5+rand()*.2).toFixed(2),
          '--c':colors[(i+group)%3],'--direction':i%2?'-1':'1'};
        if(part.type==='trace'){
          const route=part.shape==='generator'?3:part.shape==='cell-link'?4:(i+key.length)%ROUTES.length;
          const points=route===3?[[0,60],[30,50],[55,22],[86,22],[116,50],[154,60]]:route===4?[[0,44],[26,0],[76,0],[102,44],[76,88],[26,88]]:ROUTES[route];
          p.setAttribute('data-route',String(route));
          p.innerHTML=TRACE_OPEN+`<path d="M${points.map(point=>point.join(' ')).join(' L')}"/>`+points.filter((_,index)=>index===0||index===2||index===4||index===5).map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.3"/>`).join('')+'</svg>';
          points.forEach(([x,y],index)=>{vars[`--p${index}x`]=`${x}px`;vars[`--p${index}y`]=`${y}px`;});
          p.appendChild(node('i','themeMotionPacket'));
        }else if(part.type==='hex'){
          p.innerHTML='<svg viewBox="-8 -8 64 56" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true"><path class="themeMotionCellA" d="M0 20 L12 0 H36 L48 20"/><path class="themeMotionCellB" d="M48 20 L36 40 H12 L0 20"/></svg>';
        }else if(part.type==='arc'){
          const ice=part.shape==='ice'?'<path class="themeMotionIce" d="M20 10 L44 4 L60 28 L48 74 L18 62 Z M100 8 L132 2 L150 34 L125 70 L104 56 Z"/>':'';
          p.innerHTML=SVG_OPEN+ice+'<path class="themeMotionArc" d="M0 46 L42 32 L28 56 L82 26"/><path class="themeMotionArc themeMotionArc--mid" d="M82 26 L68 52 L154 16"/><path class="themeMotionArc themeMotionArc--branch" d="M68 52 L84 72 L110 62"/></svg>';
        }else if(part.shape==='iceheat'){
          p.innerHTML=SVG_OPEN+'<path class="themeMotionIce" d="M24 4 L80 0 L135 26 L118 78 L40 85 L8 40 Z"/><path class="themeMotionWarm" d="M24 58 Q58 15 85 48 T139 24"/></svg>';
        }else if(['gust','swell','rift','heat','burst'].includes(part.type)){
          const shapes={
            gust:part.shape==='leaf'?'M10 70 Q20 0 120 12 Q154 68 60 78 Z M15 65 L125 17 M50 55 L44 30 M80 42 L90 62':part.shape==='blade'?'M0 65 L160 15 M30 75 L135 44':part.shape==='deflect'?'M0 42 H65 M65 42 Q100 12 155 3 M65 42 Q100 74 155 82':'M0 52 Q44 4 90 36 T160 25 M36 70 Q80 30 142 54',
            swell:part.shape==='grass'?'M12 85 Q25 50 10 14 M40 85 Q58 48 40 0 M72 85 Q90 60 83 18 M120 85 Q130 50 114 15 M145 85 Q158 50 147 30':'M0 46 Q30 8 62 42 T122 38 T160 26 M8 65 Q40 28 78 61 T152 52',
            rift:'M72 0 Q113 20 77 42 T87 85 M88 0 Q56 22 92 44 T84 85',
            heat:part.shape==='stair'?'M0 80 H40 V60 H80 V40 H120 V20 H160':part.shape==='core'?'M80 8 A34 34 0 1 1 79 8 M80 10 L80 0 M110 28 L150 8 M112 56 L155 80 M52 56 L8 80 M50 28 L8 4':part.shape==='sunbeam'?'M0 80 L70 0 M40 85 L105 0 M90 85 L150 0':part.shape==='corona'?'M80 5 A36 36 0 1 1 79 5 M80 0 V12 M130 42 H116 M80 85 V72 M28 42 H43':part.shape==='turbine'?'M80 42 Q118 0 132 30 T82 72 T35 22 T94 8':'M0 64 L25 47 L45 54 L65 27 L84 38 L115 10 L138 25 L160 2',
            burst:part.shape==='flower'?'M80 42 C40 20 60 0 80 20 C102 0 122 20 88 40 C132 30 145 60 100 58 C118 88 85 92 80 65 C48 92 27 76 62 54 C15 56 27 25 80 42 Z':part.shape==='fissure'?'M0 72 L38 56 L48 34 L79 40 L109 12 L145 20 M48 34 L40 10 M79 40 L98 70':part.shape==='antler'?'M80 85 V46 L44 18 M64 35 L62 8 M44 18 L22 22 M80 46 L120 18 M104 32 L102 5 M120 18 L145 24':'M80 40 L80 0 M80 40 L112 8 M80 40 L155 40 M80 40 L123 73 M80 40 L80 85 M80 40 L39 75 M80 40 L0 40 M80 40 L35 5'
          };
          const opening=part.type==='rift'?SVG_OPEN.replace('viewBox="-8 -8 176 100"','viewBox="50 -8 70 100" preserveAspectRatio="none"'):SVG_OPEN;
          p.innerHTML=opening+`<path d="${shapes[part.type]}"/></svg>`;
        }
        for(const[k,v]of Object.entries(vars))p.style.setProperty(k,v);
        spans.push(p);
      }
    });
    particles.setAttribute('data-scene-key',key);
    particles.replaceChildren(...spans);mountModule(key);particleKey=bucket;
  }
  function syncImage(){
    const profile=profiles[active];
    if(!artNode||!profile?.art)return;
    const src=new URL(mobile?.matches?profile.artMobile:profile.art,assetBase).href;
    if(artNode.getAttribute('src')!==src)artNode.setAttribute('src',src);
  }
  function node(tag,cls,text){const n=d.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;}
  function syncButtons(){
    g.EvertaleTheme.syncMotionControls();
  }
  function button(){
    const b=node('button','themeMotionToggle');b.type='button';
    g.EvertaleTheme.bindMotionControl(b);
    return b;
  }
  function sync(){
    if(!d.body)return;
    const preview=d.querySelector('.preview-controls');
    if(preview&&!preview.querySelector('.themeMotionToggle'))preview.appendChild(button());
    const cfg=g.EvertaleTheme.getActiveTheme(),profile=profiles[cfg.key];
    const elemental=cfg.material==='elemental';
    if(elemental||!profile){
      if(scene){scene.hidden=true;scene.replaceChildren();}
      active='';artNode=null;d.documentElement.removeAttribute('data-theme-scene');d.documentElement.removeAttribute('data-theme-illustrated');syncParticles(cfg.key);syncButtons();return;
    }
    const host=d.getElementById('siteThemeFx');
    if(!host)return;
    if(cfg.material==='legendary'){
      const encounter=d.getElementById('pokemonEncounter');
      if(encounter&&!encounter.querySelector('.themeMotionToggle'))encounter.appendChild(button());
    }
    if(!scene){scene=node('div','themeMotionScene');scene.id='themeMotionScene';scene.setAttribute('aria-hidden','true');}
    if(scene.parentNode!==host)host.appendChild(scene);
    scene.hidden=false;
    if(active!==cfg.key){
      d.documentElement.removeAttribute('data-theme-illustrated');
      artNode=null;
      scene.setAttribute('data-illustrated',String(!!profile.art));
      const layers=profile.layers.map(layer=>{
        const part=node('div','themeMotionLayer');
        part.setAttribute('data-layer',layer.id);
        part.setAttribute('data-mobile',String(layer.mobile));
        part.innerHTML=`<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">${layer.svg}</svg>`;
        return part;
      });
      if(profile.art){
        const art=node('img','themeMotionArt');art.alt='';art.setAttribute('aria-hidden','true');art.decoding='async';
        art.addEventListener('load',()=>{if(artNode===art&&d.documentElement.getAttribute('data-theme-key')===cfg.key)d.documentElement.setAttribute('data-theme-illustrated',cfg.key);});
        art.addEventListener('error',()=>{if(artNode===art&&d.documentElement.getAttribute('data-theme-key')===cfg.key)d.documentElement.removeAttribute('data-theme-illustrated');});
        artNode=art;layers.unshift(art);
      }
      scene.replaceChildren(...layers);scene.setAttribute('data-scene-key',cfg.key);active=cfg.key;
    }
    syncImage();d.documentElement.setAttribute('data-theme-scene',cfg.key);syncParticles(cfg.key);syncButtons();
  }
  g.EvertaleThemeMotion={keys:Object.freeze(Object.keys(profiles)),signatures:SIGNATURES,technology,sync};
  d.addEventListener('evertale:theme-applied',sync);
  mobile?.addEventListener?.('change',syncImage);
  density?.addEventListener?.('change',sync);
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',sync,{once:true}):sync();
})(window,document);
