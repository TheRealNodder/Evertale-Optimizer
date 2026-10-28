/* Recognizable local character art + coordinated, viewport-bounded frame motion.
   Presentation only: no roster, card state, stat, or optimizer ownership. */
(function(g,d){
  'use strict';
  const profiles={
    hooh:['#f05a35','#ffcf58','#57ca83','Rainbow rebirth'],
    lugia:['#e5f4ff','#5984e8','#78e2f4','Guardian of the deep'],
    suicune:['#66dcf2','#a284ed','#e1fcff','The north wind'],
    groudon:['#ff5136','#ffbc45','#c52c30','Continental awakening'],
    kyogre:['#358bff','#ed415d','#78edff','Abyssal awakening'],
    rayquaza:['#31db8e','#f8d55c','#eb5b54','Ruler of the skies'],
    shinyprimalgroudon:['#ffd33c','#fa7135','#e1e6e8','Primal volcanic surge'],
    shinyprimalkyogre:['#ffdf63','#ed8bcf','#edf5ff','Primal ocean surge'],
    shinymegarayquaza:['#ffda57','#f05c69','#7bdfbb','The golden delta'],
    dialga:['#439bea','#80eaff','#c0d8eb','The flow of time'],
    palkia:['#eac8ec','#eb83c1','#b49aff','The fabric of space'],
    giratina:['#e7bd54','#ec465a','#b8b1cc','Beyond the distortion'],
    arceus:['#f1eee1','#eccc64','#81d6a9','The origin of everything'],
    reshiram:['#e9f1f5','#ff9e64','#b1efff','White-hot truth'],
    zekrom:['#5ce5fa','#6d9eff','#b7c9e6','Electrified ideals'],
    blackkyurem:['#69ddff','#4b97f5','#c2d6e7','Frozen voltage'],
    whitekyurem:['#b5f2ff','#ff994c','#eefbff','Flame beneath the frost'],
    xerneas:['#6de7db','#f9ca61','#ed85e2','The light of life'],
    yveltal:['#f14d64','#b84366','#dbd5e3','Wings of oblivion'],
    zygarde:['#91ef64','#46bc84','#ef6d83','Order restored'],
    solgaleo:['#fff0c5','#ffca51','#a9d7ed','Radiant solar power'],
    lunala:['#c48aef','#69d4e9','#ecd4ff','Embrace the moonlight'],
    ultranecrozma:['#fff1a8','#63e5fa','#ffd552','Light without limits'],
    zacian:['#66d8ee','#f6d469','#e48fc4','The crowned blade'],
    zamazenta:['#f16c77','#eac66c','#74d5e3','The crowned shield'],
    eternatus:['#ef4f9e','#885ee9','#66dce7','The darkest storm'],
    koraidon:['#ff654b','#e7bb8b','#8ba2f0','Ancient power unleashed'],
    miraidon:['#ae83ff','#51ecf4','#f0e878','The future awakens'],
    terapagos:['#6df1e0','#a995ff','#f4efff','Stellar brilliance']
  };
  const HOSTS='.panel,.v2-panel,.v2-sidebar,.v2-grid-panel,.v2-detail-panel,.v2-filter-panel,.v2-selected-card,.v2-card-skill-panel,.unitCard,.slotCard,.platoonPanel,.platoonSlotCard,.pokemonEncounter';
  let active='',hero=null,nameNode=null,lineNode=null,groupNode=null,artNode=null;
  let visibility=null;
  const frames=new Map();
  const localArt=key=>Object.hasOwn(profiles,key)?new URL(`./assets/themes/pokemon/${key}.png`,d.baseURI||g.location.href).href:'';
  function el(tag,cls,text){const node=d.createElement(tag);node.className=cls;if(text)node.textContent=text;return node;}
  function createHero(){
    if(hero)return hero;
    hero=el('section','pokemonEncounter');hero.id='pokemonEncounter';
    const ambient=el('div','pokemonEncounter__ambient');ambient.setAttribute('aria-hidden','true');
    const copy=el('div','pokemonEncounter__copy');
    groupNode=el('div','pokemonEncounter__group');nameNode=el('h2','pokemonEncounter__name');lineNode=el('div','pokemonEncounter__line');
    const credits=el('a','pokemonEncounter__credits','Fan theme · Artwork credits');
    credits.href='https://github.com/PokeAPI/sprites';credits.target='_blank';credits.rel='noopener noreferrer';
    copy.append(groupNode,nameNode,lineNode,credits);
    artNode=el('img','pokemonEncounter__art');artNode.alt='';artNode.setAttribute('aria-hidden','true');artNode.decoding='async';
    artNode.addEventListener('load',()=>hero.setAttribute('data-art-state','ready'));
    artNode.addEventListener('error',()=>{hero.setAttribute('data-art-state','failed');console.warn('Pokémon theme artwork failed to load; identity label and frame remain available.');});
    hero.append(ambient,copy,artNode);
    const main=d.querySelector('main.page');
    if(main)main.insertBefore(hero,main.firstChild);
    else d.body.insertBefore(hero,d.querySelector('.panel')||d.body.firstChild);
    return hero;
  }
  function track(host){
    // This inner control container is intentionally flattened by the optimizer layout.
    // Its actual enclosing box is the sidebar, not an additional rectangular panel.
    if(!host||host.matches?.('.v2-optimizer-control-panel'))return;
    if(frames.has(host)){const existing=frames.get(host);if(!host.contains(existing))host.appendChild(existing);return;}
    const frame=el('span','legendaryFrame');frame.setAttribute('aria-hidden','true');
    // Scroll panes need an outline attached to the box itself: an absolute child
    // would scroll across the cards. Preserve sidebar sticky/static positioning.
    if(host.matches?.('.v2-sidebar,.v2-grid-panel')){host.setAttribute('data-pokemon-outline','');frame.hidden=true;}
    host.appendChild(frame);host.setAttribute('data-pokemon-frame','');frames.set(host,frame);
    if(visibility)visibility.observe(host);
    else{frame.setAttribute('data-frame-visible','true');host.setAttribute('data-pokemon-visible','true');}
  }
  function scan(root=d){
    if(!active)return;
    if(root.matches?.(HOSTS))track(root);
    root.querySelectorAll?.(HOSTS).forEach(track);
  }
  function purgeDetached(){
    for(const [host] of frames){if(host.isConnected===false){visibility?.unobserve(host);frames.delete(host);}}
  }
  function sync(){
    const key=d.documentElement.getAttribute('data-theme-key');
    const profile=profiles[key];
    active=profile?key:'';
    if(!profile){
      d.documentElement.removeAttribute('data-pokemon-presence');
      if(hero)hero.hidden=true;
      visibility?.disconnect();
      return;
    }
    const cfg=g.EvertaleTheme.getActiveTheme();
    const root=d.documentElement,art=localArt(key);
    root.setAttribute('data-pokemon-presence',key);
    root.style.setProperty('--pokemon-frame-a',profile[0]);root.style.setProperty('--pokemon-frame-b',profile[1]);root.style.setProperty('--pokemon-frame-c',profile[2]);
    root.style.setProperty('--pokemon-art',`url("${art}")`);
    root.style.setProperty('--legendary-crest-image',`url("${art}")`);
    root.style.setProperty('--legendary-crest-watermark','none');
    const panel=createHero();panel.hidden=false;panel.setAttribute('data-pokemon',key);panel.setAttribute('aria-label',`${cfg.label} theme`);
    groupNode.textContent=cfg.group;nameNode.textContent=cfg.label;lineNode.textContent=profile[3];
    if(artNode.getAttribute('src')!==art){panel.setAttribute('data-art-state','loading');artNode.setAttribute('src',art);}
    track(panel);scan();purgeDetached();
    for(const [host] of frames)visibility?.observe(host);
  }
  function install(){
    if(g.IntersectionObserver){
      visibility=new g.IntersectionObserver(entries=>{
        for(const entry of entries){
          const visible=entry.isIntersecting?'true':'false';
          frames.get(entry.target)?.setAttribute('data-frame-visible',visible);
          entry.target.setAttribute('data-pokemon-visible',visible);
        }
      },{rootMargin:'40px'});
    }
    if(g.MutationObserver){
      new g.MutationObserver(records=>{
        if(!active)return;
        for(const record of records){
          if(record.target.isConnected!==false&&record.target.matches?.(HOSTS))track(record.target);
          for(const node of record.addedNodes||[]){
            if(node.nodeType===1&&node.className!=='legendaryFrame')scan(node);
          }
        }
        purgeDetached();
      }).observe(d.body,{childList:true,subtree:true});
    }
    d.addEventListener('evertale:theme-applied',sync,true);sync();
  }
  g.EvertalePokemonPresence={version:1,keys:Object.freeze(Object.keys(profiles)),describe:key=>profiles[key]?.slice()||null,art:localArt,sync,scan};
  d.readyState==='loading'?d.addEventListener('DOMContentLoaded',install,{once:true}):install();
})(window,document);
