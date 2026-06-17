/* catalog-v2-lite.js — live Catalog renderer.
   Layout-safe performance pass: all data stays in memory, cards render progressively without mutating the grid layout.
*/
(function(){
  const state={items:[],filtered:[],q:'',type:'all',sort:'newest',rendered:0,token:0,pageSize:24,selectedId:'',observer:null};
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
  const idle=fn=>('requestIdleCallback'in window?requestIdleCallback(fn,{timeout:180}):setTimeout(fn,32));
  async function readJson(url){try{const r=await fetch(url,{cache:'default'});return r.ok?await r.json():{}}catch{return{}}}
  function installPerfCss(){
    if(document.getElementById('catalog-v2-perf-css'))return;
    const style=document.createElement('style');
    style.id='catalog-v2-perf-css';
    style.textContent=`
      #catalogGrid .unitCard{content-visibility:auto;contain:layout paint style;contain-intrinsic-size:420px 620px;}
      @media(max-width:820px){#catalogGrid .unitCard{contain-intrinsic-size:360px 470px;}}
      #v2AutoLoadSentinel{height:1px;grid-column:1/-1;pointer-events:none;}
    `;
    document.head.appendChild(style);
  }
  function elClass(el){const e=clean(el);if(['fire','flame'].includes(e))return'el-fire';if(['water','ice'].includes(e))return'el-water';if(['storm','air','wind','thunder','lightning','electric'].includes(e))return'el-storm';if(['earth','terra','ground'].includes(e))return'el-earth';if(['light','life','holy'].includes(e))return'el-light';if(['dark','death','shadow'].includes(e))return'el-dark';return e?`el-${e}`:'';}
  function displayEl(el){const raw=String(el||'').trim();return raw?raw.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'';}
  function kindLabel(k){return k==='characters'?'Character':k==='weapons'?'Weapon':k==='accessories'?'Accessory':k==='bosses'?'Boss':k;}
  function skillRows(e,type){const key=type==='active'?'activeSkills':'passiveSkillDetails';if(Array.isArray(e?.[key]))return e[key];const src=type==='active'?e?.resolved?.activeSkills:e?.resolved?.passives;const out=[];if(src&&typeof src==='object'){for(const [id,d]of Object.entries(src)){const loc=d?.localization||{};out.push({id,name:loc.name||id,description:loc.description||'',tu:d?.tu,sp:d?.sp});}}return out;}
  function charImgs(u){const raw=Array.isArray(u.imageVariants)?u.imageVariants.map(v=>v&&v.url):Array.isArray(u.imagesLarge)?u.imagesLarge:(u.image?[u.image]:[]);return [...new Set((raw||[]).filter(Boolean))].slice(0,3);}
  function base(kind,e){const raw=e?.raw||{};const sourceId=String(e?.sourceId??e?.internal?.sourceId??e?.internal?.weaponId??e?.internal?.bossId??raw.name??e?.name??e?.id??'');return{kind,id:String(e?.id??e?.family??sourceId),sourceId,family:String(e?.family??e?.internal?.family??raw.family??strip(sourceId)),file:file(e),order:order(e),name:pick(e?.displayName,e?.title,e?.name,sourceId),subtitle:pick(e?.weaponType,raw.weaponPref,e?.category,e?.subtitle,kindLabel(kind)),description:pick(e?.description,e?.flavorText,e?.profile,e?.effect,raw.profile,''),rarity:pick(e?.rarity,e?.stars,raw.stars,raw.accessoryStars,''),element:displayEl(pick(e?.element,raw.element,'')),stats:{atk:val(e,raw,'atk',raw.flatAttack,raw.baseAttack,raw.attack),hp:val(e,raw,'hp',raw.flatMaxHp,raw.baseMaxHp,raw.hp),spd:val(e,raw,'spd',raw.flatSpeed,raw.speed),cost:val(e,raw,'cost',raw.cost)},activeSkills:skillRows(e,'active'),passiveSkillDetails:skillRows(e,'passive'),descriptionByForm:Array.isArray(e?.descriptionByForm)?e.descriptionByForm:[],leaderSkillName:pick(e?.leaderSkill?.name,''),leaderSkillDesc:pick(e?.leaderSkill?.description,'')};}
  function characterStateRoot(item){return famKey(item.family||item.sourceId||item.id||item.name);}
  function collapseCharacterStates(chars){
    const groups=new Map();
    chars.forEach(item=>{const k=characterStateRoot(item);if(!k){groups.set(Symbol(),[item]);return;}if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);});
    const out=[];
    groups.forEach(list=>{
      if(list.length<2){out.push(list[0]);return;}
      list.sort((a,b)=>Number(b.order||0)-Number(a.order||0));
      const primary={...list[0]};
      primary.images=[...new Set(list.flatMap(x=>Array.isArray(x.images)?x.images:(x.image?[x.image]:[])).filter(Boolean))].slice(0,3);
      primary.image=primary.images[0]||primary.image;
      primary.descriptionByForm=list.flatMap(x=>Array.isArray(x.descriptionByForm)&&x.descriptionByForm.length?x.descriptionByForm:[x.description].filter(Boolean));
      primary._stateForms=list.map(x=>({id:x.id,sourceId:x.sourceId,family:x.family,name:x.name,title:x.subtitle,order:x.order,image:x.image}));
      out.push(primary);
    });
    return out;
  }
  function byNewest(a,b){return Number(b.order||0)-Number(a.order||0)||String(a.name||'').localeCompare(String(b.name||''));}
  function byOldest(a,b){return Number(a.order||0)-Number(b.order||0)||String(a.name||'').localeCompare(String(b.name||''));}
  function sortRows(rows){const copy=[...rows];if(state.sort==='az')return copy.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))||byNewest(a,b));if(state.sort==='za')return copy.sort((a,b)=>String(b.name||'').localeCompare(String(a.name||''))||byNewest(a,b));if(state.sort==='oldest')return copy.sort(byOldest);return copy.sort(byNewest);}
  function normalize(entries){
    const chars=collapseCharacterStates((entries.characters||[]).map(e=>({...base('characters',e),name:pick(e.name,e.family,e.sourceId),subtitle:pick(e.title,e.subtitle,''),image:pick(e.image,charImgs(e)[0],''),images:charImgs(e)})));
    const weapons=(entries.weapons||[]).map(e=>{const x=base('weapons',e);return{...x,image:pick(e.image,x.sourceId?`https://ik.imagekit.io/r8fsa98s9/weapons/${x.sourceId}.png`:'')}});
    const accessories=(entries.accessories||[]).map(e=>{const x=base('accessories',e);return{...x,image:pick(e.image,x.sourceId?`https://ik.imagekit.io/r8fsa98s9/accessories/${x.sourceId}.png`:'')}});
    const bosses=(entries.bosses||[]).map(e=>{const x=base('bosses',e);return{...x,image:pick(e.image,x.sourceId?`https://ik.imagekit.io/r8fsa98s9/characters/${x.sourceId.replace(/Boss(?=\d+$)/,'')}.png`:'')}});
    return [...chars,...weapons,...accessories,...bosses].filter(x=>x.id&&x.name);
  }
  function itemKeys(item){return [item.id,item.sourceId,item.family,item.name,item.subtitle].flatMap(v=>[famKey(v),clean(v)]).filter(Boolean);}
  function addSetMap(map,key,value){if(!key||!value||key===value)return;if(!map.has(key))map.set(key,new Set());map.get(key).add(value);}
  function duoCanonical(raw,aliases){const k=famKey(raw);return aliases.get(k)||k;}
  async function loadDuoRegistry(){
    const built=await readJson('./apkfiles/entries/maps/character_parent_child_map.json');
    const aliases=new Map(), parentChildren=new Map(), childParents=new Map(), parents=new Set();
    Object.entries(built?.aliases||{}).forEach(([k,v])=>aliases.set(clean(k),famKey(v)));
    const add=(p,c)=>{const pk=duoCanonical(p,aliases),ck=duoCanonical(c,aliases);if(!pk||!ck||pk===ck)return;parents.add(pk);addSetMap(parentChildren,pk,ck);addSetMap(childParents,ck,pk);};
    if(built&&built.parents&&typeof built.parents==='object'){
      Object.entries(built.parents||{}).forEach(([p,children])=>Array.isArray(children)&&children.forEach(c=>add(p,c)));
      return {aliases,parentChildren,childParents,parents,source:'character_parent_child_map'};
    }
    const [duo,display]=await Promise.all([readJson('./apkfiles/Duo.json'),readJson('./apkfiles/DuoDisplay.json')]);
    Object.entries(display?.parentCards||{}).forEach(([p,cfg])=>(Array.isArray(cfg?.children)?cfg.children:[]).forEach(c=>add(p,c)));
    Object.entries(duo||{}).forEach(([,mapping])=>{if(!mapping||typeof mapping!=='object'||Array.isArray(mapping))return;Object.entries(mapping).forEach(([p,children])=>Array.isArray(children)&&children.forEach(c=>add(p,c)));});
    return {aliases,parentChildren,childParents,parents,source:'duo_all_fallback'};
  }
  function canonicalItemKeys(item,registry){return itemKeys(item).map(k=>registry.aliases.get(k)||k).filter(Boolean);}
  function findParentKey(item,registry){for(const k of canonicalItemKeys(item,registry)){if(registry.parentChildren.has(k))return k;}return'';}
  function isChildOnly(item,registry,parentKey){if(parentKey)return false;return canonicalItemKeys(item,registry).some(k=>registry.childParents.has(k));}
  function buildItemIndex(items,registry){const map=new Map();items.forEach(item=>{if(item.kind!=='characters')return;canonicalItemKeys(item,registry).forEach(k=>{if(!map.has(k))map.set(k,item);});});return map;}
  function applyDuoRegistry(items,registry){
    const itemIndex=buildItemIndex(items,registry);
    const out=[];let parentCount=0,attachedChildren=0,skippedChildren=0;
    for(const item of items){
      if(item.kind!=='characters'){out.push(item);continue;}
      const parentKey=findParentKey(item,registry);
      if(isChildOnly(item,registry,parentKey)){skippedChildren++;continue;}
      if(parentKey){
        const children=[...(registry.parentChildren.get(parentKey)||[])].map(k=>itemIndex.get(k)).filter(Boolean).filter(child=>child!==item);
        const unique=[];const seen=new Set();[item,...children].forEach(form=>{const id=famKey(form.family||form.sourceId||form.id||form.name);if(!id||seen.has(id))return;seen.add(id);unique.push(form);});
        if(unique.length>1){item.duoForms=unique.map(f=>({...f,duoForms:undefined}));parentCount++;attachedChildren+=unique.length-1;}
      }
      out.push(item);
    }
    window.__EVERTALE_V2_DUO_DATA_REPORT={source:registry.source,parents:parentCount,children:attachedChildren,skippedChildren,itemsBefore:items.length,itemsAfter:out.length};
    return out;
  }
  function stateBtns(imgs){if(!Array.isArray(imgs)||imgs.length<2)return'';const enc=attrJson(imgs.slice(0,3));return`<div class="stateRow" data-imgs="${enc}">${imgs.slice(0,3).map((_,i)=>`<button type="button" class="stateBtn ${i===0?'active':''}" data-idx="${i}" aria-label="State ${i+1}"></button>`).join('')}</div>`;}
  function duoLabel(forms){const names=[...new Set((forms||[]).map(f=>String(f.name||'').replace(/\s*[-–—].*$/,'').trim()).filter(Boolean))];return names.length>1?names.slice(0,3).join(' / '):(names[0]||'Forms');}
  function duoBtn(item){if(!Array.isArray(item.duoForms)||item.duoForms.length<2)return'';return`<button type="button" class="duoFormBtn" data-duo-index="0" data-duo-forms="${attrJson(item.duoForms)}">${safe(duoLabel(item.duoForms))}</button>`;}
  function detailSkillHtml(rows){return (Array.isArray(rows)&&rows.length)?rows.map(s=>`<p><strong>${safe(s.name||s.id||'Skill')}</strong><br>${safe(s.description||s.desc||'No description loaded.')}</p>`).join(''):'No skills loaded.';}
  function detailSection(label,html){return`<details class="v2-detail-section"><summary class="v2-detail-tab">${safe(label)}</summary><div class="v2-detail-panel">${html||'No details loaded.'}</div></details>`;}
  function detailIdFor(item){return`v2d-${clean(item.id||item.sourceId||item.name)}`;}
  function renderCard(item){
    const selected=state.selectedId&&String(item.id)===state.selectedId?' v2-selected':'';
    const imgs=item.images?.length?item.images:(item.image?[item.image]:[]);
    const img=imgs[0]?`<img src="${safe(imgs[0])}" loading="lazy" decoding="async" fetchpriority="low" data-imgs="${attrJson(imgs)}" data-state="0" alt="${safe(item.name)}">`:'<div class="ph">?</div>';
    const chips=[`<span class="tag kind">${kindLabel(item.kind)}</span>`];
    if(item.element)chips.push(`<span class="tag element">${safe(item.element)}</span>`);
    if(item.rarity)chips.push(`<span class="tag rarity">${safe(item.rarity)}</span>`);
    const statHtml=Object.entries(item.stats||{}).filter(([,v])=>v!==''&&v!=null).map(([k,v])=>`<div class="stat" data-stat="${k}"><span class="statLabel">${k.toUpperCase()}</span><span class="statVal">${safe(v)}</span></div>`).join('');
    const leader=item.kind==='characters'&&(item.leaderSkillName||item.leaderSkillDesc)?`<div class="leaderBlock"><div class="leaderName">${safe(item.leaderSkillName||'No Leader Skill')}</div><div class="leaderDesc">${safe(item.leaderSkillDesc||'This unit does not provide a leader skill.')}</div></div>`:'';
    const detailId=detailIdFor(item);
    return `<div class="unitCard ${elClass(item.element)}${selected}" data-kind="${item.kind}" data-id="${safe(item.id)}" data-source-id="${safe(item.sourceId)}" data-family="${safe(item.family)}" data-file="${safe(item.file)}" data-order="${safe(item.order)}" data-source-order="${safe(item.order)}" data-file-handle-order="${safe(item.order)}" data-description="${safe(item.description||'')}" data-active-skills="${attrJson(item.activeSkills)}" data-passive-skills="${attrJson(item.passiveSkillDetails)}"><div class="unitLeft"><div class="unitThumb">${img}</div></div><div class="meta"><div class="metaHeader"><div class="metaMain"><div class="nameBlock"><button type="button" class="v2-detail-btn" popovertarget="${detailId}">Details</button><div class="unitName">${safe(item.name)}</div><div class="unitTitle">${safe(item.subtitle)}</div>${stateBtns(imgs)}${duoBtn(item)}</div><div class="chipCol">${chips.join('')}</div></div></div><div class="unitDetails"><div class="statLine">${statHtml||'<div class="muted">No stats loaded.</div>'}</div>${leader}<div class="skillMini"><button type="button" data-v2-skill="active">Active Skill</button><button type="button" data-v2-skill="passive">Passive Skill</button><button type="button" class="v2-detail-btn" popovertarget="${detailId}">Description</button></div><div class="descriptionPanel" data-descriptions="${attrJson(item.descriptionByForm)}" hidden>${safe(item.description||'')}</div></div></div><div id="${detailId}" class="v2-detail-backdrop" popover></div></div>`;
  }
  function filter(){const q=state.q.toLowerCase();let rows=state.items;if(state.type!=='all')rows=rows.filter(i=>i.kind===state.type);if(q)rows=rows.filter(i=>`${i.name} ${i.subtitle} ${i.description} ${i.rarity} ${i.element} ${i.kind} ${i.sourceId}`.toLowerCase().includes(q));return sortRows(rows);}
  function ensureSentinel(){const grid=$('catalogGrid');if(!grid)return null;let s=$('v2AutoLoadSentinel');if(!s){s=document.createElement('div');s.id='v2AutoLoadSentinel';grid.insertAdjacentElement('afterend',s);}return s;}
  function updateStatus(){const status=$('statusText');if(status)status.textContent=`Showing ${Math.min(state.rendered,state.filtered.length)} of ${state.filtered.length}`;const s=ensureSentinel();if(s)s.style.display=state.rendered<state.filtered.length?'block':'none';}
  function render(){const grid=$('catalogGrid');if(!grid)return;state.token++;state.filtered=filter();state.rendered=0;grid.innerHTML='';renderMore(state.token,Math.max(state.pageSize,window.innerWidth>=821?36:18));setupAutoLoad();}
  function renderMore(token=state.token,count=state.pageSize){const grid=$('catalogGrid');if(!grid||token!==state.token)return;const start=state.rendered,end=Math.min(start+count,state.filtered.length);if(end<=start){updateStatus();return;}grid.insertAdjacentHTML('beforeend',state.filtered.slice(start,end).map(renderCard).join(''));state.rendered=end;updateStatus();}
  function setupAutoLoad(){const sentinel=ensureSentinel();if(!sentinel)return;if(state.observer)state.observer.disconnect();state.observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&state.rendered<state.filtered.length)idle(()=>renderMore(state.token,state.pageSize));},{rootMargin:'900px 0px'});state.observer.observe(sentinel);}
  function readSkills(card,type){let rows=[];try{rows=JSON.parse(decodeURIComponent(card?.getAttribute(type==='active'?'data-active-skills':'data-passive-skills')||''))}catch{}return (Array.isArray(rows)?rows:[]).map(s=>({name:s.name||s.id||'Unnamed Skill',meta:[s.tu?`${s.tu} TU`:'',s.sp!==undefined?`${Number(s.sp)>0?'+':''}${s.sp} SP`:''].filter(Boolean).join(' • '),desc:s.description||''}));}
  function closeCardSkillPanels(except){document.querySelectorAll('.unitCard.v2-skill-open').forEach(c=>{if(c!==except)c.classList.remove('v2-skill-open');});document.querySelectorAll('.v2-card-skill-panel').forEach(p=>{if(!except||!except.contains(p))p.hidden=true;});}
  function openSkills(type){const card=document.querySelector('.unitCard.v2-selected')||document.querySelector('.unitCard');if(!card)return false;const rows=readSkills(card,type);const details=card.querySelector('.unitDetails')||card;let panel=card.querySelector('.v2-card-skill-panel');if(!panel){details.insertAdjacentHTML('beforeend','<div class="v2-card-skill-panel" hidden><div class="v2-card-skill-head"><h3 class="v2-card-skill-title"></h3><button type="button" class="v2-card-skill-close" aria-label="Close skill details">×</button></div><div class="v2-card-skill-list"></div></div>');panel=card.querySelector('.v2-card-skill-panel');panel.querySelector('.v2-card-skill-close')?.addEventListener('click',()=>{panel.hidden=true;card.classList.remove('v2-skill-open');});}const title=type==='active'?'Active Skills':'Passive Skills';panel.querySelector('.v2-card-skill-title').textContent=title;panel.querySelector('.v2-card-skill-list').innerHTML=rows.length?rows.map(s=>`<div class="v2-card-skill-item"><strong>${safe(s.name)}</strong>${s.meta?`<span>${safe(s.meta)}</span>`:''}<p>${safe(s.desc)||'No description loaded.'}</p></div>`).join(''):`<div class="v2-card-skill-item"><strong>No ${title}</strong><p>No ${title.toLowerCase()} were found on this entry.</p></div>`;const wasOpen=!panel.hidden&&card.classList.contains('v2-skill-open')&&panel.dataset.type===type;closeCardSkillPanels(card);panel.dataset.type=type;panel.hidden=wasOpen;card.classList.toggle('v2-skill-open',!wasOpen);return true;}
  function cardDetailId(card){return card?.querySelector('.v2-detail-btn')?.getAttribute('popovertarget')||`v2d-${clean(card?.getAttribute('data-id')||card?.getAttribute('data-source-id')||card?.querySelector('.unitName')?.textContent||'detail')}`;}
  function cardElementClass(card){return [...(card?.classList||[])].find(c=>/^el-/.test(c))||'';}
  function cardDescription(card){const direct=card?.getAttribute('data-description')||'';if(direct)return direct;try{const rows=JSON.parse(decodeURIComponent(card?.querySelector('.descriptionPanel')?.getAttribute('data-descriptions')||''));return rows?.[Number(card?.getAttribute('data-duo-index')||0)]||rows?.[0]||'';}catch{return'';}}
  function ensureDetailPopover(card){if(!card)return null;const id=cardDetailId(card);let pop=card.querySelector(`.v2-detail-backdrop#${CSS.escape(id)}`)||document.getElementById(id);if(!pop){pop=document.createElement('div');pop.id=id;pop.className='v2-detail-backdrop';pop.setAttribute('popover','');card.appendChild(pop);}const img=card.querySelector('.unitThumb')?.innerHTML||'<div class="ph">?</div>';const name=card.querySelector('.unitName')?.textContent?.trim()||'Selected';const title=card.querySelector('.unitTitle')?.textContent?.trim()||'';const skillTop=[card.querySelector('.stateRow')?.outerHTML||'',card.querySelector('.duoFormBtn')?.outerHTML||''].join('');const chips=[...card.querySelectorAll('.chipCol .tag')].map(x=>x.outerHTML).join('');const stats=card.querySelector('.statLine')?.innerHTML||'';const leaderBlock=card.querySelector('.leaderBlock');const leader=leaderBlock?leaderBlock.innerHTML:'No leader skill text loaded.';const desc=safe(cardDescription(card)||'No description loaded.');pop.innerHTML=`<div class="v2-detail-card ${cardElementClass(card)}"><div class="unitThumb">${img}</div><div class="v2-detail-name">${safe(name)}</div><div class="v2-detail-title">${safe(title)}</div><div class="v2-detail-row">${skillTop}</div><div class="v2-detail-row">${chips}</div>${stats?`<div class="v2-detail-stats">${stats}</div>`:''}<div class="v2-detail-row">${detailSection('Leader Skill',leader)}${detailSection('Active',detailSkillHtml(readSkills(card,'active')))}${detailSection('Passive',detailSkillHtml(readSkills(card,'passive')))}${detailSection('Description',desc)}</div></div>`;return pop;}
  function openDetail(card){const pop=ensureDetailPopover(card);if(!pop)return false;try{pop.showPopover();}catch{pop.setAttribute('popover','manual');try{pop.showPopover();}catch{}}return true;}
  function swapDuo(hostCard,forms,next){const item={...forms[next],duoForms:forms};const wrap=document.createElement('div');wrap.innerHTML=renderCard(item);const fresh=wrap.firstElementChild;if(!fresh)return;hostCard.innerHTML=fresh.innerHTML;hostCard.className=fresh.className;for(const attr of [...fresh.attributes])hostCard.setAttribute(attr.name,attr.value);const btn=hostCard.querySelector('.duoFormBtn');if(btn){btn.dataset.duoIndex=String(next);btn.textContent=duoLabel(forms);}}
  function selectCard(card){if(!card)return;state.selectedId=String(card.getAttribute('data-id')||'');document.querySelectorAll('.unitCard.v2-selected').forEach(c=>c.classList.remove('v2-selected'));card.classList.add('v2-selected');}
  function attach(){const grid=$('catalogGrid');if(!grid)return;document.addEventListener('click',e=>{const btn=e.target.closest('[data-v2-skill]');if(btn&&openSkills(btn.getAttribute('data-v2-skill'))){e.preventDefault();e.stopImmediatePropagation();}},true);grid.addEventListener('error',e=>{if(e.target&&e.target.tagName==='IMG'){e.target.replaceWith(Object.assign(document.createElement('div'),{className:'ph',textContent:'?'}));}},true);grid.addEventListener('click',e=>{const detail=e.target.closest('.v2-detail-btn');if(detail){const card=detail.closest('.unitCard');if(card){e.preventDefault();e.stopPropagation();selectCard(card);openDetail(card);}return;}const duo=e.target.closest('.duoFormBtn');if(duo){const hostCard=e.target.closest('.unitCard');let forms=[];try{forms=JSON.parse(decodeURIComponent(duo.dataset.duoForms||''))}catch{}if(hostCard&&forms.length>1){const next=(Number(duo.dataset.duoIndex||0)+1)%forms.length;swapDuo(hostCard,forms,next);selectCard(hostCard);}return;}const card=e.target.closest('.unitCard');if(card)selectCard(card);const btn=e.target.closest('.stateBtn');if(!btn||!card)return;const row=btn.closest('.stateRow'),img=card.querySelector('.unitThumb img');let imgs=[];try{imgs=JSON.parse(decodeURIComponent(row?.dataset.imgs||''))}catch{}const idx=Number(btn.dataset.idx||0);if(!img||!imgs[idx])return;img.src=imgs[idx];img.dataset.state=String(idx);card.setAttribute('data-duo-index',String(idx));row.querySelectorAll('.stateBtn').forEach((b,i)=>b.classList.toggle('active',i===idx));});}
  async function init(){installPerfCss();document.body.classList.add('page-catalog','page-catalog-v2','mobile-compact');const status=$('statusText');if(status)status.textContent='Loading data...';const entries=await window.EvertaleData.loadAllEntries();const registry=await loadDuoRegistry();state.items=applyDuoRegistry(normalize(entries),registry);const search=$('catalogSearch'),type=$('catalogType'),sort=$('catalogSort');if(sort){state.sort=sort.value||'newest';sort.addEventListener('change',()=>{state.sort=sort.value||'newest';render();});}search?.addEventListener('input',()=>{clearTimeout(search._t);search._t=setTimeout(()=>{state.q=search.value||'';render();},160);});type?.addEventListener('change',()=>{state.type=type.value||'all';render();});attach();render();}
  document.addEventListener('DOMContentLoaded',()=>init().catch(err=>{console.error(err);const s=$('statusText');if(s)s.textContent=`Error: ${err.message||err}`;}));
})();
