/* Evertale elemental theme compositor.
   Owns the shared artwork, depth response, and seamless ambient motion for
   Cinderfall, Undertow, Frostbite, Thunderwake, Worldroot, Dawnspire, and
   Voidcrown. No optimizer, catalog, roster, or data behavior lives here.
*/
(function(g,d){
  'use strict';

  const CSS_ID='elemental-themes-css';
  const SCENE_ID='elementalThemeScene';
  const MOBILE_QUERY='(max-width:700px)';
  const THEMES={
    cinderfall:{particle:'ember',mobile:20,desktop:36},
    undertow:{particle:'bubble',mobile:16,desktop:28},
    frostbite:{particle:'snow',mobile:24,desktop:42},
    thunderwake:{particle:'rain',mobile:30,desktop:50},
    worldroot:{particle:'pollen',mobile:16,desktop:28},
    dawnspire:{particle:'mote',mobile:14,desktop:24},
    voidcrown:{particle:'shard',mobile:16,desktop:28}
  };

  let activeTheme='';
  let particleBucket='';
  let resizeTimer=0;
  let pointerFrame=0;

  function ensureCss(){
    if(d.getElementById(CSS_ID))return;
    const link=d.createElement('link');
    link.id=CSS_ID;
    link.rel='stylesheet';
    link.href='./elemental-themes.css?v=1';
    d.head.appendChild(link);
  }

  function currentKey(){
    const key=String(d.documentElement?.getAttribute('data-theme-key')||'').trim().toLowerCase();
    if(key)return key;
    try{return String(g.EvertaleTheme?.getActiveTheme?.()?.key||'').trim().toLowerCase();}
    catch{return'';}
  }

  function seeded(n){
    const x=Math.sin(n*9283.173+17.41)*43758.5453123;
    return x-Math.floor(x);
  }

  function createScene(){
    let scene=d.getElementById(SCENE_ID);
    if(scene)return scene;
    scene=d.createElement('div');
    scene.id=SCENE_ID;
    scene.className='elemental-theme-scene';
    scene.setAttribute('aria-hidden','true');
    scene.innerHTML=`
      <div class="elemental-theme-depth">
        <div class="elemental-theme-art"></div>
      </div>
      <div class="elemental-theme-veil"></div>
      <div class="elemental-theme-energy">
        <div class="elemental-stream stream-a"></div>
        <div class="elemental-stream stream-b"></div>
        <div class="elemental-theme-halo"></div>
      </div>
      <div class="elemental-theme-particles"></div>
      <div class="elemental-theme-atmosphere"></div>
      <div class="elemental-theme-frame"></div>`;
    d.body.insertBefore(scene,d.body.firstChild);
    return scene;
  }

  function particleCount(config){
    return g.matchMedia?.(MOBILE_QUERY).matches?config.mobile:config.desktop;
  }

  function makeParticle(type,index){
    const particle=d.createElement('i');
    const seed=index+Object.keys(THEMES).indexOf(activeTheme)*101;
    particle.className=`elemental-particle ${type}`;
    particle.style.setProperty('--x',`${(-4+seeded(seed+1)*108).toFixed(2)}%`);
    particle.style.setProperty('--size',`${(2+seeded(seed+2)*8).toFixed(1)}px`);
    particle.style.setProperty('--alpha',`${(.28+seeded(seed+3)*.66).toFixed(2)}`);
    particle.style.setProperty('--duration',`${(8+seeded(seed+4)*17).toFixed(2)}s`);
    particle.style.setProperty('--delay',`${(-seeded(seed+5)*25).toFixed(2)}s`);
    particle.style.setProperty('--drift',`${(-90+seeded(seed+6)*180).toFixed(0)}px`);
    particle.style.setProperty('--spin',`${(-240+seeded(seed+7)*720).toFixed(0)}deg`);
    particle.style.setProperty('--stretch',`${(14+seeded(seed+8)*34).toFixed(0)}px`);
    return particle;
  }

  function rebuildParticles(scene,key){
    const config=THEMES[key];
    const layer=scene.querySelector('.elemental-theme-particles');
    if(!config||!layer)return;
    const count=particleCount(config);
    const bucket=`${key}:${count}`;
    if(bucket===particleBucket)return;
    particleBucket=bucket;
    const fragment=d.createDocumentFragment();
    for(let i=0;i<count;i++)fragment.appendChild(makeParticle(config.particle,i));
    layer.replaceChildren(fragment);
  }

  function resetDepth(scene){
    scene.style.setProperty('--elemental-depth-x','0px');
    scene.style.setProperty('--elemental-depth-y','0px');
    scene.style.setProperty('--elemental-front-x','0px');
    scene.style.setProperty('--elemental-front-y','0px');
  }

  function sync(){
    if(!d.body)return;
    const key=currentKey();
    const config=THEMES[key];
    const scene=createScene();
    if(!config){
      activeTheme='';
      scene.hidden=true;
      scene.removeAttribute('data-element');
      resetDepth(scene);
      return;
    }
    activeTheme=key;
    scene.hidden=false;
    scene.setAttribute('data-element',key);
    rebuildParticles(scene,key);
  }

  function onPointerMove(event){
    if(!activeTheme||pointerFrame||g.matchMedia?.('(pointer:coarse)').matches)return;
    const x=(event.clientX/Math.max(g.innerWidth,1)-.5)*2;
    const y=(event.clientY/Math.max(g.innerHeight,1)-.5)*2;
    pointerFrame=(g.requestAnimationFrame||g.setTimeout)(()=>{
      pointerFrame=0;
      const scene=d.getElementById(SCENE_ID);
      if(!scene||scene.hidden)return;
      scene.style.setProperty('--elemental-depth-x',`${(-x*9).toFixed(2)}px`);
      scene.style.setProperty('--elemental-depth-y',`${(-y*7).toFixed(2)}px`);
      scene.style.setProperty('--elemental-front-x',`${(x*13).toFixed(2)}px`);
      scene.style.setProperty('--elemental-front-y',`${(y*10).toFixed(2)}px`);
    },16);
  }

  function onResize(){
    g.clearTimeout(resizeTimer);
    resizeTimer=g.setTimeout(()=>{
      particleBucket='';
      sync();
    },180);
  }

  function install(){
    ensureCss();
    d.getElementById('frostbiteThemeScene')?.remove();
    d.getElementById('frostbiteThemeCrown')?.remove();
    d.addEventListener('evertale:theme-applied',sync,true);
    g.addEventListener('popstate',sync);
    g.addEventListener('resize',onResize,{passive:true});
    g.addEventListener('pointermove',onPointerMove,{passive:true});
    d.addEventListener('pointerleave',()=>{
      const scene=d.getElementById(SCENE_ID);
      if(scene)resetDepth(scene);
    });
    sync();
  }

  g.EvertaleElementalThemes={keys:Object.freeze(Object.keys(THEMES)),sync};
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',install,{once:true}):install();
})(window,document);
