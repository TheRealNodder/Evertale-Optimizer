/* test-catalog-v2-clean-generic-leader.js — removes fake/default leader text only. */
(function(){
  const GENERIC = /No Leader Skill|This unit does not provide a leader skill/i;

  function clean(root){
    (root || document).querySelectorAll('.leaderBlock').forEach(block => {
      if(GENERIC.test(block.textContent || '')) block.remove();
    });
    const desc = document.getElementById('v2Desc');
    if(desc && GENERIC.test(desc.textContent || '')) desc.textContent = 'No description loaded for this state.';
  }

  function install(){
    const grid = document.getElementById('catalogGrid');
    clean(document);
    if(!grid) return;
    const observer = new MutationObserver(records => {
      clean(grid);
      for(const record of records){
        record.addedNodes.forEach(node => {
          if(node.nodeType === 1) clean(node);
        });
      }
    });
    observer.observe(grid, {childList:true, subtree:true});
    document.addEventListener('click', () => requestAnimationFrame(() => clean(document)), true);
    window.__EVERTALE_V2_CLEAN_GENERIC_LEADER = {installed:true};
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
