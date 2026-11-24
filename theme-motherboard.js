/* Full-page motherboard for technology themes.
   One static, deterministic SVG (traces, vias, pads, chips, transistors, passives) drawn
   1:1 in host pixels and kept softly energized, plus a few HTML pulse packets that move along
   chosen traces with transform/opacity keyframes only. No render loop: the board is redrawn
   only when the host size changes. */
(function(g,d){
  'use strict';
  const SVGNS='http://www.w3.org/2000/svg';
  const LIMITS={desktop:{pulses:12,cell:40},phone:{pulses:5,cell:32}};

  function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function random(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  const fx=n=>Math.round(n*10)/10;
  const circle=(x,y,r)=>`M${fx(x-r)} ${fx(y)}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0`;
  const rect=(x,y,w,h)=>`M${fx(x)} ${fx(y)}h${fx(w)}v${fx(h)}h${fx(-w)}z`;
  const line=points=>points.map(([x,y],i)=>`${i?'L':'M'}${fx(x)} ${fx(y)}`).join('');
  const length=points=>points.slice(1).reduce((sum,[x,y],i)=>sum+Math.hypot(x-points[i][0],y-points[i][1]),0);

  /* Orthogonal run with one 45 degree chamfer, the classic PCB trace shape. */
  function route(a,b,horizontalFirst){
    const dx=b[0]-a[0],dy=b[1]-a[1];
    if(!dx||!dy)return[a,b];
    if(horizontalFirst&&Math.abs(dx)>Math.abs(dy))return[a,[b[0]-Math.sign(dx)*Math.abs(dy),a[1]],b];
    if(!horizontalFirst&&Math.abs(dy)>Math.abs(dx))return[a,[a[0],b[1]-Math.sign(dy)*Math.abs(dx)],b];
    const bend=Math.min(Math.abs(dx),Math.abs(dy));
    return horizontalFirst?[a,[a[0]+Math.sign(dx)*bend,a[1]+Math.sign(dy)*bend],b]:[a,[a[0]+Math.sign(dx)*bend,a[1]+Math.sign(dy)*bend],b];
  }

  /* Miraidon only: coordinated charge along the existing PCB geometry. */
  function hadronCycle(pulses,width,height,phone){
    if(!pulses.length)return{cycle:16,nodes:[]};
    const speed=phone?125:180;
    const cycle=Math.ceil(Math.max(16,...pulses.map(p=>p.length/speed/.52))*100)/100;
    const nodes=[],margin=phone?18:24,cap=phone?1:2;
    pulses.forEach((p,i)=>{
      p.duration=cycle;p.delay=-cycle*.18;p.start=12+(i%5)*4;
      p.end=p.start+100*p.length/speed/cycle;
      if(nodes.length>=cap)return;
      const pts=p.reverse?[...p.points].reverse():p.points;
      let travelled=0;
      for(let k=1;k<pts.length;k++){
        const a=pts[k-1],b=pts[k],leg=Math.hypot(b[0]-a[0],b[1]-a[1]);
        travelled+=leg;
        if(leg<18||b[0]<margin||b[0]>width-margin||b[1]<margin||b[1]>height-margin||
           nodes.some(n=>Math.hypot(n.x-b[0],n.y-b[1])<margin*2))continue;
        const fraction=Math.min(1,34/leg);
        const from=[b[0]+(a[0]-b[0])*fraction,b[1]+(a[1]-b[1])*fraction];
        nodes.push({pulse:i,waypoint:k,x:b[0],y:b[1],from,to:b,
          at:p.start+(p.end-p.start)*travelled/p.length});
        break;
      }
    });
    return{cycle,nodes};
  }

  /* Pure layout: returns path data and pulse routes for a w x h board. Exposed for tests. */
  function layout(width,height,options={}){
    const phone=!!options.mobile,limits=phone?LIMITS.phone:LIMITS.desktop,cell=limits.cell;
    const rand=random(hash(`${options.key||'board'}:${options.seed||0}:${phone}`));
    const cols=Math.max(4,Math.floor(width/cell)),rows=Math.max(4,Math.floor(height/cell));
    const used=Array.from({length:rows},()=>new Uint8Array(cols));
    const free=(c,r,w,h)=>{if(c<1||r<1||c+w>=cols-1||r+h>=rows-1)return false;for(let y=r-1;y<=r+h;y++)for(let x=c-1;x<=c+w;x++)if(used[y][x])return false;return true;};
    const take=(c,r,w,h)=>{for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)used[y][x]=1;};
    const at=(c,r)=>[c*cell+cell/2,r*cell+cell/2];
    const parts=[],pads=[],vias=[],ports=[];
    const traces=[[],[],[]];
    const area=width*height;

    /* Chips: outlined packages with pin rows and an orientation notch. */
    const chipTarget=Math.max(2,Math.min(phone?4:10,Math.round(area/(phone?140000:170000))));
    for(let tries=0,placed=0;placed<chipTarget&&tries<chipTarget*40;tries++){
      const w=3+Math.floor(rand()*(phone?2:4)),h=2+Math.floor(rand()*(phone?2:3));
      const c=1+Math.floor(rand()*(cols-w-2)),r=1+Math.floor(rand()*(rows-h-2));
      if(!free(c,r,w,h))continue;take(c,r,w,h);placed++;
      const x=c*cell+6,y=r*cell+6,pw=w*cell-12,ph=h*cell-12;
      parts.push(rect(x,y,pw,ph),circle(x+9,y+9,3));
      const pitch=phone?9:10,pinsX=Math.max(2,Math.floor((pw-12)/pitch));
      for(let i=0;i<pinsX;i++){
        const px=x+8+i*pitch;
        parts.push(`M${fx(px)} ${fx(y)}v-6M${fx(px)} ${fx(y+ph)}v6`);
        if(i%3===1){ports.push([px,y-6],[px,y+ph+6]);}
      }
      if(w>=4){
        const pinsY=Math.max(2,Math.floor((ph-12)/pitch));
        for(let i=0;i<pinsY;i++){const py=y+8+i*pitch;parts.push(`M${fx(x)} ${fx(py)}h-6M${fx(x+pw)} ${fx(py)}h6`);if(i%2===1)ports.push([x-6,py],[x+pw+6,py]);}
      }
    }

    /* Discrete components: TO-92 and SMD transistors, resistors and capacitors (outlines). */
    const smallTarget=Math.max(4,Math.round(chipTarget*(phone?2:3)));
    for(let tries=0,placed=0;placed<smallTarget&&tries<smallTarget*30;tries++){
      const c=1+Math.floor(rand()*(cols-3)),r=1+Math.floor(rand()*(rows-3));
      if(!free(c,r,1,1))continue;take(c,r,1,1);placed++;
      const [cx,cy]=at(c,r),kind=Math.floor(rand()*4);
      if(kind===0){ /* through-hole transistor: flat face, rounded back, three leads */
        parts.push(`M${fx(cx-7)} ${fx(cy-9)}h14v6a7 6 0 0 1 -14 0z`,`M${fx(cx-4)} ${fx(cy+3)}v9M${fx(cx)} ${fx(cy+3)}v9M${fx(cx+4)} ${fx(cy+3)}v9`);
        pads.push([cx-4,cy+12],[cx,cy+12],[cx+4,cy+12]);ports.push([cx,cy+14]);
      }else if(kind===1){ /* surface-mount transistor: body and three pads */
        parts.push(rect(cx-6,cy-4,12,8));
        pads.push([cx-4,cy-8],[cx+4,cy-8],[cx,cy+8]);ports.push([cx,cy+10]);
      }else if(kind===2){ /* resistor */
        parts.push(rect(cx-9,cy-3.5,18,7),`M${fx(cx-15)} ${fx(cy)}h6M${fx(cx+9)} ${fx(cy)}h6`);
        pads.push([cx-15,cy],[cx+15,cy]);ports.push([cx-17,cy],[cx+17,cy]);
      }else{ /* capacitor */
        parts.push(`M${fx(cx-3)} ${fx(cy-7)}v14M${fx(cx+3)} ${fx(cy-7)}v14M${fx(cx-12)} ${fx(cy)}h9M${fx(cx+3)} ${fx(cy)}h9`);
        pads.push([cx-12,cy],[cx+12,cy]);ports.push([cx-14,cy],[cx+14,cy]);
      }
    }

    /* Signal traces between component ports, plus edge connectors. */
    const all=[];
    const addTrace=(points,width)=>{traces[width].push(points);all.push({points,width,length:length(points)});vias.push(points[0],points[points.length-1]);};
    const snap=v=>Math.round(v/(cell/2))*(cell/2);
    for(let i=0;i<ports.length;i++){
      const a=ports[i];
      if(rand()<.35)continue;
      const b=rand()<.7&&ports.length>1?ports[Math.floor(rand()*ports.length)]:[rand()<.5?0:width,snap(a[1]+(rand()-.5)*cell*6)];
      if(b===a)continue;
      const mid=[snap(a[0]+(b[0]-a[0])*.5),a[1]];
      const pts=[a,mid,...route(mid,b,rand()<.5).slice(1)];
      addTrace(pts.filter((p,k)=>!k||p[0]!==pts[k-1][0]||p[1]!==pts[k-1][1]),rand()<.7?0:1);
    }

    /* Data buses: groups of parallel traces that run long distances and bend together. */
    const buses=phone?2:Math.max(3,Math.round(area/400000));
    for(let b=0;b<buses;b++){
      const lanes=3+Math.floor(rand()*3),gap=7,horizontal=rand()<.6;
      const start=horizontal?[0,snap(rand()*height)]:[snap(rand()*width),0];
      const runA=snap((horizontal?width:height)*(.2+rand()*.35)),drop=snap(cell*(2+Math.floor(rand()*4)))*(rand()<.5?-1:1);
      for(let l=0;l<lanes;l++){
        const o=l*gap;
        const pts=horizontal
          ?[[0,start[1]+o],[runA-o,start[1]+o],[runA-o+Math.abs(drop),start[1]+o+drop],[width,start[1]+o+drop]]
          :[[start[0]+o,0],[start[0]+o,runA-o],[start[0]+o+drop,runA-o+Math.abs(drop)],[start[0]+o+drop,height]];
        addTrace(pts,l===0?2:1);
      }
    }

    /* Pulses: the longest drawn (fully in-bounds) traces carry travelling packets; everything
       else stays energized. Filter to in-bounds BEFORE choosing and capping, and always keep at
       least one packet when any drawn trace exists. */
    const inside=([x,y])=>x>=-1&&y>=-1&&x<=width+1&&y<=height+1;
    const drawn=all.filter(t=>t.points.length>=2&&t.length>0&&t.points.every(inside)).sort((a,b)=>b.length-a.length);
    const long=drawn.filter(t=>t.length>(phone?160:260));
    const candidates=long.length?long:drawn;
    const pulses=[];
    const addPulse=t=>{
      const speed=(phone?90:130)+rand()*70,travel=t.length/speed,cycle=Math.max(3.5,travel/.7);
      pulses.push({points:t.points,length:t.length,duration:+cycle.toFixed(2),delay:+(-rand()*cycle).toFixed(2),reverse:rand()<.5});
    };
    for(const t of candidates){
      if(pulses.length>=limits.pulses)break;
      if(rand()<.25)continue;
      addPulse(t);
    }
    if(!pulses.length&&candidates.length)addPulse(candidates[0]);

    const hadron=options.key==='miraidon'?hadronCycle(pulses,width,height,phone):null;
    return{
      ...(hadron?{hadron}:{}),
      width,height,phone,
      traces:traces.map(list=>list.filter(p=>p.every(inside)).map(line).join('')),
      parts:parts.join(''),
      pads:pads.map(([x,y])=>rect(x-2.5,y-2.5,5,5)).join(''),
      vias:vias.filter(inside).map(([x,y])=>circle(x,y,3)).join(''),
      pulses,
      counts:{chips:chipTarget,traces:all.length,pulses:pulses.length}
    };
  }

  /* Keyframes put the packet on every waypoint at a time proportional to distance travelled.
     Travel uses 70% of the cycle; the packet is invisible for the rest. */
  function keyframes(name,pulse){
    const pts=pulse.reverse?[...pulse.points].reverse():pulse.points;
    const t=p=>`translate(${fx(p[0]-4)}px,${fx(p[1]-4)}px)`;
    const start=pulse.start??4,endAt=pulse.end??70;
    let run=0;const steps=[`0%{transform:${t(pts[0])};opacity:0}`];
    if(pulse.start!==undefined)steps.push(`${(start-2).toFixed(3)}%{transform:${t(pts[0])};opacity:0}`);
    steps.push(`${start}%{transform:${t(pts[0])};opacity:1}`);
    for(let i=1;i<pts.length;i++){run+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);steps.push(`${(start+(endAt-start)*run/pulse.length).toFixed(3)}%{transform:${t(pts[i])};opacity:1}`);}
    const end=t(pts[pts.length-1]);
    steps.push(`${pulse.end===undefined?74:(endAt+4).toFixed(3)}%{transform:${end};opacity:0}`,`100%{transform:${end};opacity:0}`);
    return`@keyframes ${name}{${steps.join('')}}`;
  }

  function hadronFrames(id,node){
    const at=node.at,fmt=v=>v.toFixed(3);
    return [
      `@keyframes ${id}-trace{0%,${fmt(at-3)}%{opacity:0}${fmt(at)}%{opacity:.82}${fmt(at+4)}%,100%{opacity:0}}`,
      `@keyframes ${id}-ring{0%,${fmt(at-2)}%{transform:scale(.35);opacity:0}${fmt(at)}%{transform:scale(.65);opacity:.7}${fmt(at+8)}%,100%{transform:scale(1.3);opacity:0}}`
    ].join('\n');
  }

  const boards=new WeakMap();
  function draw(host,options){
    const width=Math.max(1,Math.round(host.clientWidth)),height=Math.max(1,Math.round(host.clientHeight));
    /* 700px is the shared motion-density breakpoint; the integrator re-renders on bucket changes. */
    const mobile=options.mobile??!!g.matchMedia?.('(max-width:700px)').matches;
    const plan=layout(width,height,{...options,mobile});
    const board=d.createElement('div');board.className='tmbBoard';board.setAttribute('aria-hidden','true');board.setAttribute('data-board-key',options.key||'');
    const svg=d.createElementNS(SVGNS,'svg');
    svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('focusable','false');svg.setAttribute('aria-hidden','true');
    const add=(cls,dpath)=>{if(!dpath)return;const p=d.createElementNS(SVGNS,'path');p.setAttribute('class',cls);p.setAttribute('d',dpath);svg.appendChild(p);};
    plan.traces.forEach((dpath,i)=>add(`tmbGlow tmbW${i}`,dpath));
    plan.traces.forEach((dpath,i)=>add(`tmbLine tmbW${i}`,dpath));
    add('tmbPart',plan.parts);add('tmbPad',plan.pads);add('tmbVia',plan.vias);
    board.appendChild(svg);
    const id=`tmb${hash(`${options.key}:${width}x${height}:${mobile}`).toString(36)}`;
    const style=d.createElement('style');
    style.textContent=plan.pulses.map((pulse,i)=>keyframes(`${id}-${i}`,pulse)).join('\n');
    if(plan.hadron){
      const cycle=plan.hadron.cycle,delay=-cycle*.18;
      plan.hadron.nodes.forEach((n,i)=>{
        const name=`${id}-hadron-${i}`;
        style.textContent+='\n'+hadronFrames(name,n);
        const trace=d.createElementNS(SVGNS,'path');trace.setAttribute('class','tmbHadronTrace');
        trace.setAttribute('d',line([n.from,n.to]));trace.style.animation=`${name}-trace ${cycle}s linear ${delay}s infinite`;svg.appendChild(trace);
        const ring=d.createElement('i');ring.className='tmbHadronRing';
        ring.style.setProperty('left',`${fx(n.x)}px`);ring.style.setProperty('top',`${fx(n.y)}px`);
        ring.style.animation=`${name}-ring ${cycle}s ease-out ${delay}s infinite`;board.appendChild(ring);
      });
    }
    board.appendChild(style);
    plan.pulses.forEach((pulse,i)=>{
      const packet=d.createElement('i');packet.className='tmbPulse';
      packet.style.animation=`${id}-${i} ${pulse.duration}s linear ${pulse.delay}s infinite`;
      board.appendChild(packet);
    });
    return{board,plan};
  }

  function render(host,options={}){
    if(!host)return null;
    clear(host);
    const state={options,board:null,plan:null,size:'',timer:0,observer:null};
    const paint=()=>{
      const size=`${host.clientWidth}x${host.clientHeight}`;
      if(size===state.size)return;
      state.size=size;
      const next=draw(host,options);
      if(state.board)state.board.replaceWith(next.board);else host.appendChild(next.board);
      state.board=next.board;state.plan=next.plan;
    };
    paint();
    if(g.ResizeObserver){
      state.observer=new g.ResizeObserver(()=>{g.clearTimeout(state.timer);state.timer=g.setTimeout(paint,200);});
      state.observer.observe(host);
    }
    boards.set(host,state);
    return state.plan;
  }

  function clear(host){
    const state=host&&boards.get(host);
    if(!state)return;
    g.clearTimeout(state.timer);state.observer?.disconnect();state.board?.remove();boards.delete(host);
  }

  g.EvertaleMotherboard=Object.freeze({render,clear,layout,limits:LIMITS});
})(typeof window!=='undefined'?window:globalThis,typeof document!=='undefined'?document:null);
