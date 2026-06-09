/* catalog-v2-lite.js — lightweight renderer for test-catalog-v2. */
(function(){
  const state={items:[],filtered:[],q:'',type:'all',rendered:0,token:0};
  const $=id=>document.getElementById(id);
  const safe=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const pick=(...vals)=>{for(const v of vals){if(v!==undefined&&v!==null&&v!=='')return v;}return''};
  const clean=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const famKey=v=>clean(String(v||'').replace(/\d+$/,''));
  const strip=v=>String(v||'').split('/').pop().replace(/\.json$/i,'').replace(/^\d+_/,'');
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:''};
  const val=(e,raw,k,...f)=>num(pick(e?.stats?.[k],e?.[k],...f));
  const order=e=>num(pick(e?.fileHandleOrder,e?.sourceOrder,e?.order,e?.visualOrder,e?.raw?.bundleNumber));
  const file=e=>String(e?._bundleSourceFile||e?.file||e?.path||'').replace(/^\.\//,'');
  const attrJson=v=>{try{return safe(encodeURIComponent(JSON.stringify(v||[])))}catch{return''}};
  const idle=fn=>('requestIdleCallback'in window?requestIdleCallback(fn,{timeout:110}):setTimeout(fn,24));
  async function readJson(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():{}}catch{return{}}}
  function elClass(el){const e=clean(el);if(['fire','flame'].includes(e))return'el-fire';if(['water','ice'].includes(e))return'el-water';if(['storm','air','wind','thunder','lightning','electric'].includes(e))return'el-storm';if(['earth','terra','ground'].includes(e))return'el-earth';if(['light','life','holy'].includes(e))return'el-light';if(['dark','death','shadow'].includes(e))return'el-dark';return e?`el-${e}`:'';}
  function displayEl(el){const raw=String(el||'').trim();return raw?raw.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'';}
  function kindLabel(k){return k==='characters'?'Character':k==='weapons'?'Weapon':k==='accessories'?'Accessory':k==='bosses'?'Boss':k;}
  function skillRows(e,type){const key=type==='active'?'activeSkills':'passiveSkillDetails';if(Array.isArray(e?.[key]))return e[key];const src=type==='active'?e?.resolved?.activeSkills:e?.resolved?.passives;const out=[];if(src&&typeof src==='object'){for(const [id,d]of Object.entries(src)){const loc=d?.localization||{};out.push({id,name:loc.name||id,description:loc.description||'',tu:d?.tu,sp:d?.sp});}}return out;}
  function charImgs(u){const raw=Array.isArray(u.imageVariants)?u.imageVariants.map(v=>v&&v.url):Array.isArray(u.imagesLarge)?u.imagesLarge:(u.image?[u.image]:[]);return [...new Set((raw||[]).filter(Boolean))].slice(0,3);}
  function base(kind,e){const raw=e?.raw||{};const sourceId=String(e?.sourceId??e?.internal?.sourceId??e?.internal?.weaponId??e?.internal?.bossId??raw.name??e?.name??e?.id??'');return{kind,id:String(e?.id??e?.family??sourceId),sourceId,family:String(e?.family??e?.internal?.family??raw.family??strip(sourceId)),file:file(e),order:order(e),name:pick(e?.displayName,e?.title,e?.name,sourceId),subtitle:pick(e?.weaponType,raw.weaponPref,e?.category,e?.subtitle,kindLabel(kind)),description:pick(e?.description,e?.flavorText,e?.profile,e?.effect,raw.profile,''),rarity:pick(e?.rarity,e?.stars,raw.stars,raw.accessoryStars,''),element:displayEl(pick(e?.element,raw.element,'')),stats:{atk:val(e,raw,'atk',raw.flatAttack,raw.baseAttack,raw.attack),hp:val(e,raw,'hp',raw.flatMaxHp,raw.baseMaxHp,raw.hp),spd:val(e,raw,'spd',raw.flatSpeed,raw.speed),cost:val(e,raw,'cost',raw.cost)},activeSkills:skillRows(e,'active'),passiveSkillDetails:skillRows(e,'passive'),descriptionByForm:Array.isArray(e?.descriptionByForm)?e.descriptionByForm:[],leaderSkillName:pick(e?.leaderSkill?.name,''),leaderSkillDesc:pick(e?.leaderSkill?.description,'')};}
  function normalize(entries){
    const chars=(entries.characters||[]).map(e=>({...base('characters',e),name:pick(e.name,e.family,e.sourceId),subtitle:pick(e.title,e.subtitle,''),image:pick(e.image,charImgs(e)[0],''),images:charImgs(e)}));
    const weapons=(entries.weapons||[]).map(e=>{const x=base('weapons',e);return{...x,image:pick(e.image,x.sourceId?`https://ik.imagekit.io/r8fsa98s9/weapons/${x.sourceId}.png`:'')}});
    const accessories=(entries.accessories||[]).map(e=>{const x=base('accessories',e);return{...x,image:pick(e.image,x.sourceId?`https://ik.imagekit.io/r8fsa98s9/accessories/${x.sourceId}.png`:'')}});
    const bosses=(entries.bosses||[]).map(e=>{const x=base('bosses',e);return{...x,image:pick(e.image,x.sourceId?`https://ik.imagekit.io/r8fsa98s9/characters/${x.sourceId.replace(/Boss(?=\d+$)/,'')}.png`:'')}});
    return [...chars.sort((a,b)=>Number(b.order||0)-Number(a.order||0)),...weapons.sort((a,b)=>Number(b.order||0)-Number(a.order||0)),...accessories.sort((a,b)=>Number(a.order||999999)-Number(b.order||999999)),...bosses.sort((a,b)=>Number(a.order||999999)-Number(b.order||999999))].filter(x=>x.id&&x.name);
  }
  function itemKeys(item){return [item.id,item.sourceId,item.family,item.name,item.subtitle].flatMap(v=>[famKey(v),clean(v)]).filter(Boolean);}
  async function loadDuoRegistry(){
    const [duo,display]=await Promise.all([readJson('./apkfiles/Duo.json'),readJson('./apkfiles/DuoDisplay.json')]);
    const childToParent=new Map(), parents=new Set();
    const add=(p,c)=>{const pk=famKey(p),ck=famKey(c);if(!pk||!ck||pk===ck)return;parents.add(pk);childToParent.set(ck,pk);};
    Object.entries(duo?.directSpecificLinks||{}).forEach(([p,children])=>Array.isArray(children)&&children.forEach(c=>add(p,c)));
    Object.entries(display?.parentCards||{}).forEach(([p,cfg])=>(Array.isArray(cfg?.children)?cfg.children:[]).forEach(c=>add(p,c)));
    return {childToParent,parents};
  }
  function registryRole(item,registry){
    for(const k of itemKeys(item)){if(registry.parents.has(k))return{role:'parent',root:k};}
    for(const k of itemKeys(item)){if(registry.childToParent.has(k))return{role:'child',root:registry.childToParent.get(k)};}
    return null;
  }
  function applyDuoRegistry(items,registry){
    const groups=new Map();
    const roles=new Map();
    items.forEach(item=>{if(item.kind!=='characters')return;const role=registryRole(item,registry);if(!role)return;roles.set(item,role);if(!groups.has(role.root))groups.set(role.root,{parent:null,children:[]});const g=groups.get(role.root);if(role.role==='parent'&&!g.parent)g.parent=item;else g.children.push(item);});
    const out=[];
    const emitted=new Set();
    for(const item of items){
      const role=roles.get(item);
      if(!role){out.push(item);continue;}
      const group=groups.get(role.root);
      if(role.role==='child')continue;
      if(emitted.has(role.root))continue;
      emitted.add(role.root);
      const parent=group.parent||item;
      const forms=[parent,...group.children].filter(Boolean);
      parent.duoForms=forms.map(f=>({...f,duoForms:undefined}));
      out.push(parent);
    }
    window.__EVERTALE_V2_DUO_DATA_REPORT={parents:groups.size,children:Array.from(groups.values()).reduce((n,g)=>n+g.children.length,0),itemsBefore:items.length,itemsAfter:out.length};
    return out;
  }
  function stateBtns(imgs){if(!Array.isArray(imgs)||imgs.length<2)return'';const enc=attrJson(imgs.slice(0,3));return`<div class="stateRow" data-imgs="${enc}">${imgs.slice(0,3).map((_,i)=>`<button type="button" class="stateBtn ${i===0?'active':''}" data-idx="${i}" aria-label="State ${i+1}"></button>`).join('')}</div>`;}
  function duoBtn(item){if(!Array.isArray(item.duoForms)||item.duoForms.length<2)return'';const names=[...new Set(item.duoForms.map(f=>String(f.name||'').replace(/\s*[-–—].*$/,'').trim()).filter(Boolean))];const label=names.length>1?names.slice(0,2).join(' / '):(names[0]||'Forms');return`<button type="button" class="duoFormBtn" data-duo-index="0" data-duo-forms="${attrJson(item.duoForms)}">${safe(label)} 1/${item.duoForms.length}</button>`;}
  function card(item){
    const imgs=item.images?.length?item.images:(item.image?[item.image]:[]);const img=imgs[0]?`<img src="${safe(imgs[0])}" loading="lazy" decoding="async" fetchpriority="low" data-imgs="${attrJson(imgs)}" data-state="0" alt="${safe(item.name)}">`:'<div class="ph">?</div>';
    const chips=[`<span class="tag kind">${kindLabel(item.kind)}</span>`];if(item.element)chips.push(`<span class="tag element">${safe(item.element)}</span>`);if(item.rarity)chips.push(`<span class="tag rarity">${safe(item.rarity)}</span>`);
    const statHtml=Object.entries(item.stats||{}).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>`<div class="stat" data-stat="${k}"><span class="statLabel">${k.toUpperCase()}</span><span class="statVal">${safe(v)}</span></div>`).join('');
    const leader=item.kind==='characters'&&(item.leaderSkillName||item.leaderSkillDesc)?`<div class="leaderBlock"><div class="leaderName">${safe(item.leaderSkillName||'No Leader Skill')}</div><div class="leaderDesc">${safe(item.leaderSkillDesc||'This unit does not provide a leader skill.')}</div></div>`:'';
    return `<div class="unitCard ${elClass(item.element)}" data-kind="${item.kind}" data-id="${safe(item.id)}" data-source-id="${safe(item.sourceId)}" data-family="${safe(item.family)}" data-file="${safe(item.file)}" data-order="${safe(item.order)}" data-source-order="${safe(item.order)}" data-file-handle-order="${safe(item.order)}" data-active-skills="${attrJson(item.activeSkills)}" data-passive-skills="${attrJson(item.passiveSkillDetails)}"><div class="unitLeft"><div class="unitThumb">${img}</div></div><div class="meta"><div class="metaHeader"><div class="metaMain"><div class="nameBlock"><div class="unitName">${safe(item.name)}</div><div class="unitTitle" style="display:block!important;visibility:visible!important;opacity:1!important">${safe(item.subtitle)}</div></div>${item.kind==='characters'?stateBtns(imgs):''}${duoBtn(item)}</div><div class="chipCol">${chips.join('')}</div></div><div class="unitDetails">${statHtml?`<div class="statLine">${statHtml}</div>`:''}${leader}<div class="descriptionPanel" data-descriptions="${attrJson(item.descriptionByForm)}" hidden></div></div></div></div>`;
  }
  function filter(){const q=state.q.toLowerCase();let rows=state.items;if(state.type!=='all')rows=rows.filter(i=>i.kind===state.type);if(!q)return rows;return rows.filter(i=>`${i.name} ${i.subtitle} ${i.description} ${i.rarity} ${i.element} ${i.kind} ${i.sourceId}`.toLowerCase().includes(q));}
  function render(){const grid=$('catalogGrid'),status=$('statusText');if(!grid)return;const token=++state.token;state.filtered=filter();state.rendered=0;grid.innerHTML='';if(status)status.textContent=`${state.filtered.length} items shown`;renderMore(token,24);}
  function renderMore(token,count=32){const grid=$('catalogGrid');if(!grid||token!==state.token)return;if(document.hidden){setTimeout(()=>renderMore(token,count),250);return;}const start=state.rendered,end=Math.min(start+count,state.filtered.length);if(end<=start)return;grid.insertAdjacentHTML('beforeend',state.filtered.slice(start,end).map(card).join(''));state.rendered=end;if(end<state.filtered.length)idle(()=>renderMore(token,32));}
  function readSkills(card,type){let rows=[];try{rows=JSON.parse(decodeURIComponent(card?.getAttribute(type==='active'?'data-active-skills':'data-passive-skills')||''))}catch{}return (Array.isArray(rows)?rows:[]).map(s=>({name:s.name||s.id||'Unnamed Skill',meta:[s.tu?`${s.tu} TU`:'',s.sp!==undefined?`${Number(s.sp)>0?'+':''}${s.sp} SP`:''].filter(Boolean).join(' • '),desc:s.description||''}));}
  function closeCardSkillPanels(except){document.querySelectorAll('.unitCard.v2-skill-open').forEach(c=>{if(c!==except)c.classList.remove('v2-skill-open');});document.querySelectorAll('.v2-card-skill-panel').forEach(p=>{if(!except||!except.contains(p))p.hidden=true;});}
  function openSkills(type){const card=document.querySelector('.unitCard.v2-selected')||document.querySelector('.unitCard');if(!card)return false;const rows=readSkills(card,type);const details=card.querySelector('.unitDetails')||card;let panel=card.querySelector('.v2-card-skill-panel');if(!panel){details.insertAdjacentHTML('beforeend','<div class="v2-card-skill-panel" hidden><div class="v2-card-skill-head"><h3 class="v2-card-skill-title"></h3><button type="button" class="v2-card-skill-close" aria-label="Close skill details">×</button></div><div class="v2-card-skill-list"></div></div>');panel=card.querySelector('.v2-card-skill-panel');panel.querySelector('.v2-card-skill-close')?.addEventListener('click',()=>{panel.hidden=true;card.classList.remove('v2-skill-open');});}const title=type==='active'?'Active Skills':'Passive Skills';panel.querySelector('.v2-card-skill-title').textContent=title;panel.querySelector('.v2-card-skill-list').innerHTML=rows.length?rows.map(s=>`<div class="v2-card-skill-item"><strong>${safe(s.name)}</strong>${s.meta?`<span>${safe(s.meta)}</span>`:''}<p>${safe(s.desc)||'No description loaded.'}</p></div>`).join(''):`<div class="v2-card-skill-item"><strong>No ${title}</strong><p>No ${title.toLowerCase()} were found on this entry.</p></div>`;const wasOpen=!panel.hidden&&card.classList.contains('v2-skill-open')&&panel.dataset.type===type;closeCardSkillPanels(card);panel.dataset.type=type;panel.hidden=wasOpen;card.classList.toggle('v2-skill-open',!wasOpen);if(!wasOpen)card.scrollIntoView({behavior:'smooth',block:'nearest'});return true;}
  function swapDuo(card,forms,next){const item={...forms[next],duoForms:forms};const wrap=document.createElement('div');wrap.innerHTML=card(item);const fresh=wrap.firstElementChild;if(!fresh)return;card.innerHTML=fresh.innerHTML;card.className=fresh.className;for(const attr of [...fresh.attributes])card.setAttribute(attr.name,attr.value);const btn=card.querySelector('.duoFormBtn');if(btn){btn.dataset.duoIndex=String(next);btn.textContent=btn.textContent.replace(/\d+\/\d+$/,`${next+1}/${forms.length}`);}}
  function attach(){const grid=$('catalogGrid');if(!grid)return;document.addEventListener('click',e=>{const btn=e.target.closest('[data-v2-skill]');if(btn&&openSkills(btn.getAttribute('data-v2-skill'))){e.preventDefault();e.stopImmediatePropagation();}},true);grid.addEventListener('error',e=>{if(e.target&&e.target.tagName==='IMG'){e.target.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'?'}));}},true);grid.addEventListener('click',e=>{const duo=e.target.closest('.duoFormBtn');if(duo){const card=e.target.closest('.unitCard');let forms=[];try{forms=JSON.parse(decodeURIComponent(duo.dataset.duoForms||''))}catch{}if(card&&forms.length>1){const next=(Number(duo.dataset.duoIndex||0)+1)%forms.length;swapDuo(card,forms,next);card.classList.add('v2-selected');}return;}const card=e.target.closest('.unitCard');if(card){document.querySelectorAll('.unitCard.v2-selected').forEach(c=>c.classList.remove('v2-selected'));card.classList.add('v2-selected');}const btn=e.target.closest('.stateBtn');if(!btn)return;const row=btn.closest('.stateRow'),img=card?.querySelector('.unitThumb img');let imgs=[];try{imgs=JSON.parse(decodeURIComponent(row?.dataset.imgs||''))}catch{}const idx=Number(btn.dataset.idx||0);if(!img||!imgs[idx])return;img.src=imgs[idx];img.dataset.state=String(idx);row.querySelectorAll('.stateBtn').forEach((b,i)=>b.classList.toggle('active',i===idx));});}
  async function init(){document.body.classList.add('page-catalog','page-catalog-v2','mobile-compact');const entries=await window.EvertaleData.loadAllEntries();const registry=await loadDuoRegistry();state.items=applyDuoRegistry(normalize(entries),registry);const search=$('catalogSearch'),type=$('catalogType'),view=$('viewToggle');if(view)view.textContent='View: Compact';search?.addEventListener('input',()=>{clearTimeout(search._t);search._t=setTimeout(()=>{state.q=search.value||'';render();},140);});type?.addEventListener('change',()=>{state.type=type.value||'all';render();});render();attach();}
  document.addEventListener('DOMContentLoaded',()=>init().catch(err=>{console.error(err);const s=$('statusText');if(s)s.textContent=`Error: ${err.message||err}`;}));
})();