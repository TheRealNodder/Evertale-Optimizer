/* One reusable decorative stage. Theme data and keyframes are built offline.
   CSS owns movement; there is no render loop, polling, or application data. */
(function(g,d){
  'use strict';
  const profiles=g.EvertaleMotionProfiles;
  if(!profiles||!g.EvertaleTheme)return;
  const assetBase=new URL('.',d.currentScript?.src||new URL('theme-motion.js',d.baseURI||g.location.href).href);
  const mobile=g.matchMedia?.('(max-width:480px)');
  let scene=null,active='',artNode=null,particles=null,particleKey='';
  /* Visible ambient particles per theme: CSS-animated, transform/opacity only, paused and
     hidden by the same motion state as the scene. Elemental themes keep their own effects. */
  const PARTICLE_TYPES={
    spring:'petals',summer:'sparkles',autumn:'leaves',winter:'snow',newyear:'confetti',valentine:'petals',stpatrick:'leaves',
    easter:'petals',independence:'sparkles',halloween:'fireflies',thanksgiving:'leaves',christmas:'snow',
    midnight:'stars',aurora:'stars',sakura:'petals',ocean:'bubbles',ember:'embers',royal:'sparkles',cyber:'rain',
    forest:'fireflies',cosmic:'stars',sunrise:'motes',gold:'sparkles',silver:'sparkles',ruby:'embers',sapphire:'bubbles',
    emerald:'motes',diamond:'sparkles',pearl:'bubbles',platinum:'sparkles',quartz:'sparkles',opal:'sparkles',topaz:'sparkles',
    jade:'motes',obsidian:'ash',amethyst:'sparkles',crimsonblack:'motes',cobaltblack:'motes',metallicrose:'motes',
    bronzexl:'motes',blackwhitedsi:'motes',galaxystyle:'stars',superfamicom:'motes',
    hooh:'embers',lugia:'wind',suicune:'sparkles',groudon:'ash',kyogre:'rain',rayquaza:'wind',shinyprimalgroudon:'embers',
    shinyprimalkyogre:'rain',shinymegarayquaza:'wind',dialga:'motes',palkia:'sparkles',giratina:'ash',arceus:'stars',
    reshiram:'embers',zekrom:'rain',blackkyurem:'snow',whitekyurem:'snow',xerneas:'fireflies',yveltal:'ash',zygarde:'leaves',
    solgaleo:'embers',lunala:'stars',ultranecrozma:'sparkles',zacian:'wind',zamazenta:'sparkles',eternatus:'embers',
    koraidon:'motes',miraidon:'sparkles',terapagos:'sparkles'
  };
  const PARTICLE_COUNT=28;
  function seeded(key){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h=Math.imul(h^(h>>>15),2246822507);h=Math.imul(h^(h>>>13),3266489909);return((h^=h>>>16)>>>0)/4294967296;};}
  function syncParticles(key){
    const type=key&&PARTICLE_TYPES[key];
    if(!type){if(particles){particles.hidden=true;particles.replaceChildren();}particleKey='';return;}
    if(!particles){particles=node('div','themeMotionParticles');particles.id='themeMotionParticles';particles.setAttribute('aria-hidden','true');}
    if(particles.parentNode!==d.body)d.body.appendChild(particles);
    particles.hidden=false;
    if(particleKey===key)return;
    const rand=seeded(key),colors=['var(--site-theme-accent)','var(--site-theme-secondary)','var(--site-theme-ink)'];
    const spans=Array.from({length:PARTICLE_COUNT},(_,i)=>{
      const p=node('span','themeMotionParticle');
      const dur=type==='rain'?1.1+rand()*.8:type==='wind'?3.2+rand()*3:type==='stars'||type==='sparkles'?2.6+rand()*3.4:8+rand()*9;
      const vars={'--x':`${(rand()*100).toFixed(2)}vw`,'--y':`${(rand()*92).toFixed(2)}vh`,'--s':`${((type==='stars'?2:3)+rand()*(type==='bubbles'?9:5)).toFixed(1)}px`,
        '--d':`${dur.toFixed(2)}s`,'--delay':`${(-rand()*dur).toFixed(2)}s`,'--dx':`${((rand()-.5)*16).toFixed(2)}vw`,
        '--r':`${Math.round((rand()-.5)*720)}deg`,'--o':(.55+rand()*.35).toFixed(2),'--c':colors[i%3]};
      for(const[k,v]of Object.entries(vars))p.style.setProperty(k,v);
      return p;
    });
    particles.setAttribute('data-particles',type);particles.setAttribute('data-scene-key',key);
    particles.replaceChildren(...spans);particleKey=key;
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
      active='';artNode=null;d.documentElement.removeAttribute('data-theme-scene');d.documentElement.removeAttribute('data-theme-illustrated');syncParticles('');syncButtons();return;
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
  g.EvertaleThemeMotion={keys:Object.freeze(Object.keys(profiles)),sync};
  d.addEventListener('evertale:theme-applied',sync);
  mobile?.addEventListener?.('change',syncImage);
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',sync,{once:true}):sync();
})(window,document);
