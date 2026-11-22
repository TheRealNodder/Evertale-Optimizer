/* One reusable decorative stage. Theme data and keyframes are built offline.
   CSS owns movement; there is no render loop, polling, or application data. */
(function(g,d){
  'use strict';
  const profiles=g.EvertaleMotionProfiles;
  if(!profiles||!g.EvertaleTheme)return;
  const assetBase=new URL('.',d.currentScript?.src||new URL('theme-motion.js',d.baseURI||g.location.href).href);
  const mobile=g.matchMedia?.('(max-width:480px)');
  let scene=null,active='',artNode=null;
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
      active='';artNode=null;d.documentElement.removeAttribute('data-theme-scene');d.documentElement.removeAttribute('data-theme-illustrated');syncButtons();return;
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
    syncImage();d.documentElement.setAttribute('data-theme-scene',cfg.key);syncButtons();
  }
  g.EvertaleThemeMotion={keys:Object.freeze(Object.keys(profiles)),sync};
  d.addEventListener('evertale:theme-applied',sync);
  mobile?.addEventListener?.('change',syncImage);
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',sync,{once:true}):sync();
})(window,document);
