/* test-catalog-v2-mobile-force.js — final mobile-only runtime visual override.
   Required mobile order:
   Portrait -> Name -> Title -> Stars -> Switch badge -> [Character][Element][SSR] -> [ATK][HP][SPD][COST]
*/
(function(){
  const STYLE_ID = 'v2-mobile-force-layout-style';
  const GENERIC_LEADER = /No Leader Skill|This unit does not provide a leader skill/i;

  const css = `
@media (max-width: 820px){
  body.page-catalog-v2 #catalogGrid{grid-template-columns:1fr!important;gap:12px!important;}
  body.page-catalog-v2 #catalogGrid .unitCard{
    display:flex!important;
    flex-direction:column!important;
    grid-template-columns:none!important;
    grid-template-rows:none!important;
    gap:0!important;
    padding:14px!important;
    border-radius:24px!important;
    min-height:0!important;
    overflow:hidden!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard>.unitLeft{
    order:1!important;
    width:100%!important;
    min-width:0!important;
    margin:0 0 12px!important;
    display:block!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard>.unitLeft .unitThumb{
    width:100%!important;
    height:clamp(300px,76vw,430px)!important;
    min-height:0!important;
    border-radius:20px!important;
    overflow:hidden!important;
    display:flex!important;
    align-items:flex-end!important;
    justify-content:center!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard>.unitLeft .unitThumb img{
    width:100%!important;
    height:100%!important;
    max-height:none!important;
    object-fit:cover!important;
    object-position:center top!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard>.meta{
    order:2!important;
    display:flex!important;
    flex-direction:column!important;
    gap:0!important;
    width:100%!important;
    min-width:0!important;
    padding:0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .metaHeader{
    order:1!important;
    display:flex!important;
    flex-direction:column!important;
    grid-template-columns:none!important;
    gap:0!important;
    align-items:stretch!important;
    width:100%!important;
    min-width:0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .metaMain{
    order:1!important;
    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    text-align:center!important;
    width:100%!important;
    min-width:0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .nameBlock{
    order:1!important;
    width:100%!important;
    text-align:center!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .unitName{
    order:1!important;
    font-size:clamp(19px,5.6vw,24px)!important;
    line-height:1.08!important;
    text-align:center!important;
    margin:0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .unitTitle{
    order:2!important;
    font-size:clamp(13px,3.9vw,16px)!important;
    line-height:1.22!important;
    text-align:center!important;
    max-width:94%!important;
    margin:3px auto 0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .stateRow{
    order:2!important;
    display:flex!important;
    flex-direction:row!important;
    justify-content:center!important;
    align-items:center!important;
    gap:8px!important;
    margin:10px 0 0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .stateBtn{
    width:25px!important;
    height:25px!important;
    min-width:25px!important;
    padding:0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .duoFormBtn{
    order:3!important;
    align-self:center!important;
    margin:9px auto 0!important;
    max-width:190px!important;
    min-height:31px!important;
    padding:7px 12px!important;
    font-size:11px!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .chipCol{
    order:2!important;
    display:flex!important;
    flex-direction:row!important;
    flex-wrap:nowrap!important;
    justify-content:center!important;
    align-items:center!important;
    gap:8px!important;
    width:100%!important;
    max-width:none!important;
    margin:10px 0 0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .chipCol .tag,
  body.page-catalog-v2 #catalogGrid .unitCard .tag.kind,
  body.page-catalog-v2 #catalogGrid .unitCard .tag.element,
  body.page-catalog-v2 #catalogGrid .unitCard .tag.rarity{
    position:static!important;
    inset:auto!important;
    flex:1 1 0!important;
    min-width:0!important;
    max-width:none!important;
    text-align:center!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    font-size:11px!important;
    line-height:1!important;
    padding:7px 10px!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .unitDetails{
    order:2!important;
    display:block!important;
    width:100%!important;
    min-width:0!important;
    margin:11px 0 0!important;
    padding:0!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .leaderBlock{display:none!important;}
  body.page-catalog-v2 #catalogGrid .unitCard .statLine{
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:7px!important;
    width:100%!important;
    padding:8px!important;
    margin:0!important;
    border-radius:16px!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .stat{
    display:flex!important;
    flex-direction:column!important;
    justify-content:center!important;
    align-items:center!important;
    min-width:0!important;
    text-align:center!important;
    border-radius:12px!important;
    padding:8px 4px!important;
  }
  body.page-catalog-v2 #catalogGrid .unitCard .statLabel{font-size:9px!important;}
  body.page-catalog-v2 #catalogGrid .unitCard .statVal{font-size:12px!important;}
}
@media (max-width:430px){
  body.page-catalog-v2 #catalogGrid .unitCard{padding:13px!important;}
  body.page-catalog-v2 #catalogGrid .unitCard>.unitLeft .unitThumb{height:clamp(286px,82vw,390px)!important;}
  body.page-catalog-v2 #catalogGrid .unitCard .chipCol{gap:6px!important;}
  body.page-catalog-v2 #catalogGrid .unitCard .chipCol .tag{font-size:10px!important;padding:6px 7px!important;}
  body.page-catalog-v2 #catalogGrid .unitCard .statLine{gap:5px!important;padding:7px!important;}
  body.page-catalog-v2 #catalogGrid .unitCard .stat{padding:7px 3px!important;}
  body.page-catalog-v2 #catalogGrid .unitCard .statVal{font-size:11px!important;}
}`;

  function injectStyle(){
    let style = document.getElementById(STYLE_ID);
    if(!style){
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  function cleanGenericLeader(root){
    (root || document).querySelectorAll('.leaderBlock').forEach(block => {
      if(GENERIC_LEADER.test(block.textContent || '')) block.remove();
    });
    const desc = document.getElementById('v2Desc');
    if(desc && GENERIC_LEADER.test(desc.textContent || '')) desc.textContent = 'No description loaded for this state.';
  }

  function install(){
    injectStyle();
    cleanGenericLeader(document);
    const grid = document.getElementById('catalogGrid');
    if(grid){
      new MutationObserver(records => {
        injectStyle();
        cleanGenericLeader(grid);
        records.forEach(record => record.addedNodes.forEach(node => {
          if(node.nodeType === 1) cleanGenericLeader(node);
        }));
      }).observe(grid, {childList:true, subtree:true});
    }
    window.__EVERTALE_V2_MOBILE_FORCE = {
      installed:true,
      order:'Portrait > Name > Title > Stars > Switch badge > Badges > Stats',
      version:5
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
})();
