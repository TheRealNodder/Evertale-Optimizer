/* duo-source-collapse.js — collapse linked summon/switch/transform entries before pages render.
   This patches EvertaleData so catalog/roster/optimizer receive parent-only character pools.
   Direct links are connected groups. Summon/helper/imposter/clone links are parent-scoped groups.
   Merged cards keep the earliest order slot from any linked unit.
*/
(function(){
  const DISPLAY_URL='./apkfiles/DuoDisplay.json';
  const DUO_URL='./apkfiles/Duo.json';
  let duoDataPromise=null;

  function norm(v){return String(v||'').trim();}
  function strip(v){return norm(v).replace(/\d+$/,'');}
  function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function formName(u){return String(u?.name||u?.title||u?.subtitle||u?.id||'Form').trim()||'Form';}
  function nextLabel(forms,idx){if(!Array.isArray(forms)||!forms.length)return'Form';const next=(Number(idx)+1)%forms.length;return formName(forms[next]);}
  function elementClass(el){const e=String(el||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');if(e==='fire'||e==='flame')return'el-fire';if(e==='water'||e==='ice')return'el-water';if(e==='storm'||e==='air'||e==='wind'||e==='thunder'||e==='lightning'||e==='electric')return'el-storm';if(e==='earth'||e==='terra'||e==='ground')return'el-earth';if(e==='light'||e==='life'||e==='holy')return'el-light';if(e==='dark'||e==='death'||e==='shadow')return'el-dark';return''}
  function displayElement(el){const raw=String(el||'').trim();return raw?raw.replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):''}
  function imageList(u){const variants=Array.isArray(u?.imageVariants)?u.imageVariants.map(v=>v&&v.url).filter(Boolean):[];const large=Array.isArray(u?.imagesLarge)?u.imagesLarge.filter(Boolean):[];const raw=variants.length?variants:(large.length?large:(u?.image?[u.image]:[]));const seen=new Set();const out=[];for(const url of raw){if(!url||seen.has(url))continue;seen.add(url);out.push(url);if(out.length>=3)break;}return out;}
  function statValue(u,key){return u?.stats?.[key]??u?.[key]??''}
  async function j(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():null}catch(e){console.warn('[DuoSource] skipped',url,e);return null}}
  function uf(){const p=new Map();const f=x=>{x=norm(x);if(!p.has(x))p.set(x,x);const r=p.get(x);if(r!==x)p.set(x,f(r));return p.get(x)};return{p,find:f,union:(a,b)=>{a=norm(a);b=norm(b);if(!a||!b)return;const ra=f(a),rb=f(b);if(ra!==rb)p.set(rb,ra)}}}
  function addAlias(map,k,v){k=norm(k);v=norm(v);if(k&&v&&!map.has(k))map.set(k,v)}
  function aliasUnit(map,u){const root=norm(u?.id||u?.family||u?.sourceId);if(!root)return;[u?.id,u?.family,u?.sourceId,strip(u?.sourceId),strip(u?.family)].forEach(k=>addAlias(map,k,root));(u?.formSourceIds||[]).forEach(k=>{addAlias(map,k,root);addAlias(map,strip(k),root)});(u?.forms||[]).forEach(f=>[f?.sourceId,f?.dataSourceId,f?.imageSourceId,strip(f?.sourceId),strip(f?.dataSourceId)].forEach(k=>addAlias(map,k,root)));(u?.imageVariants||[]).forEach(f=>[f?.sourceId,f?.dataSourceId,f?.imageSourceId,strip(f?.sourceId),strip(f?.dataSourceId)].forEach(k=>addAlias(map,k,root)));}
  function canon(alias,id){id=norm(id);return alias.get(id)||alias.get(strip(id))||id}
  function addConnected(U,map,alias){if(!map)return;for(const [a,bs] of Object.entries(map)){if(Array.isArray(bs))bs.forEach(b=>U.union(canon(alias,a),canon(alias,b)))}}
  function addDirected(out,map,alias,label){if(!map)return;for(const [a,bs] of Object.entries(map)){if(!Array.isArray(bs)||!bs.length)continue;const ids=[canon(alias,a),...bs.map(b=>canon(alias,b))].filter(Boolean);const unique=[...new Set(ids)];if(unique.length>1)out.push({ids:unique,label});}}
  function score(u){const all=`${u?.id||''} ${u?.sourceId||''} ${u?.name||''} ${u?.title||u?.subtitle||''}`.toLowerCase();let s=0;if(/ludmillaballet|red dragon dancer/.test(all))s+=1400;if(/yanderemaidballet|clarice/.test(all))s+=200;if(/beautybeastregular|beauty.*beast|beauty\s*&\s*beast/.test(all))s+=1000;if(/snowwhitenew|snow white/.test(all)&&!/black/.test(all))s+=800;if(/regular|new|bride/.test(String(u?.id||'').toLowerCase()))s+=50;if(/&| and /.test(String(u?.name||'').toLowerCase()))s+=90;if(/minion|imposter|clone|rabbit|angel|raven|shadow|doll|summon|shiromori|belle|aigis/.test(all))s-=300;return s}
  function sameUnitKey(a,b){a=strip(a);b=strip(b);return !!a&&!!b&&a.toLowerCase()===b.toLowerCase();}
  function choose(items,preferredId){
    if(preferredId){
      const preferred=items.find(u=>sameUnitKey(u?.id,preferredId)||sameUnitKey(u?.sourceId,preferredId)||sameUnitKey(u?.family,preferredId)||(u?.formSourceIds||[]).some(id=>sameUnitKey(id,preferredId))||(u?.forms||[]).some(f=>sameUnitKey(f?.sourceId,preferredId)||sameUnitKey(f?.dataSourceId,preferredId)||sameUnitKey(f?.imageSourceId,preferredId)));
      if(preferred)return preferred;
    }
    return items.slice().sort((a,b)=>score(b)-score(a))[0]||items[0];
  }

  async function buildDuoData(units){
    const alias=new Map();(units||[]).forEach(u=>aliasUnit(alias,u));
    const [display,duo]=await Promise.all([j(DISPLAY_URL),j(DUO_URL)]);
    const U=uf();const labels=new Map();const groups=[];const preferredParents=new Set();const pc=display?.parentCards||{};
    for(const [parent,cfg] of Object.entries(pc)){const p=canon(alias,parent);preferredParents.add(p);const kids=Array.isArray(cfg?.children)?cfg.children:[];kids.forEach(k=>U.union(p,canon(alias,k)));[p,...kids.map(k=>canon(alias,k))].forEach(id=>{if(cfg?.buttonLabel)labels.set(id,cfg.buttonLabel)})}
    addConnected(U,duo?.directSpecificLinks,alias);
    const byRoot=new Map();for(const id of U.p.keys()){const r=U.find(id);if(!byRoot.has(r))byRoot.set(r,new Set());byRoot.get(r).add(id)}
    for(const set of byRoot.values()){const ids=[...set].filter(Boolean);if(ids.length>1)groups.push({ids,label:null,preferredParent:ids.find(id=>preferredParents.has(id))||null})}
    addDirected(groups,duo?.genericHelperSummons,alias,'Summon');
    addDirected(groups,duo?.enemyImposterExchangeUnits,alias,'Exchange');
    addDirected(groups,duo?.selfCloneOrDuplicateUnits,alias,'Clone');
    return{groups,labels};
  }

  async function collapse(units){
    if(!Array.isArray(units)||!units.length)return units;
    const data=await buildDuoData(units);
    const byId=new Map(units.map((u,idx)=>[norm(u.id),{u,idx}]).filter(([id])=>id));
    const hidden=new Set();const formMap=new Map();const meta=new Map();const placement=new Map();
    for(const g of data.groups){
      const records=(g.ids||[]).map(id=>byId.get(norm(id))).filter(Boolean);
      const items=records.map(r=>r.u);
      if(items.length<2)continue;
      const parent=choose(items,g.preferredParent);
      if(!parent)continue;
      const ordered=[parent,...items.filter(u=>u.id!==parent.id)];
      const earliest=Math.min(...records.map(r=>r.idx));
      const label=ordered.map(u=>data.labels.get(u.id)).find(Boolean)||g.label||'Forms';
      if(formMap.has(parent.id)){
        const existing=formMap.get(parent.id);const seen=new Set(existing.map(u=>u.id));
        ordered.forEach(u=>{if(!seen.has(u.id)){existing.push(u);seen.add(u.id)}});
        const current=meta.get(parent.id)||{};
        meta.set(parent.id,{label:current.label||label,ids:existing.map(u=>u.id)});
        placement.set(parent.id,Math.min(placement.get(parent.id)??earliest,earliest));
      }else{
        formMap.set(parent.id,ordered);
        meta.set(parent.id,{label,ids:ordered.map(u=>u.id)});
        placement.set(parent.id,earliest);
      }
      ordered.forEach(u=>{if(u.id!==parent.id)hidden.add(u.id)});
    }
    const outputAt=new Map();const formsByRoot=new Map();
    for(const [parentId,m] of meta.entries()){
      const forms=formMap.get(parentId)||[];
      const parent=forms[0];
      if(!parent)continue;
      formsByRoot.set(parentId,forms);
      const merged={...parent,duoRootId:parentId,duoForms:m.ids,duoButtonLabel:m.label,duoSearchText:forms.map(f=>`${f.name||''} ${f.title||f.subtitle||''} ${f.id||''} ${f.sourceId||''}`).join(' ')};
      outputAt.set(placement.get(parentId)??0,merged);
    }
    const out=[];
    for(let idx=0;idx<units.length;idx++){
      if(outputAt.has(idx))out.push(outputAt.get(idx));
      const u=units[idx];
      if(hidden.has(u.id))continue;
      if(meta.has(u.id))continue;
      out.push(u);
    }
    window.EvertaleDuoSource={formsByRoot};return out;
  }

  function patchData(){const d=window.EvertaleData;if(!d||d.__duoSourcePatched)return false;d.__duoSourcePatched=true;for(const key of ['loadCharactersMerged']){const orig=d[key];if(typeof orig==='function')d[key]=async function(...args){return collapse(await orig.apply(this,args))}}const origAll=d.loadAllEntries;if(typeof origAll==='function')d.loadAllEntries=async function(...args){const all=await origAll.apply(this,args);if(all&&Array.isArray(all.characters))all.characters=await collapse(all.characters);return all};return true}

  function setText(card,sel,text){const el=card.querySelector(sel);if(el)el.textContent=text||''}
  function setStat(card,label,value){const rows=Array.from(card.querySelectorAll('.stat'));for(const row of rows){if((row.querySelector('.statLabel')?.textContent||row.querySelector('strong')?.textContent||'').trim().toUpperCase()===label){const val=row.querySelector('.statVal');if(val)val.textContent=value??'';else row.innerHTML=`<span class="statLabel">${label}</span><span class="statVal">${safe(value??'')}</span>`;}}}
  function currentDuoButton(card){return card.querySelector('.duoFormBtn')}
  function ensureStateRow(card){let row=card.querySelector('.stateRow');if(row)return row;const host=card.querySelector('.metaMain')||card.querySelector('.metaHeader')||card.querySelector('.meta')||card;row=document.createElement('div');row.className='stateRow';host.appendChild(row);return row}
  function setImages(card,u,idx){const imgs=imageList(u);const preservedBtn=currentDuoButton(card);const imgWrap=card.querySelector('.unitThumb');if(imgWrap){if(imgs.length){imgWrap.innerHTML=`<img src="${safe(imgs[0])}" data-imgs="${safe(encodeURIComponent(JSON.stringify(imgs)))}" data-state="0" alt="${safe(u?.name||'')}">`;}else{imgWrap.innerHTML='<div class="ph">?</div>';}}const row=ensureStateRow(card);if(row){if(imgs.length>1){row.setAttribute('data-imgs',encodeURIComponent(JSON.stringify(imgs)));row.innerHTML=imgs.map((_,i)=>`<button type="button" class="stateBtn ${i===0?'active':''}" data-idx="${i}" aria-label="State ${i+1}"></button>`).join('');row.style.display='';}else{row.removeAttribute('data-imgs');row.innerHTML='';row.style.display='';}if(preservedBtn){row.appendChild(preservedBtn);}}}
  function setChips(card,u){const chipCol=card.querySelector('.chipCol');if(!chipCol)return;const kindChip=chipCol.querySelector('.tag.kind');if(kindChip)kindChip.textContent='Character';let elChip=chipCol.querySelector('.tag.element');const el=displayElement(u?.element);if(el){if(!elChip){elChip=document.createElement('span');elChip.className='tag element';chipCol.appendChild(elChip);}elChip.textContent=el;}else if(elChip){elChip.remove();}let rarityChip=chipCol.querySelector('.tag.rarity');if(u?.rarity){if(!rarityChip){rarityChip=document.createElement('span');rarityChip.className='tag rarity';chipCol.appendChild(rarityChip);}rarityChip.textContent=u.rarity;}else if(rarityChip){rarityChip.remove();}}
  function setElementClass(card,u){card.classList.remove('el-fire','el-water','el-storm','el-earth','el-light','el-dark');const cls=elementClass(u?.element);if(cls)card.classList.add(cls)}
  function setDescriptionState(card,u){const panel=card.querySelector('.descriptionPanel');const desc=card.querySelector('.descriptionText');const text=u?.description||u?.flavorText||'';const title=u?.title||u?.subtitle||'';if(desc)desc.textContent=text;if(panel)panel.setAttribute('data-descriptions',encodeURIComponent(JSON.stringify([{title,description:text}])))}
  function updateCard(card,u,root,forms,idx,total){if(!card||!u)return;card.setAttribute('data-duo-root',root||card.getAttribute('data-duo-root')||u.id||'');card.setAttribute('data-id',u.id||'');card.setAttribute('data-duo-index',String(idx));card.setAttribute('data-duo-active-id',u.id||'');setElementClass(card,u);setText(card,'.unitName',u.name||u.id||'');setText(card,'.unitTitle',u.title||u.subtitle||'');setImages(card,u,idx);setChips(card,u);setStat(card,'ATK',statValue(u,'atk'));setStat(card,'HP',statValue(u,'hp'));setStat(card,'SPD',statValue(u,'spd'));setStat(card,'COST',statValue(u,'cost'));setDescriptionState(card,u);const btn=currentDuoButton(card);if(btn){btn.textContent=nextLabel(forms,idx);btn.setAttribute('aria-label',`Switch to ${nextLabel(forms,idx)}`);ensureStateRow(card).appendChild(btn)}}
  function enhanceButtons(){const map=window.EvertaleDuoSource?.formsByRoot;if(!map)return;document.querySelectorAll('.unitCard[data-kind="characters"]').forEach(card=>{const root=card.getAttribute('data-duo-root')||card.getAttribute('data-id');const forms=map.get(root);if(!forms||forms.length<2)return;card.setAttribute('data-duo-root',root);if(!card.hasAttribute('data-duo-index'))card.setAttribute('data-duo-index','0');let btn=currentDuoButton(card);if(!btn){btn=document.createElement('button');btn.type='button';btn.className='duoFormBtn tag duoSwitchChip';btn.title='Switch to next linked unit';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const savedRoot=card.getAttribute('data-duo-root')||root;const savedForms=map.get(savedRoot)||forms;let i=(parseInt(card.getAttribute('data-duo-index')||'0',10)+1)%savedForms.length;updateCard(card,savedForms[i],savedRoot,savedForms,i,savedForms.length);});}btn.textContent=nextLabel(forms,parseInt(card.getAttribute('data-duo-index')||'0',10));ensureStateRow(card).appendChild(btn);})}
  function style(){if(document.getElementById('duoSourceStyle'))return;const s=document.createElement('style');s.id='duoSourceStyle';s.textContent='.duoFormBtn.duoSwitchChip{width:auto;max-width:100%;min-width:0;margin:0;border:1px solid rgba(28,224,154,.45);background:rgba(28,224,154,.14);color:var(--text,#f6f7ff);border-radius:999px;padding:4px 8px;font-size:12px;line-height:1;font-weight:900;cursor:pointer;white-space:normal;text-align:center;overflow-wrap:anywhere}.duoFormBtn.duoSwitchChip:hover{background:rgba(28,224,154,.22)}.unitCard[data-duo-root]{outline:1px solid rgba(28,224,154,.35)}.stateRow .duoFormBtn.duoSwitchChip{align-self:center;margin-left:4px;white-space:nowrap;max-width:130px;overflow:hidden;text-overflow:ellipsis}.chipCol>.duoFormBtn.duoSwitchChip{display:none!important}body.mobile-detailed .stateRow .duoFormBtn.duoSwitchChip{max-width:96px}body.mobile-compact .stateRow .duoFormBtn.duoSwitchChip{font-size:10px;padding:3px 6px}';document.head.appendChild(s)}
  function boot(){if(!patchData())setTimeout(boot,50)}boot();document.addEventListener('DOMContentLoaded',()=>{style();const grid=document.getElementById('catalogGrid');if(grid)new MutationObserver(()=>setTimeout(enhanceButtons,0)).observe(grid,{childList:true});setTimeout(enhanceButtons,300);setTimeout(enhanceButtons,1000)});
})();
