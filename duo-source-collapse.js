/* duo-source-collapse.js — collapse linked summon/switch/transform entries before pages render.
   This patches EvertaleData so catalog/roster/optimizer receive parent-only character pools.
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
  async function j(url){try{const r=await fetch(url,{cache:'no-store'});return r.ok?await r.json():null}catch(e){console.warn('[DuoSource] skipped',url,e);return null}}
  function uf(){const p=new Map();const f=x=>{x=norm(x);if(!p.has(x))p.set(x,x);const r=p.get(x);if(r!==x)p.set(x,f(r));return p.get(x)};return{p,find:f,union:(a,b)=>{a=norm(a);b=norm(b);if(!a||!b)return;const ra=f(a),rb=f(b);if(ra!==rb)p.set(rb,ra)}}}
  function addAlias(map,k,v){k=norm(k);v=norm(v);if(k&&v&&!map.has(k))map.set(k,v)}
  function aliasUnit(map,u){const root=norm(u?.id||u?.family||u?.sourceId);if(!root)return;[u?.id,u?.family,u?.sourceId,strip(u?.sourceId),strip(u?.family)].forEach(k=>addAlias(map,k,root));(u?.formSourceIds||[]).forEach(k=>{addAlias(map,k,root);addAlias(map,strip(k),root)});(u?.forms||[]).forEach(f=>[f?.sourceId,f?.dataSourceId,f?.imageSourceId,strip(f?.sourceId),strip(f?.dataSourceId)].forEach(k=>addAlias(map,k,root)));(u?.imageVariants||[]).forEach(f=>[f?.sourceId,f?.dataSourceId,f?.imageSourceId,strip(f?.sourceId),strip(f?.dataSourceId)].forEach(k=>addAlias(map,k,root)));}
  function canon(alias,id){id=norm(id);return alias.get(id)||alias.get(strip(id))||id}
  function addConnected(U,map,alias){if(!map)return;for(const [a,bs] of Object.entries(map)){if(Array.isArray(bs))bs.forEach(b=>U.union(canon(alias,a),canon(alias,b)))}}
  function score(u){const all=`${u?.id||''} ${u?.sourceId||''} ${u?.name||''} ${u?.title||u?.subtitle||''}`.toLowerCase();let s=0;if(/beautybeastregular|beauty.*beast|beauty\s*&\s*beast/.test(all))s+=1000;if(/snowwhitenew|snow white/.test(all)&&!/black/.test(all))s+=800;if(/regular|new|bride/.test(String(u?.id||'').toLowerCase()))s+=50;if(/&| and /.test(String(u?.name||'').toLowerCase()))s+=90;if(/minion|imposter|clone|rabbit|angel|raven|shadow|doll|summon|shiromori|belle|aigis/.test(all))s-=300;return s}
  function choose(items){return items.slice().sort((a,b)=>score(b)-score(a))[0]||items[0]}

  async function buildDuoData(units){
    const alias=new Map();(units||[]).forEach(u=>aliasUnit(alias,u));
    const [display,duo]=await Promise.all([j(DISPLAY_URL),j(DUO_URL)]);
    const U=uf();const labels=new Map();const groups=[];const pc=display?.parentCards||{};
    for(const [parent,cfg] of Object.entries(pc)){const p=canon(alias,parent);const kids=Array.isArray(cfg?.children)?cfg.children:[];kids.forEach(k=>U.union(p,canon(alias,k)));[p,...kids.map(k=>canon(alias,k))].forEach(id=>{if(cfg?.buttonLabel)labels.set(id,cfg.buttonLabel)})}
    addConnected(U,duo?.directSpecificLinks,alias);
    const byRoot=new Map();for(const id of U.p.keys()){const r=U.find(id);if(!byRoot.has(r))byRoot.set(r,new Set());byRoot.get(r).add(id)}
    for(const set of byRoot.values()){const ids=[...set].filter(Boolean);if(ids.length>1)groups.push({ids,label:null})}
    return{groups,labels};
  }

  async function collapse(units){
    if(!Array.isArray(units)||!units.length)return units;
    const data=await buildDuoData(units);const byId=new Map(units.map(u=>[norm(u.id),u]).filter(([id])=>id));const hidden=new Set();const formMap=new Map();const meta=new Map();
    for(const g of data.groups){const items=(g.ids||[]).map(id=>byId.get(norm(id))).filter(Boolean);if(items.length<2)continue;const parent=choose(items);if(!parent||hidden.has(parent.id))continue;const ordered=[parent,...items.filter(u=>u.id!==parent.id)];const label=ordered.map(u=>data.labels.get(u.id)).find(Boolean)||g.label||'Forms';formMap.set(parent.id,ordered);meta.set(parent.id,{label,ids:ordered.map(u=>u.id)});ordered.forEach(u=>{if(u.id!==parent.id)hidden.add(u.id)})}
    const out=[];const formsByRoot=new Map();
    for(const u of units){if(hidden.has(u.id))continue;const m=meta.get(u.id);if(m){const forms=formMap.get(u.id)||[u];formsByRoot.set(u.id,forms);out.push({...u,duoRootId:u.id,duoForms:m.ids,duoButtonLabel:m.label,duoSearchText:forms.map(f=>`${f.name||''} ${f.title||f.subtitle||''} ${f.id||''} ${f.sourceId||''}`).join(' ')})}else out.push(u)}
    window.EvertaleDuoSource={formsByRoot};return out;
  }

  function patchData(){const d=window.EvertaleData;if(!d||d.__duoSourcePatched)return false;d.__duoSourcePatched=true;for(const key of ['loadCharactersMerged']){const orig=d[key];if(typeof orig==='function')d[key]=async function(...args){return collapse(await orig.apply(this,args))}}
    const origAll=d.loadAllEntries;if(typeof origAll==='function')d.loadAllEntries=async function(...args){const all=await origAll.apply(this,args);if(all&&Array.isArray(all.characters))all.characters=await collapse(all.characters);return all};return true}

  function updateCard(card,u,root,forms,idx,total){if(!card||!u)return;card.setAttribute('data-id',u.id||'');card.setAttribute('data-duo-index',String(idx));const name=card.querySelector('.unitName');if(name)name.textContent=u.name||u.id||'';const title=card.querySelector('.unitTitle');if(title)title.textContent=u.title||u.subtitle||'';const img=card.querySelector('.unitThumb');const url=u.image||(u.imagesLarge&&u.imagesLarge[0]);if(img)img.innerHTML=url?`<img src="${safe(url)}" alt="${safe(u.name||'')}">`:'<div class="ph">?</div>';const desc=card.querySelector('.descriptionText');if(desc)desc.textContent=u.description||u.flavorText||'';const btn=card.querySelector('.duoFormBtn');if(btn)btn.textContent=nextLabel(forms,idx)}
  function enhanceButtons(){const map=window.EvertaleDuoSource?.formsByRoot;if(!map)return;document.querySelectorAll('.unitCard[data-kind="characters"]').forEach(card=>{const id=card.getAttribute('data-id');const forms=map.get(id);if(!forms||forms.length<2||card.querySelector('.duoFormBtn'))return;card.setAttribute('data-duo-root',id);card.setAttribute('data-duo-index','0');const host=card.querySelector('.metaMain')||card.querySelector('.metaHeader')||card.querySelector('.meta')||card;const btn=document.createElement('button');btn.type='button';btn.className='duoFormBtn';btn.textContent=nextLabel(forms,0);btn.title='Switch to next linked unit';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();let i=(parseInt(card.getAttribute('data-duo-index')||'0',10)+1)%forms.length;updateCard(card,forms[i],id,forms,i,forms.length)});host.appendChild(btn)})}
  function style(){if(document.getElementById('duoSourceStyle'))return;const s=document.createElement('style');s.id='duoSourceStyle';s.textContent='.duoFormBtn{margin-top:6px;border:1px solid rgba(255,255,255,.22);background:rgba(28,224,154,.12);color:var(--text,#f6f7ff);border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;cursor:pointer}.duoFormBtn:hover{background:rgba(28,224,154,.2)}.unitCard[data-duo-root]{outline:1px solid rgba(28,224,154,.35)}';document.head.appendChild(s)}
  function boot(){if(!patchData())setTimeout(boot,50)}boot();document.addEventListener('DOMContentLoaded',()=>{style();const grid=document.getElementById('catalogGrid');if(grid)new MutationObserver(()=>setTimeout(enhanceButtons,0)).observe(grid,{childList:true});setTimeout(enhanceButtons,300);setTimeout(enhanceButtons,1000)});
})();