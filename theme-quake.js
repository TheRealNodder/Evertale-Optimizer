/* Earthquakes: about five static crack patterns of varied size spawn across the page.
   Each one opens from its centre outward (crack bands appear ring by ring over an inner-to-outer
   glow), holds, then disappears and "mends" from the middle outward in the same order.
   Opacity and transform only; positions are page percentages, so no redraw on resize. */
(function(g,d){
  'use strict';
  const SVGNS='http://www.w3.org/2000/svg';
  const LIMITS={desktop:5,phone:3},BANDS=4;
  function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  const fx=n=>Math.round(n*10)/10;

  /* One jagged branch from the centre outward, split into distance bands. */
  function branch(rand,cx,cy,angle,reach,bands,depth){
    let x=cx,y=cy,a=angle;
    const steps=6+Math.floor(rand()*4),step=reach/steps;
    for(let i=0;i<steps;i++){
      a+=(rand()-.5)*.9;
      const nx=x+Math.cos(a)*step*(.75+rand()*.5),ny=y+Math.sin(a)*step*(.75+rand()*.5);
      const dist=Math.hypot((x+nx)/2-cx,(y+ny)/2-cy),band=Math.min(BANDS-1,Math.floor(dist/(reach*1.02)*BANDS));
      bands[band].push(`M${fx(x)} ${fx(y)}L${fx(nx)} ${fx(ny)}`);
      if(depth<1&&i>1&&rand()<.28)branch(rand,nx,ny,a+(rand()<.5?-1:1)*(.6+rand()*.5),reach*(.35+rand()*.2)*(1-i/steps)+reach*.1,bands,depth+1);
      x=nx;y=ny;
    }
  }

  /* Pure layout, exposed for tests. Crack coordinates are in each quake's own box (2R x 2R). */
  function layout(options={}){
    const phone=!!options.mobile,count=phone?LIMITS.phone:LIMITS.desktop;
    const rand=random(hash(`${options.key||'quake'}:${options.seed||0}:${phone}`));
    const quakes=[];
    for(let q=0;q<count;q++){
      const r=phone?45+rand()*55:60+rand()*120,box=r*2,cx=r,cy=r;
      const bands=Array.from({length:BANDS},()=>[]);
      const arms=5+Math.floor(rand()*3),start=rand()*Math.PI*2;
      for(let k=0;k<arms;k++)branch(rand,cx,cy,start+k*(Math.PI*2/arms)+(rand()-.5)*.5,r*(.7+rand()*.28),bands,0);
      const duration=9+rand()*5;
      quakes.push({
        x:+(6+(q+rand()*.8)/count*88).toFixed(2),y:+(8+rand()*84).toFixed(2),radius:+r.toFixed(1),size:+box.toFixed(1),
        bands:bands.map(list=>list.join('')),duration:+duration.toFixed(2),delay:+(-rand()*duration).toFixed(2)
      });
    }
    return quakes;
  }

  const fields=new WeakMap();
  function render(host,options={}){
    if(!host||!d)return null;
    clear(host);
    const mobile=options.mobile??!!g.matchMedia?.('(max-width:700px)').matches;
    const quakes=layout({...options,mobile});
    const field=d.createElement('div');field.className='tqField';field.setAttribute('aria-hidden','true');field.setAttribute('data-quake-key',options.key||'');
    for(const quake of quakes){
      const box=d.createElement('div');box.className='tqQuake';
      const vars={'--x':`${quake.x}%`,'--y':`${quake.y}%`,'--size':`${quake.size}px`,'--d':`${quake.duration}s`,'--delay':`${quake.delay}s`};
      for(const[k,v]of Object.entries(vars))box.style.setProperty(k,v);
      const glow=d.createElement('i');glow.className='tqGlow';box.appendChild(glow);
      const svg=d.createElementNS(SVGNS,'svg');
      svg.setAttribute('viewBox',`0 0 ${quake.size} ${quake.size}`);svg.setAttribute('focusable','false');svg.setAttribute('aria-hidden','true');
      quake.bands.forEach((dpath,band)=>{
        const group=d.createElementNS(SVGNS,'g');group.setAttribute('class','tqBand');group.style.setProperty('--band',String(band));
        for(const cls of ['tqCrackGlow','tqCrack']){const p=d.createElementNS(SVGNS,'path');p.setAttribute('class',cls);p.setAttribute('d',dpath||'M0 0');group.appendChild(p);}
        svg.appendChild(group);
      });
      box.appendChild(svg);field.appendChild(box);
    }
    host.appendChild(field);fields.set(host,field);
    return quakes;
  }
  function clear(host){const field=host&&fields.get(host);if(field){field.remove();fields.delete(host);}}

  g.EvertaleQuake=Object.freeze({render,clear,layout,limits:LIMITS,bands:BANDS});
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
