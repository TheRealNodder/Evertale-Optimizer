/* catalog-duo.js — post-render collapse for duo/summon/switch/transform catalog cards.
   Runs after catalog render and maps APK source IDs to rendered catalog family IDs.
   Important: direct/switch/transform links may connect groups, but generic summons stay parent-scoped.
*/
(function(){
  const DISPLAY_URL='./apkfiles/DuoDisplay.json';
  const DUO_URL='./apkfiles/Duo.json';
  const FAMILY_BUNDLE_URL='./apkfiles/entries/bundles/character_families.bundle.json';
  let dataPromise=null;
  let busy=false;
  let timer=null;

  function norm(v){return String(v||'').trim();}
  function key(v){return norm(v).toLowerCase();}
  function scoreText(v){return String(v||'').toLowerCase();}
  function stripFormSuffix(v){return norm(v).replace(/\d+$/,'');}
  function makeUF(){const p=new Map();const f=x=>{x=norm(x);if(!p.has(x))p.set(x,x);const r=p.get(x);if(r!==x)p.set(x,f(r));return p.get(x)};return{p,find:f,union:(a,b)=>{a=norm(a);b=norm(b);if(!a||!b)return;const ra=f(a),rb=f(b);if(ra!==rb)p.set(rb,ra)}}}
  async function j(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():null}catch{return null}}

  function addAlias(alias, keyValue, value){
    const k=norm(keyValue), v=norm(value);
    if(!k||!v)return;
    if(!alias.has(k))alias.set(k,v);
    if(!alias.has(key(k)))alias.set(key(k),v);
  }
  function buildAlias(bundle){
    const alias=new Map();
    const rows=Array.isArray(bundle?.entries)?bundle.entries:[];
    for(const row of rows){
      const family=norm(row?.family);
      if(!family)continue;
      addAlias(alias,family,family);
      addAlias(alias,row?.name,family);
      addAlias(alias,row?.image?.split('/').pop()?.replace(/\.png$/i,''),family);
      (Array.isArray(row?.rawFormSourceIds)?row.rawFormSourceIds:[]).forEach(src=>{
        addAlias(alias,src,family);
        addAlias(alias,stripFormSuffix(src),family);
      });
      (Array.isArray(row?.states)?row.states:[]).forEach(st=>{
        addAlias(alias,st?.sourceId,family);
        addAlias(alias,st?.dataSourceId,family);
        addAlias(alias,stripFormSuffix(st?.sourceId),family);
        addAlias(alias,stripFormSuffix(st?.dataSourceId),family);
        addAlias(alias,st?.name,family);
      });
    }
    return alias;
  }
  function canonical(alias,id){id=norm(id);return alias.get(id)||alias.get(key(id))||alias.get(stripFormSuffix(id))||alias.get(key(stripFormSuffix(id)))||id}
  function addConnectedMap(uf,map,alias){if(!map||typeof map!=='object')return;for(const [a,bs] of Object.entries(map)){if(Array.isArray(bs))bs.forEach(b=>uf.union(canonical(alias,a),canonical(alias,b)));}}
  function addDirectedGroups(out,map,alias,label){
    if(!map||typeof map!=='object')return;
    for(const [a,bs] of Object.entries(map)){
      if(!Array.isArray(bs)||!bs.length)continue;
      const ids=[canonical(alias,a),...bs.map(b=>canonical(alias,b))].filter(Boolean);
      const unique=Array.from(new Set(ids));
      if(unique.length>1)out.push({ids:unique,label});
    }
  }

  async function load(){
    if(dataPromise)return dataPromise;
    dataPromise=Promise.all([j(DISPLAY_URL),j(DUO_URL),j(FAMILY_BUNDLE_URL)]).then(([display,duo,bundle])=>{
      const alias=buildAlias(bundle);
      const uf=makeUF();
      const label=new Map();
      const group=new Map();
      const directedGroups=[];
      const pc=display?.parentCards||{};

      for(const [parent,cfg] of Object.entries(pc)){
        const p=canonical(alias,parent);
        const kids=Array.isArray(cfg?.children)?cfg.children:[];
        kids.forEach(k=>uf.union(p,canonical(alias,k)));
        [p,...kids.map(k=>canonical(alias,k))].forEach(id=>{if(cfg?.buttonLabel)label.set(norm(id),cfg.buttonLabel);if(cfg?.group)group.set(norm(id),cfg.group);});
      }
      addConnectedMap(uf,duo?.directSpecificLinks,alias);

      const connectedGroups=[];
      const grouped=new Map();
      for(const id of uf.p.keys()){
        const root=uf.find(id);
        if(!grouped.has(root))grouped.set(root,new Set());
        grouped.get(root).add(id);
      }
      for(const set of grouped.values()){
        const ids=Array.from(set).filter(Boolean);
        if(ids.length>1)connectedGroups.push({ids,label:null});
      }

      addDirectedGroups(directedGroups,duo?.genericHelperSummons,alias,'Summon');
      addDirectedGroups(directedGroups,duo?.enemyImposterExchangeUnits,alias,'Exchange');
      addDirectedGroups(directedGroups,duo?.selfCloneOrDuplicateUnits,alias,'Clone');

      return{groups:[...connectedGroups,...directedGroups],label,group,alias};
    });
    return dataPromise;
  }

  function cardId(c){return norm(c?.getAttribute('data-id')||c?.getAttribute('data-unit-id')||'');}
  function cardName(c){return c?.querySelector('.unitName')?.textContent?.trim()||'';}
  function cardTitle(c){return c?.querySelector('.unitTitle')?.textContent?.trim()||'';}
  function payload(c){return{id:cardId(c),html:c.innerHTML,className:c.className,kind:c.getAttribute('data-kind')||'',name:cardName(c),title:cardTitle(c)}}
  function parentScore(c){const id=scoreText(cardId(c));const name=scoreText(cardName(c));const title=scoreText(cardTitle(c));const all=`${id} ${name} ${title}`;let s=0;if(/ludmillaballet|red dragon dancer/.test(all))s+=1400;if(/yanderemaidballet|clarice/.test(all))s+=200;if(/beautybeastregular|beauty.*beast|beast.*beauty|beauty\s*&\s*beast/.test(all))s+=1000;if(/snowwhitenew|snow white/.test(all)&&!/black/.test(all))s+=800;if(/regular|new|bride/.test(id))s+=50;if(/&| and /.test(name))s+=90;if(/minion|imposter|clone|rabbit|angel|raven|shadow|doll|summon|shiromori|belle|aigis/.test(all))s-=300;return s;}
  function choose(cards){return cards.slice().sort((a,b)=>parentScore(b)-parentScore(a))[0]||cards[0];}
  function shortName(text){return norm(text).replace(/\s*[-–—].*$/,'').replace(/\s+/g,' ');}
  function visibleLabel(payloads,label){
    const names=payloads.map(p=>shortName(p.name)).filter(Boolean);
    const unique=Array.from(new Set(names));
    if(unique.length>1)return unique.slice(0,2).join(' / ');
    const titles=payloads.map(p=>shortName(p.title)).filter(Boolean);
    const uniqueTitles=Array.from(new Set(titles));
    if(uniqueTitles.length>1)return uniqueTitles.slice(0,2).join(' / ');
    return unique[0]||label||'Forms';
  }
  function addNamePills(parent,payloads){
    const host=parent.querySelector('.metaMain')||parent.querySelector('.metaHeader')||parent.querySelector('.meta')||parent;
    parent.querySelector('.duoNameRow')?.remove();
    const row=document.createElement('div');
    row.className='duoNameRow';
    const names=Array.from(new Set(payloads.map(p=>shortName(p.name)).filter(Boolean))).slice(0,3);
    names.forEach(n=>{const pill=document.createElement('span');pill.className='duoNameBtn';pill.textContent=n;row.appendChild(pill);});
    if(row.children.length)host.appendChild(row);
  }
  function addLookup(map,id,c){id=norm(id);if(!id)return;map.set(id,c);map.set(key(id),c);map.set(stripFormSuffix(id),c);map.set(key(stripFormSuffix(id)),c);}
  function installBtn(parent,payloads,label){
    if(parent.querySelector('.duoFormBtn'))return;
    parent.setAttribute('data-duo-parent','true');
    parent.setAttribute('data-duo-index','0');
    const host=parent.querySelector('.metaMain')||parent.querySelector('.metaHeader')||parent.querySelector('.meta')||parent;
    const btn=document.createElement('button');
    btn.type='button';btn.className='duoFormBtn';btn.textContent=visibleLabel(payloads,label);
    addNamePills(parent,payloads);
    btn.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      let idx=(parseInt(parent.getAttribute('data-duo-index')||'0',10)+1)%payloads.length;
      const p=payloads[idx];
      parent.innerHTML=p.html;parent.className=p.className;parent.setAttribute('data-kind',p.kind);parent.setAttribute('data-id',p.id);parent.setAttribute('data-duo-parent','true');parent.setAttribute('data-duo-index',String(idx));
      btn.textContent=`${visibleLabel(payloads,label)} ${idx+1}/${payloads.length}`;
      const newHost=parent.querySelector('.metaMain')||parent.querySelector('.metaHeader')||parent.querySelector('.meta')||parent;
      newHost.appendChild(btn);
      addNamePills(parent,payloads);
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
      const byId=new Map();
      cards.forEach(c=>{
        c.style.display='';c.hidden=false;c.removeAttribute('data-duo-hidden-child');
        addLookup(byId,cardId(c),c);
        addLookup(byId,c.getAttribute('data-source-id'),c);
        addLookup(byId,c.getAttribute('data-family'),c);
        addLookup(byId,cardName(c),c);
      });
      const childCardsToHide=new Set();
      const parentPayloads=[];

      for(const group of data.groups){
        const ids=Array.from(group.ids||[]).filter(Boolean);
        const groupCards=Array.from(new Set(ids.map(id=>byId.get(norm(id))||byId.get(key(id))).filter(Boolean)));
        if(groupCards.length<2)continue;
        const parent=choose(groupCards);
        const ordered=[parent,...groupCards.filter(c=>c!==parent)];
        const payloads=ordered.map(payload);
        parentPayloads.push({parent,payloads,label:group.label});
        groupCards.forEach(c=>{if(c!==parent)childCardsToHide.add(c);});
      }

      childCardsToHide.forEach(c=>{c.hidden=true;c.style.display='none';c.setAttribute('data-duo-hidden-child','true');});
      parentPayloads.forEach(({parent,payloads,label})=>installBtn(parent,payloads,label));
    }finally{busy=false;}
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(()=>collapse().catch(console.warn),150);}
  function css(){if(document.getElementById('catalogDuoStyle'))return;const s=document.createElement('style');s.id='catalogDuoStyle';s.textContent='.duoFormBtn{margin-top:6px;border:1px solid rgba(255,255,255,.22);background:rgba(28,224,154,.12);color:var(--text,#f6f7ff);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;cursor:pointer}.duoFormBtn:hover{background:rgba(28,224,154,.2)}.unitCard[data-duo-parent="true"]{outline:1px solid rgba(28,224,154,.35)}.unitCard[data-duo-hidden-child="true"]{display:none!important}';document.head.appendChild(s);}
  document.addEventListener('DOMContentLoaded',()=>{css();schedule();const grid=document.getElementById('catalogGrid');if(grid)new MutationObserver(schedule).observe(grid,{childList:true,subtree:false});['catalogSearch','catalogType','catalogSort'].forEach(id=>document.getElementById(id)?.addEventListener('input',schedule));['catalogType','catalogSort'].forEach(id=>document.getElementById(id)?.addEventListener('change',schedule));});
})();
