/* Wind currents: invisible wind lines are laid through the page, and a bright streak
   (with a soft glow) runs along each one, fading in and out like a gust through the air.
   The lines themselves stay fully transparent; only the moving streak is ever seen.
   One static SVG sized 1:1 to the host, redrawn only when the host size changes. */
(function(g,d){
  'use strict';
  const SVGNS='http://www.w3.org/2000/svg';
  const LIMITS={desktop:10,phone:4};
  function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  const fx=n=>Math.round(n*10)/10;
  const bez=(p0,p1,p2,p3,t)=>{const u=1-t;return[u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]];};
  function curveLength(segments){
    let total=0;
    for(const s of segments){let prev=s[0];for(let i=1;i<=24;i++){const p=bez(...s,i/24);total+=Math.hypot(p[0]-prev[0],p[1]-prev[1]);prev=p;}}
    return total;
  }

  /* Pure layout, exposed for tests. Each current is one or two smooth cubic curves drifting
     across part of the page; some finish with a small curl, like a gust turning over. */
  function layout(width,height,options={}){
    const phone=!!options.mobile,count=phone?LIMITS.phone:LIMITS.desktop;
    const rand=random(hash(`${options.key||'wind'}:${options.seed||0}:${phone}`));
    const dir=options.direction===-1?-1:1;
    const lines=[];
    for(let i=0;i<count;i++){
      const span=width*(phone?.7:.35+rand()*.3),y=height*(.06+(i+rand()*.8)/count*.9);
      const x0=rand()*(width-span*.6)-span*.1,x1=x0+span,lift=(rand()-.5)*height*.12,wave=height*(.03+rand()*.05);
      const a=[x0,y],b=[x0+span*.33,y-wave],c=[x0+span*.66,y+wave+lift*.5],e=[x1,y+lift];
      const segments=[[a,b,c,e]];
      if(!phone&&rand()<.4){ /* a small curl at the end of the gust */
        const r=height*(.025+rand()*.03);
        segments.push([e,[e[0]+r*1.6,e[1]-r*.2],[e[0]+r*1.4,e[1]-r*2],[e[0]+r*.2,e[1]-r*1.6]]);
      }
      const pts=segments.map(s=>s.map(p=>dir===1?p:[width-p[0],p[1]]));
      const dpath=pts.map((s,k)=>`${k?'':`M${fx(s[0][0])} ${fx(s[0][1])}`}C${fx(s[1][0])} ${fx(s[1][1])} ${fx(s[2][0])} ${fx(s[2][1])} ${fx(s[3][0])} ${fx(s[3][1])}`).join('');
      const len=curveLength(pts),seg=Math.max(60,len*(.16+rand()*.1));
      const duration=2.6+rand()*1.8,cycle=duration/.62;
      lines.push({d:dpath,len:+len.toFixed(1),seg:+seg.toFixed(1),duration:+cycle.toFixed(2),delay:+(-rand()*cycle).toFixed(2),
        opacity:+(.7+rand()*.25).toFixed(2),width:+(1.6+rand()*1.2).toFixed(2)});
    }
    return{width,height,phone,lines};
  }

  const fields=new WeakMap();
  function draw(host,options){
    const width=Math.max(1,Math.round(host.clientWidth)),height=Math.max(1,Math.round(host.clientHeight));
    const mobile=options.mobile??!!g.matchMedia?.('(max-width:700px)').matches;
    const plan=layout(width,height,{...options,mobile});
    const field=d.createElement('div');field.className='twField';field.setAttribute('aria-hidden','true');field.setAttribute('data-wind-key',options.key||'');
    const svg=d.createElementNS(SVGNS,'svg');
    svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('focusable','false');svg.setAttribute('aria-hidden','true');
    for(const line of plan.lines){
      for(const cls of ['twBase','twGlow','twStreak']){
        const p=d.createElementNS(SVGNS,'path');p.setAttribute('class',cls);p.setAttribute('d',line.d);
        if(cls!=='twBase'){
          const vars={'--len':`${line.len}px`,'--seg':`${line.seg}px`,'--d':`${line.duration}s`,'--delay':`${line.delay}s`,
            '--o':String(cls==='twGlow'?+(line.opacity*.32).toFixed(2):line.opacity),'--w':`${cls==='twGlow'?line.width*3.2:line.width}px`};
          for(const[k,v]of Object.entries(vars))p.style.setProperty(k,v);
        }
        svg.appendChild(p);
      }
    }
    field.appendChild(svg);
    return{field,plan};
  }

  function render(host,options={}){
    if(!host||!d)return null;
    clear(host);
    const state={size:'',timer:0,observer:null,field:null,plan:null};
    const paint=()=>{
      const size=`${host.clientWidth}x${host.clientHeight}`;
      if(size===state.size)return;
      state.size=size;
      const next=draw(host,options);
      if(state.field)state.field.replaceWith(next.field);else host.appendChild(next.field);
      state.field=next.field;state.plan=next.plan;
    };
    paint();
    if(g.ResizeObserver){state.observer=new g.ResizeObserver(()=>{g.clearTimeout(state.timer);state.timer=g.setTimeout(paint,200);});state.observer.observe(host);}
    fields.set(host,state);
    return state.plan;
  }
  function clear(host){
    const state=host&&fields.get(host);
    if(!state)return;
    g.clearTimeout(state.timer);state.observer?.disconnect();state.field?.remove();fields.delete(host);
  }

  g.EvertaleWind=Object.freeze({render,clear,layout,limits:LIMITS});
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
