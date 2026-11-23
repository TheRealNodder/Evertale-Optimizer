/* Gem gleams for the version games: the actual gem (or precious metal) of each game, drawn as
   faceted outlines with real gem colours, scattered through the page. A bright light sweep
   crosses each gem's facets now and then, followed by a small star glint. The gems drift very
   slightly. Transform and opacity only; positions are page percentages. */
(function(g,d){
  'use strict';
  const LIMITS={desktop:7,phone:3};
  /* cut: shape family; colours: body, light, deep. */
  const GEMS={
    ruby:{cut:'oval',body:'#d1104f',light:'#ff8fb0',deep:'#6e0624'},
    sapphire:{cut:'oval',body:'#1f55c8',light:'#8fb8ff',deep:'#0a2463'},
    emerald:{cut:'emerald',body:'#1fa05a',light:'#8ff0b8',deep:'#0b4a2a'},
    diamond:{cut:'brilliant',body:'#cfefff',light:'#ffffff',deep:'#7fb4d6'},
    pearl:{cut:'pearl',body:'#f4eee6',light:'#ffffff',deep:'#cdbfd2'},
    gold:{cut:'ingot',body:'#e9b93a',light:'#fff1b0',deep:'#8a6512'},
    silver:{cut:'ingot',body:'#c9d2dc',light:'#ffffff',deep:'#6f7b88'},
    platinum:{cut:'ingot',body:'#e2e0d8',light:'#ffffff',deep:'#8d8a7c'},
    quartz:{cut:'prism',body:'#f3d6f6',light:'#ffffff',deep:'#a98bb2'},
    amethyst:{cut:'prism',body:'#9b5de5',light:'#e2c6ff',deep:'#4c1d95'},
    topaz:{cut:'oval',body:'#f59e0b',light:'#ffe2a3',deep:'#854d0e'},
    opal:{cut:'pearl',body:'#e7f6f8',light:'#ffffff',deep:'#9fc7d8'},
    jade:{cut:'pearl',body:'#3fbf8a',light:'#b6f3d6',deep:'#176b51'},
    obsidian:{cut:'brilliant',body:'#1c1628',light:'#b9a3ff',deep:'#050308'}
  };
  /* Shape, facet lines and the matching CSS clip for the sweep, in a 100 x 100 box. */
  const CUTS={
    oval:{ratio:.78,shape:'<ellipse cx="50" cy="50" rx="49" ry="49"/>',facets:'<ellipse cx="50" cy="50" rx="27" ry="27"/><path d="M50 1V23M50 77V99M1 50H23M77 50H99M15 15L31 31M85 15L69 31M15 85L31 69M85 85L69 69"/>',clip:'ellipse(50% 50% at 50% 50%)'},
    emerald:{ratio:.72,shape:'<path d="M14 1H86L99 14V86L86 99H14L1 86V14Z"/>',facets:'<path d="M24 14H76L86 24V76L76 86H24L14 76V24Z"/><path d="M34 27H66L73 34V66L66 73H34L27 66V34Z"/><path d="M1 14L14 24M99 14L86 24M1 86L14 76M99 86L86 76"/>',clip:'polygon(14% 0,86% 0,100% 14%,100% 86%,86% 100%,14% 100%,0 86%,0 14%)'},
    brilliant:{ratio:.86,shape:'<path d="M22 1H78L99 30L50 99L1 30Z"/>',facets:'<path d="M1 30H99M22 1L34 30L50 1L66 30L78 1M34 30L50 99L66 30M14 12L34 30M86 12L66 30"/>',clip:'polygon(22% 0,78% 0,100% 30%,50% 100%,0 30%)'},
    pearl:{ratio:1,shape:'<circle cx="50" cy="50" r="49"/>',facets:'<path d="M26 34Q50 14 74 34" stroke-opacity=".5"/>',clip:'circle(50% at 50% 50%)'},
    ingot:{ratio:.55,shape:'<path d="M16 1H84L99 99H1Z"/>',facets:'<path d="M16 1L24 24H76L84 1M24 24L12 99M76 24L88 99"/>',clip:'polygon(16% 0,84% 0,100% 100%,0 100%)'},
    prism:{ratio:1.5,shape:'<path d="M50 1L80 24V82L50 99L20 82V24Z"/>',facets:'<path d="M50 1V99M20 24L50 40L80 24M50 40V99"/>',clip:'polygon(50% 0,80% 24%,80% 82%,50% 100%,20% 82%,20% 24%)'}
  };
  function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

  /* Pure layout, exposed for tests. */
  function layout(options={}){
    const key=options.key in GEMS?options.key:'diamond',gem=GEMS[key],cut=CUTS[gem.cut];
    const phone=!!options.mobile,count=phone?LIMITS.phone:LIMITS.desktop;
    const rand=random(hash(`${key}:${options.seed||0}:${phone}`));
    return Array.from({length:count},(_,i)=>{
      const width=phone?34+rand()*30:38+rand()*52,sweep=6+rand()*5;
      return{key,cut:gem.cut,x:+(5+(i+rand()*.8)/count*90).toFixed(2),y:+(8+rand()*84).toFixed(2),
        width:+width.toFixed(1),height:+(width*cut.ratio).toFixed(1),turn:Math.round((rand()-.5)*36),
        sweep:+sweep.toFixed(2),delay:+(-rand()*sweep).toFixed(2),float:+(10+rand()*8).toFixed(2),opacity:+(.72+rand()*.2).toFixed(2)};
    });
  }

  const fields=new WeakMap();
  function render(host,options={}){
    if(!host||!d)return null;
    clear(host);
    const mobile=options.mobile??!!g.matchMedia?.('(max-width:700px)').matches;
    const gems=layout({...options,mobile});
    const field=d.createElement('div');field.className='tgField';field.setAttribute('aria-hidden','true');field.setAttribute('data-gem-key',gems[0]?.key||'');
    gems.forEach((gem,i)=>{
      const colour=GEMS[gem.key],cut=CUTS[gem.cut],id=`tg${hash(`${gem.key}${i}${mobile}`).toString(36)}`;
      const box=d.createElement('div');box.className='tgGem';
      const vars={'--x':`${gem.x}%`,'--y':`${gem.y}%`,'--w':`${gem.width}px`,'--h':`${gem.height}px`,'--turn':`${gem.turn}deg`,
        '--sweep':`${gem.sweep}s`,'--delay':`${gem.delay}s`,'--float':`${gem.float}s`,'--o':String(gem.opacity),'--clip':cut.clip};
      for(const[k,v]of Object.entries(vars))box.style.setProperty(k,v);
      box.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false" aria-hidden="true">`+
        `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colour.light}"/><stop offset=".45" stop-color="${colour.body}"/><stop offset="1" stop-color="${colour.deep}"/></linearGradient></defs>`+
        `<g class="tgBody" fill="url(#${id})">${cut.shape}</g><g class="tgFacets">${cut.facets}</g><g class="tgEdge">${cut.shape}</g></svg>`+
        `<i class="tgSweep"></i><i class="tgStar"></i>`;
      field.appendChild(box);
    });
    host.appendChild(field);fields.set(host,field);
    return gems;
  }
  function clear(host){const field=host&&fields.get(host);if(field){field.remove();fields.delete(host);}}

  g.EvertaleGems=Object.freeze({render,clear,layout,limits:LIMITS,keys:Object.freeze(Object.keys(GEMS))});
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
