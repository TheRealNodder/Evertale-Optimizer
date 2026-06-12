/* catalog-force-sort.js — final safety sorter for all catalog grids.
   Runs after render and after mutations so every visible catalog path follows the same order rules.
*/
(function(){
  const KIND_RANK = { characters: 0, weapons: 1, accessories: 2, bosses: 3 };
  let sorting = false;
  let timer = null;

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
  function apply(){
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
    const grid = $('catalogGrid');
    if(!grid) return;
    $('catalogSort')?.addEventListener('change', ()=>schedule(0));
    $('catalogType')?.addEventListener('change', ()=>schedule(120));
    $('catalogSearch')?.addEventListener('input', ()=>schedule(160));
    new MutationObserver(()=>schedule(80)).observe(grid, {childList:true});
    schedule(0);
    schedule(350);
    schedule(1000);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
