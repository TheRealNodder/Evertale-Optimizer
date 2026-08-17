/* Frostbite / Icicle theme extension.
   Registers itself with the existing seasonal-theme authority, loads its
   visual stylesheet, and creates decorative layers only while Frostbite is active.
*/
(function(g,d){
  'use strict';

  const KEY='frostbite';
  const PALETTE=['#03101d','#0a2238','#8eeeff','#effcff'];
  const CSS_ID='frostbite-theme-css';
  const SCENE_ID='frostbiteThemeScene';
  const CROWN_ID='frostbiteThemeCrown';

  function registerTheme(){
    const api=g.EvertaleTheme;
    if(!api?.themes)return false;
    if(!api.themes[KEY])api.themes[KEY]=[...PALETTE];
    return true;
  }

  function ensureCss(){
    if(d.getElementById(CSS_ID))return;
    const link=d.createElement('link');
    link.id=CSS_ID;
    link.rel='stylesheet';
    link.href='./frostbite-theme.css?v=1';
    d.head.appendChild(link);
  }

  function activeKey(){
    const attr=String(d.documentElement?.getAttribute('data-theme-key')||'').trim().toLowerCase();
    if(attr)return attr;
    try{return String(g.EvertaleTheme?.getActiveTheme?.()?.key||'').trim().toLowerCase();}
    catch{return'';}
  }

  function seeded(n){
    const x=Math.sin(n*999.91)*43758.5453;
    return x-Math.floor(x);
  }

  function buildAmbient(){
    let scene=d.getElementById(SCENE_ID);
    if(scene)return scene;
    scene=d.createElement('div');
    scene.id=SCENE_ID;
    scene.className='frostbite-theme-scene';
    scene.setAttribute('aria-hidden','true');

    const left=d.createElement('div'); left.className='frostbite-edge left';
    const right=d.createElement('div'); right.className='frostbite-edge right';
    scene.append(left,right);

    const snowCount=g.innerWidth<700?28:54;
    for(let i=0;i<snowCount;i++){
      const flake=d.createElement('i');
      flake.className=`frostbite-snowflake${i%7===0?' crystal':''}`;
      flake.style.setProperty('--x',`${(seeded(i+100)*100).toFixed(2)}%`);
      flake.style.setProperty('--size',`${(2.2+seeded(i+200)*6.5).toFixed(1)}px`);
      flake.style.setProperty('--alpha',`${(.35+seeded(i+300)*.58).toFixed(2)}`);
      flake.style.setProperty('--duration',`${(9+seeded(i+400)*15).toFixed(1)}s`);
      flake.style.setProperty('--delay',`${(-seeded(i+500)*22).toFixed(1)}s`);
      flake.style.setProperty('--drift',`${(-36+seeded(i+600)*72).toFixed(0)}px`);
      scene.appendChild(flake);
    }

    const mist1=d.createElement('div'); mist1.className='frostbite-mist';
    const mist2=d.createElement('div'); mist2.className='frostbite-mist mist2';
    const ground=d.createElement('div'); ground.className='frostbite-ground-frost';
    scene.append(mist1,mist2,ground);
    d.body.appendChild(scene);
    return scene;
  }

  function buildCrown(){
    let crown=d.getElementById(CROWN_ID);
    if(crown)return crown;
    crown=d.createElement('div');
    crown.id=CROWN_ID;
    crown.className='frostbite-theme-crown';
    crown.setAttribute('aria-hidden','true');

    const cap=d.createElement('div'); cap.className='frostbite-ice-cap';
    crown.appendChild(cap);

    const count=Math.max(18,Math.min(38,Math.round(g.innerWidth/52)));
    for(let i=0;i<count;i++){
      const icicle=d.createElement('i');
      icicle.className='frostbite-icicle';
      const x=((i+seeded(i+4)*.85)/count)*100;
      const h=30+seeded(i+14)*94;
      const w=7+seeded(i+44)*18;
      icicle.style.setProperty('--x',`${x.toFixed(2)}%`);
      icicle.style.setProperty('--h',`${h.toFixed(0)}px`);
      icicle.style.setProperty('--w',`${w.toFixed(0)}px`);
      icicle.style.setProperty('--opacity',`${(.58+seeded(i+74)*.36).toFixed(2)}`);
      crown.appendChild(icicle);
    }

    d.body.appendChild(crown);
    return crown;
  }

  function ensureLayers(){
    if(!d.body)return;
    buildAmbient();
    buildCrown();
  }

  function sync(){
    if(!d.body)return;
    const on=activeKey()===KEY;
    if(on)ensureLayers();
    const scene=d.getElementById(SCENE_ID);
    const crown=d.getElementById(CROWN_ID);
    if(scene)scene.hidden=!on;
    if(crown)crown.hidden=!on;
  }

  function rebuildForResize(){
    if(activeKey()!==KEY)return;
    d.getElementById(SCENE_ID)?.remove();
    d.getElementById(CROWN_ID)?.remove();
    sync();
  }

  function install(){
    ensureCss();
    registerTheme();
    d.addEventListener('evertale:theme-applied',sync,true);
    g.addEventListener('popstate',sync);
    g.addEventListener('resize',rebuildForResize,{passive:true});
    try{g.EvertaleTheme?.applyTheme?.();}catch{}
    sync();
  }

  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',install,{once:true}):install();
})(window,document);
