(function(){
  function alignDuoSwitches(){
    document.querySelectorAll('.duoFormBtn').forEach(function(btn){
      var card = btn.closest('.unitCard');
      if(!card) return;
      var row = card.querySelector('.stateRow');
      if(!row) return;
      if(btn.parentElement !== row){
        row.appendChild(btn);
      }
      btn.classList.add('duoStateBtn');
    });
  }

  function installCss(){
    if(document.getElementById('catalogUiAlignStyle')) return;
    var s = document.createElement('style');
    s.id = 'catalogUiAlignStyle';
    s.textContent = '.stateRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.stateRow .duoFormBtn.duoStateBtn{width:auto;max-width:130px;margin-left:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;align-self:center}.chipCol>.duoFormBtn{display:none!important}body.mobile-compact .stateRow .duoFormBtn.duoStateBtn{font-size:10px;padding:3px 6px;max-width:92px}';
    document.head.appendChild(s);
  }

  document.addEventListener('DOMContentLoaded', function(){
    installCss();
    alignDuoSwitches();
    var grid = document.getElementById('catalogGrid') || document.body;
    new MutationObserver(alignDuoSwitches).observe(grid, { childList:true, subtree:true });
    setTimeout(alignDuoSwitches, 300);
    setTimeout(alignDuoSwitches, 1000);
    setTimeout(alignDuoSwitches, 2000);
  });
})();
