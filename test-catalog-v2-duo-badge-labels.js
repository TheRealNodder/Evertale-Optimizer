/* test-catalog-v2-duo-badge-labels.js — visual label helper only. */
(function(){
  function cleanName(value){
    return String(value || '')
      .replace(/\s*[-–—].*$/,'')
      .replace(/\s+/g,' ')
      .trim();
  }

  function readForms(btn){
    try{
      const forms = JSON.parse(decodeURIComponent(btn.dataset.duoForms || ''));
      return Array.isArray(forms) ? forms : [];
    }catch{
      return [];
    }
  }

  function nextLabel(btn){
    const forms = readForms(btn);
    if(forms.length < 2) return '';
    const current = Number(btn.dataset.duoIndex || 0);
    const next = (Number.isFinite(current) ? current + 1 : 1) % forms.length;
    return cleanName(forms[next] && forms[next].name) || 'Next';
  }

  function refreshButton(btn){
    if(!btn || !btn.classList || !btn.classList.contains('duoFormBtn')) return;
    const label = nextLabel(btn);
    if(label) btn.textContent = label;
  }

  function refreshAll(root){
    (root || document).querySelectorAll('.duoFormBtn').forEach(refreshButton);
  }

  function install(){
    const grid = document.getElementById('catalogGrid');
    if(!grid) return;
    refreshAll(grid);

    grid.addEventListener('click', function(event){
      const btn = event.target.closest && event.target.closest('.duoFormBtn');
      if(!btn) return;
      requestAnimationFrame(function(){
        const card = btn.closest('.unitCard');
        refreshAll(card || grid);
      });
    }, false);

    const observer = new MutationObserver(function(records){
      for(const record of records){
        record.addedNodes.forEach(function(node){
          if(node.nodeType !== 1) return;
          if(node.matches && node.matches('.duoFormBtn')) refreshButton(node);
          refreshAll(node);
        });
      }
    });
    observer.observe(grid, {childList:true, subtree:true});
    window.__EVERTALE_V2_DUO_BADGE_LABELS = {installed:true};
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
