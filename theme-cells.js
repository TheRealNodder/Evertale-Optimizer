/* Organic living cells (Zygarde): filled hexagons of varied sizes scattered through the page.
   Each one fades in while growing, then fades out while shrinking, on staggered timings.
   Scale and opacity only; positions are static percentages, so resizing needs no redraw. */
(function(g,d){
  'use strict';
  const LIMITS={desktop:24,phone:10};
  // Eighteen type-inspired jewel hues, interleaved so the phone subset is varied.
  const CRYSTAL_COLORS=Object.freeze(["#54b86d","#477ebf","#8bdce9","#e5d748","#e65252","#a375c7","#a4c94a","#e99c38","#29a9d4","#865e46","#d6dae0","#e75c87","#c79569","#969878","#838e9d","#83638f","#f491b9","#6655be"]);
  function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

  /* Pure layout, exposed for tests. Small cells are common, large ones rare. */
  function layout(options={}){
    const rand=random(hash(`${options.key||'cells'}:${options.seed||0}`));
    const colors=['var(--site-theme-accent)','var(--site-theme-secondary)','color-mix(in srgb,var(--site-theme-accent) 55%,var(--site-theme-ink))'];
    const cells=Array.from({length:LIMITS.desktop},(_,i)=>{
      const size=18+Math.pow(rand(),2.2)*92;
      const duration=7+rand()*7;
      return{
        x:+(3+rand()*94).toFixed(2),y:+(4+rand()*92).toFixed(2),size:+size.toFixed(1),
        duration:+duration.toFixed(2),delay:+(-rand()*duration).toFixed(2),
        opacity:+(.38+rand()*.32).toFixed(2),turn:Math.round((rand()-.5)*24),
        color:colors[i%colors.length],mobile:i<LIMITS.phone
      };
    });
    if(options.key==='ultranecrozma')cells.forEach((c,i)=>{
      c.color=CRYSTAL_COLORS[(i*7)%CRYSTAL_COLORS.length];
      c.crystal=true;
    });
    if(options.key==='zygarde')for(const c of cells){
      const centerX=c.x<50?25:75,centerY=c.y<50?25:75;
      c.gatherX=+(Math.max(-12,Math.min(12,(centerX-c.x)*.6))).toFixed(1);
      c.gatherY=+(Math.max(-12,Math.min(12,(centerY-c.y)*.6))).toFixed(1);
    }
    return cells;
  }

  const fields=new WeakMap();
  function render(host,options={}){
    if(!host||!d)return null;
    clear(host);
    const field=d.createElement('div');field.className='tcField';field.setAttribute('aria-hidden','true');field.setAttribute('data-cells-key',options.key||'');
    const cells=layout(options);
    for(const c of cells){
      const cell=d.createElement('i');cell.className='tcCell';cell.setAttribute('data-mobile',String(c.mobile));
      if(c.crystal)cell.setAttribute('data-crystal','true');
      const vars={'--x':`${c.x}%`,'--y':`${c.y}%`,'--size':`${c.size}px`,'--d':`${c.duration}s`,'--delay':`${c.delay}s`,'--o':String(c.opacity),'--turn':`${c.turn}deg`,'--cell-color':c.color};
      if(c.gatherX!==undefined){vars['--gather-x']=`${c.gatherX}px`;vars['--gather-y']=`${c.gatherY}px`;}
      for(const[k,v]of Object.entries(vars))cell.style.setProperty(k,v);
      field.appendChild(cell);
    }
    host.appendChild(field);fields.set(host,field);
    return cells;
  }
  function clear(host){const field=host&&fields.get(host);if(field){field.remove();fields.delete(host);}}

  g.EvertaleCells=Object.freeze({render,clear,layout,limits:LIMITS});
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
