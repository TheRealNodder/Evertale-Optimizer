/* element-normalizer.js — applies canonical element classes from element_reference.json without render loops. */
(function(){
  const REF_URL='./apkfiles/entries/maps/element_reference.json';
  let refPromise=null;
  let indexPromise=null;
  let scheduled=false;
  function key(v){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
  async function loadRef(){
    if(refPromise)return refPromise;
    refPromise=fetch(REF_URL,{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
    return refPromise;
  }
  function fallback(value){
    const v=key(value);
    if(['fire','flame','burn','red','isfire'].includes(v))return{canonical:'fire',display:'Fire',className:'el-fire'};
    if(['water','ice','aqua','blue','iswater'].includes(v))return{canonical:'water',display:'Water',className:'el-water'};
    if(['storm','air','wind','thunder','lightning','electric','yellow','isair'].includes(v))return{canonical:'storm',display:'Storm',className:'el-storm'};
    if(['earth','terra','ground','nature','green','isearth'].includes(v))return{canonical:'earth',display:'Earth',className:'el-earth'};
    if(['light','life','holy','white','islife'].includes(v))return{canonical:'light',display:'Light',className:'el-light'};
    if(['dark','death','shadow','purple','isdeath'].includes(v))return{canonical:'dark',display:'Dark',className:'el-dark'};
    return null;
  }
  function buildIndex(ref){
    const out=new Map();
    const elements=ref?.elements||{};
    Object.entries(elements).forEach(([canonical,row])=>{
      const item={canonical,display:row.display||canonical,className:row.className||`el-${canonical}`};
      [canonical,row.display,row.className,...(row.aliases||[])].forEach(v=>{const k=key(v);if(k)out.set(k,item);});
    });
    Object.entries(ref?.apkAliases||{}).forEach(([alias,canonical])=>{const row=elements[canonical];if(row)out.set(key(alias),{canonical,display:row.display||canonical,className:row.className||`el-${canonical}`});});
    Object.entries(ref?.leaderSkillAliases||{}).forEach(([alias,canonical])=>{const row=elements[canonical];if(row)out.set(key(alias),{canonical,display:row.display||canonical,className:row.className||`el-${canonical}`});});
    return out;
  }
  async function getIndex(){
    if(indexPromise)return indexPromise;
    indexPromise=loadRef().then(ref=>buildIndex(ref||{}));
    return indexPromise;
  }
  function cardElementText(card){
    const explicit=card.getAttribute('data-element')||card.getAttribute('data-apk-element')||card.getAttribute('data-element-display')||'';
    if(explicit)return explicit;
    const tags=[...card.querySelectorAll('.tag,.element')].map(x=>x.textContent||'');
    return tags.find(t=>fallback(t))||'';
  }
  function normalizeCard(card,index){
    if(!card||!card.classList?.contains('unitCard'))return;
    const raw=cardElementText(card);
    const resolved=index.get(key(raw))||fallback(raw);
    if(!resolved)return;
    const current=card.getAttribute('data-element-canonical');
    if(current===resolved.canonical && card.classList.contains(resolved.className))return;
    ['el-fire','el-water','el-storm','el-earth','el-light','el-dark'].forEach(c=>{ if(c!==resolved.className) card.classList.remove(c); });
    card.classList.add(resolved.className);
    card.setAttribute('data-element-canonical',resolved.canonical);
    card.setAttribute('data-element-display',resolved.display);
    const tag=[...card.querySelectorAll('.tag')].find(x=>fallback(x.textContent));
    if(tag && tag.textContent.trim()!==resolved.display)tag.textContent=resolved.display;
  }
  async function normalizeAll(root=document){
    const index=await getIndex();
    root.querySelectorAll?.('.unitCard')?.forEach(card=>normalizeCard(card,index));
  }
  function scheduleNormalize(root=document){
    if(scheduled)return;
    scheduled=true;
    const run=()=>{scheduled=false;normalizeAll(root).catch(console.warn);};
    if('requestAnimationFrame' in window)requestAnimationFrame(run);else setTimeout(run,0);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    scheduleNormalize(document);
    const grid=document.getElementById('catalogGrid');
    if(grid){
      new MutationObserver(mutations=>{
        if(!mutations.some(m=>[...m.addedNodes].some(n=>n.nodeType===1 && (n.classList?.contains('unitCard')||n.querySelector?.('.unitCard')))))return;
        scheduleNormalize(grid);
      }).observe(grid,{childList:true});
    }
  });
  window.EvertaleElementReference={load:loadRef,normalizeAll,scheduleNormalize};
})();
