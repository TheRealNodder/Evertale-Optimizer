/* test-catalog-v2-mobile-detail-toggle-fix.js
   Mobile-only detail section toggle guard.
   Lets Leader Skill / Active / Passive / Description open inside the mobile popover.
   Logic only: no style or layout changes.
*/
(function(){
  const BREAKPOINT=820;
  function isMobile(){return window.innerWidth<=BREAKPOINT;}
  function toggleSection(summary){
    const section=summary&&summary.closest('.v2-detail-section');
    if(!section)return;
    section.open=!section.open;
  }
  document.addEventListener('click',function(event){
    if(!isMobile())return;
    const summary=event.target.closest('.v2-detail-section > summary,.v2-detail-tab');
    if(!summary||!summary.closest('.v2-detail-backdrop'))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleSection(summary);
  },true);
  document.addEventListener('pointerdown',function(event){
    if(!isMobile())return;
    if(event.target.closest('.v2-detail-section,.v2-detail-panel')){
      event.stopPropagation();
    }
  },true);
})();
