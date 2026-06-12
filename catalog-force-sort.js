/* catalog-force-sort.js — final UI guard for catalog grids.
   Keeps visible catalog cards in the selected order, defaults first load to Characters,
   and forces card titles underneath names without touching generated data.
*/
(function(){
  const KIND_RANK = { characters: 0, weapons: 1, accessories: 2, bosses: 3 };
  let sorting = false;
  let timer = null;
  let defaultTypeApplied = false;

  function $(id){ return document.getElementById(id); }
  function clean(v){ return String(v || '').trim().toLowerCase(); }
  function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function fileOrder(card){
    const file = String(card.getAttribute('data-file') || '');
    const m = file.split('/').pop().match(/^(\d+)_/);
    return m ? num(m[1]) : null;
  }
  function order(card){
    return num(card.getAttribute('data-order')) ||
      num(card.getAttribute('data-source-order')) ||
      num(card.getAttribute('data-file-handle-order')) ||
      fileOrder(card) ||
      0;
  }
  function kind(card){ return card.getAttribute('data-kind') || ''; }
  function kindRank(card){ return KIND_RANK[kind(card)] ?? 99; }
  function name(card){ return clean(card.querySelector('.unitName')?.textContent || card.textContent || ''); }
  function original(card, index){
    if(!card.hasAttribute('data-force-sort-original')) card.setAttribute('data-force-sort-original', String(index));
    return Number(card.getAttribute('data-force-sort-original') || index || 0);
  }
  function mode(){
    const v = $('catalogSort')?.value || 'newest';
    return ['newest','oldest','az','za'].includes(v) ? v : 'newest';
  }
  function injectTitleStackStyle(){
    if(document.getElementById('catalog-title-stack-runtime-style')) return;
    const style=document.createElement('style');
    style.id='catalog-title-stack-runtime-style';
    style.textContent=`
      #catalogGrid .unitCard .nameBlock,
      #unitGrid .unitCard .nameBlock{
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        justify-content:center!important;
        text-align:center!important;
        width:100%!important;
        min-width:0!important;
        gap:3px!important;
      }
      #catalogGrid .unitCard .unitName,
      #unitGrid .unitCard .unitName{
        order:1!important;
        display:block!important;
        width:100%!important;
        text-align:center!important;
        margin:0 auto!important;
      }
      #catalogGrid .unitCard .unitTitle,
      #unitGrid .unitCard .unitTitle{
        order:2!important;
        display:block!important;
        width:100%!important;
        max-width:94%!important;
        text-align:center!important;
        margin:2px auto 0!important;
        line-height:1.22!important;
        visibility:visible!important;
        opacity:1!important;
      }
      body.page-catalog-v2 #catalogGrid .unitCard .nameBlock{
        position:relative!important;
        padding-left:42px!important;
        padding-right:42px!important;
      }
    `;
    document.head.appendChild(style);
  }
  function compareRows(a,b,currentMode){
    if(currentMode === 'az' || currentMode === 'za'){
      const kr = kindRank(a.card) - kindRank(b.card);
      if(kr) return kr;
      const cmp = name(a.card).localeCompare(name(b.card), undefined, {sensitivity:'base', numeric:true});
      return cmp ? (currentMode === 'az' ? cmp : -cmp) : a.original - b.original;
    }
    const ao = order(a.card);
    const bo = order(b.card);
    if(ao !== bo) return currentMode === 'oldest' ? ao - bo : bo - ao;
    return currentMode === 'oldest' ? a.original - b.original : b.original - a.original;
  }
  function applyDefaultType(){
    if(defaultTypeApplied) return;
    const select = $('catalogType');
    const grid = $('catalogGrid');
    if(!select || !grid) return;
    const hasCharacters = Array.from(select.options || []).some(option => option.value === 'characters');
    if(!hasCharacters) return;
    if(select.value !== 'all') { defaultTypeApplied = true; return; }
    if(!grid.querySelector('.unitCard')) return;
    defaultTypeApplied = true;
    select.value = 'characters';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function apply(){
    injectTitleStackStyle();
    applyDefaultType();
    if(sorting) return;
    const grid = $('catalogGrid');
    if(!grid) return;
    const cards = Array.from(grid.querySelectorAll('.unitCard'));
    if(cards.length < 2) return;
    const currentMode = mode();
    const rows = cards.map((card, index) => ({card, original: original(card, index)}));
    rows.sort((a,b)=>compareRows(a,b,currentMode));
    if(rows.every((row, index)=>row.card === cards[index])) return;
    sorting = true;
    const frag = document.createDocumentFragment();
    rows.forEach(row=>frag.appendChild(row.card));
    grid.appendChild(frag);
    requestAnimationFrame(()=>{ sorting = false; });
  }
  function schedule(delay=80){
    clearTimeout(timer);
    timer = setTimeout(apply, delay);
  }
  function init(){
    injectTitleStackStyle();
    const grid = $('catalogGrid');
    if(!grid) return;
    $('catalogSort')?.addEventListener('change', ()=>schedule(0));
    $('catalogType')?.addEventListener('change', ()=>schedule(120));
    $('catalogSearch')?.addEventListener('input', ()=>schedule(160));
    new MutationObserver(()=>schedule(80)).observe(grid, {childList:true});
    schedule(0);
    schedule(350);
    schedule(1000);
    schedule(1800);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
