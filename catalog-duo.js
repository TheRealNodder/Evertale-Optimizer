/* catalog-duo.js — post-render collapse for duo/summon/switch/transform catalog cards.
   Runs after catalog.js/catalog-sort.js so it works with the current page renderer.
*/
(function(){
  const DISPLAY_URL='./apkfiles/DuoDisplay.json';
  const DUO_URL='./apkfiles/Duo.json';
  let dataPromise=null;
  let busy=false;
  let timer=null;

  function norm(v){return String(v||'').trim();}
  function scoreText(v){return String(v||'').toLowerCase();}
  function makeUF(){const p=new Map();const f=x=>{x=norm(x);if(!p.has(x))p.set(x,x);const r=p.get(x);if(r!==x)p.set(x,f(r));return p.get(x)};return{p,find:f,union:(a,b)=>{a=norm(a);b=norm(b);if(!a||!b)return;const ra=f(a),rb=f(b);if(ra!==rb)p.set(rb,ra)}}}
  async function j(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}
  function addMap(uf,map){if(!map||typeof map!=='object')return;for(const [a,bs] of Object.entries(map)){if(Array.isArray(bs))bs.forEach(b=>uf.union(a,b));}}

  async function load(){
    if(dataPromise)return dataPromise;
    dataPromise=Promise.all([j(DISPLAY_URL),j(DUO_URL)]).then(([display,duo])=>{
      const uf=makeUF();
      const label=new Map();
      const group=new Map();
      const pc=display?.parentCards||{};
      for(const [parent,cfg] of Object.entries(pc)){
        const kids=Array.isArray(cfg?.children)?cfg.children:[];
        kids.forEach(k=>uf.union(parent,k));
        [parent,...kids].forEach(id=>{if(cfg?.buttonLabel)label.set(norm(id),cfg.buttonLabel);if(cfg?.group)group.set(norm(id),cfg.group);});
      }
      addMap(uf,duo?.directSpecificLinks);
      addMap(uf,duo?.genericHelperSummons);
      addMap(uf,duo?.enemyImposterExchangeUnits);
      addMap(uf,duo?.selfCloneOrDuplicateUnits);
      const groups=new Map();
      for(const id of uf.p.keys()){
        const root=uf.find(id);
        if(!groups.has(root))groups.set(root,new Set());
        groups.get(root).add(id);
      }
      return{groups,label,group};
    });
    return dataPromise;
  }

  function cardId(c){return norm(c?.getAttribute('data-id')||c?.getAttribute('data-unit-id')||'');}
  function cardName(c){return c?.querySelector('.unitName')?.textContent?.trim()||'';}
  function cardTitle(c){return c?.querySelector('.unitTitle')?.textContent?.trim()||'';}
  function payload(c){return{id:cardId(c),html:c.innerHTML,className:c.className,kind:c.getAttribute('data-kind')||'',name:cardName(c),title:cardTitle(c)}}
  function parentScore(c){const id=scoreText(cardId(c));const name=scoreText(cardName(c));const title=scoreText(cardTitle(c));const all=`${id} ${name} ${title}`;let s=0;if(/beautybeast|beauty.*beast|beast.*beauty|beauty\s*&\s*beast/.test(all))s+=1000;if(/snowwhitenew|snow white/.test(all)&&!/black/.test(all))s+=800;if(/regular|new|bride/.test(id))s+=50;if(/&| and /.test(name))s+=90;if(/minion|imposter|clone|rabbit|angel|raven|shadow|doll|summon|shiromori/.test(all))s-=300;return s;}
  function choose(cards){return cards.slice().sort((a,b)=>parentScore(b)-parentScore(a))[0]||cards[0];}
  function firstLabel(ids,data){for(const id of ids){const l=data.label.get(norm(id));if(l)return l;}return'Forms';}
  function installBtn(parent,payloads,label){
    if(parent.querySelector('.duoFormBtn'))return;
    parent.setAttribute('data-duo-parent','true');
    parent.setAttribute('data-duo-index','0');
    const host=parent.querySelector('.metaMain')||parent.querySelector('.metaHeader')||parent.querySelector('.meta')||parent;
    const btn=document.createElement('button');
    btn.type='button';btn.className='duoFormBtn';btn.textContent=label;
    btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      let idx=(parseInt(parent.getAttribute('data-duo-index')||'0',10)+1)%payloads.length;
      const p=payloads[idx];
      parent.innerHTML=p.html;parent.className=p.className;parent.setAttribute('data-kind',p.kind);parent.setAttribute('data-id',p.id);parent.setAttribute('data-duo-parent','true');parent.setAttribute('data-duo-index',String(idx));
      btn.textContent=`${label} ${idx+1}/${payloads.length}`;
      const newHost=parent.querySelector('.metaMain')||parent.querySelector('.metaHeader')||parent.querySelector('.meta')||parent;
      newHost.appendChild(btn);
    });
    host.appendChild(btn);
  }

  async function collapse(){
    if(busy)return;busy=true;
    try{
      const grid=document.getElementById('catalogGrid');
      if(!grid)return;
      const data=await load();
      const cards=Array.from(grid.querySelectorAll('.unitCard[data-kind="characters"]'));
      if(!cards.length)return;
      const byId=new Map(cards.map(c=>[cardId(c),c]).filter(([id])=>id));
      cards.forEach(c=>{c.style.display='';c.hidden=false;c.removeAttribute('data-duo-hidden-child');});
      for(const set of data.groups.values()){
        const ids=Array.from(set);
        const groupCards=ids.map(id=>byId.get(norm(id))).filter(Boolean);
        if(groupCards.length<2)continue;
        const parent=choose(groupCards);
        const ordered=[parent,...groupCards.filter(c=>c!==parent)];
        const payloads=ordered.map(payload);
        const label=firstLabel(ids,data);
        groupCards.forEach(c=>{if(c!==parent){c.hidden=true;c.style.display='none';c.setAttribute('data-duo-hidden-child','true');}});
        installBtn(parent,payloads,label);
      }
    }finally{busy=false;}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>collapse().catch(console.warn),150);}
  function css(){if(document.getElementById('catalogDuoStyle'))return;const s=document.createElement('style');s.id='catalogDuoStyle';s.textContent='.duoFormBtn{margin-top:6px;border:1px solid rgba(255,255,255,.22);background:rgba(28,224,154,.12);color:var(--text,#f6f7ff);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;cursor:pointer}.duoFormBtn:hover{background:rgba(28,224,154,.2)}.unitCard[data-duo-parent="true"]{outline:1px solid rgba(28,224,154,.35)}.unitCard[data-duo-hidden-child="true"]{display:none!important}';document.head.appendChild(s);}
  document.addEventListener('DOMContentLoaded',()=>{css();schedule();const grid=document.getElementById('catalogGrid');if(grid)new MutationObserver(schedule).observe(grid,{childList:true});['catalogSearch','catalogType','catalogSort'].forEach(id=>document.getElementById(id)?.addEventListener('input',schedule));['catalogType','catalogSort'].forEach(id=>document.getElementById(id)?.addEventListener('change',schedule));});
})();
