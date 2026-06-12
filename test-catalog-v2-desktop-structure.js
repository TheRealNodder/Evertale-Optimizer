/* test-catalog-v2-desktop-structure.js
   Desktop-only structure pass:
   - left sticky sidebar becomes selected character info
   - top module becomes filters
   - desktop cards shrink for four-across layout
   - mobile layout remains controlled by existing mobile files
*/
(function(){
  const BREAKPOINT = 821;
  let moved = false;
  let originalSidebarParent = null;
  let originalSidebarNext = null;
  let originalHeroParent = null;
  let originalHeroFirst = null;
  let originalSelectedNext = null;
  let originalControlsNext = null;

  function qs(sel, root=document){ return root.querySelector(sel); }
  function isDesktop(){ return window.innerWidth >= BREAKPOINT; }

  function injectStyles(){
    if(document.getElementById('v2-desktop-structure-style')) return;
    const style=document.createElement('style');
    style.id='v2-desktop-structure-style';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout{
          display:grid!important;
          grid-template-columns:minmax(280px,320px) minmax(0,1fr)!important;
          gap:18px!important;
          align-items:start!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar{
          position:sticky!important;
          top:12px!important;
          max-height:calc(100vh - 24px)!important;
          overflow:auto!important;
          padding:12px!important;
          border-radius:24px!important;
          background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(8,13,26,.96))!important;
          border:1px solid rgba(255,255,255,.12)!important;
          box-shadow:0 18px 55px rgba(0,0,0,.34)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-side-title{
          display:block!important;
          margin:2px 4px 10px!important;
          font-size:12px!important;
          letter-spacing:.14em!important;
          text-transform:uppercase!important;
          color:var(--muted,#b7c0d8)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-main{
          min-width:0!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-hero{
          display:block!important;
          position:sticky!important;
          top:0!important;
          z-index:50!important;
          margin-bottom:14px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-filter-panel{
          display:flex!important;
          flex-direction:column!important;
          gap:10px!important;
          padding:14px!important;
          border-radius:24px!important;
          background:linear-gradient(135deg,rgba(20,26,48,.94),rgba(8,13,26,.95))!important;
          border:1px solid rgba(255,255,255,.12)!important;
          box-shadow:0 18px 50px rgba(0,0,0,.28)!important;
          backdrop-filter:blur(12px)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-filter-title{
          font-size:12px!important;
          letter-spacing:.14em!important;
          text-transform:uppercase!important;
          color:var(--muted,#b7c0d8)!important;
          font-weight:850!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-filter-panel .controls{
          display:grid!important;
          grid-template-columns:minmax(240px,1fr) minmax(145px,180px) minmax(145px,180px)!important;
          gap:10px!important;
          align-items:center!important;
          margin:0!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-filter-panel #viewToggle{
          display:none!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-description{
          width:100%!important;
          min-width:0!important;
          margin:0 0 12px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card{
          display:flex!important;
          flex-direction:column!important;
          gap:10px!important;
          padding:10px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art{
          width:100%!important;
          min-height:0!important;
          height:clamp(220px,34vh,360px)!important;
          border-radius:20px!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art img,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art picture,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art canvas{
          width:100%!important;
          height:100%!important;
          object-fit:cover!important;
          object-position:center top!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-info{
          width:100%!important;
          min-width:0!important;
          padding:0!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-name{
          font-size:clamp(22px,2.2vw,30px)!important;
          line-height:1.05!important;
          text-align:center!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-title{
          display:block!important;
          text-align:center!important;
          line-height:1.2!important;
          margin-top:4px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stats{
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:8px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-description{
          max-height:34vh!important;
          overflow:auto!important;
          padding:12px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid{
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:12px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard{
          min-height:430px!important;
          padding:10px!important;
          gap:9px!important;
          border-radius:20px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitThumb{
          height:clamp(190px,18vw,260px)!important;
          min-height:190px!important;
          border-radius:16px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitThumb::after{
          width:46px!important;
          height:46px!important;
          top:8px!important;
          right:8px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitName{
          font-size:clamp(17px,1.35vw,22px)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitTitle{
          font-size:clamp(12px,1vw,14px)!important;
          white-space:normal!important;
          word-break:normal!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .v2-detail-btn,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .v2-detail-backdrop{
          display:none!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .statLine{
          gap:5px!important;
          padding:6px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .statLabel{
          font-size:10px!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .statVal{
          font-size:13px!important;
        }
      }
      @media (min-width:821px) and (max-width:1180px){
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout{
          grid-template-columns:minmax(250px,290px) minmax(0,1fr)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid{
          grid-template-columns:repeat(3,minmax(0,1fr))!important;
        }
      }
      @media (max-width:820px){
        body.page-catalog-v2 .v2-filter-panel,
        body.page-catalog-v2 .v2-filter-title{
          display:contents!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function makeFilterPanel(){
    let panel = qs('.v2-filter-panel');
    if(panel) return panel;
    panel = document.createElement('section');
    panel.className = 'v2-panel v2-filter-panel';
    panel.innerHTML = '<div class="v2-filter-title">Filters</div>';
    return panel;
  }

  function applyDesktop(){
    const shell = qs('.v2-shell');
    const sidebar = qs('.v2-sidebar');
    const sidebarTitle = qs('.v2-side-title', sidebar);
    const controls = qs('.controls', sidebar);
    const hero = qs('.v2-hero');
    const selected = qs('.v2-selected-card');
    const description = qs('.v2-description');
    if(!shell || !sidebar || !controls || !hero || !selected) return;
    if(!originalSidebarParent){
      originalSidebarParent = sidebar.parentNode;
      originalSidebarNext = sidebar.nextSibling;
      originalHeroParent = hero.parentNode;
      originalHeroFirst = hero.firstChild;
      originalSelectedNext = selected.nextSibling;
      originalControlsNext = controls.nextSibling;
    }
    shell.classList.add('v2-desktop-info-layout');
    if(sidebarTitle) sidebarTitle.textContent = 'Selected Info';
    const panel = makeFilterPanel();
    if(!panel.parentNode) hero.insertBefore(panel, hero.firstChild);
    if(controls.parentNode !== panel) panel.appendChild(controls);
    if(selected.parentNode !== sidebar) sidebar.appendChild(selected);
    if(description && description.parentNode !== sidebar) sidebar.appendChild(description);
    moved = true;
  }

  function restoreMobile(){
    if(!moved) return;
    const shell = qs('.v2-shell');
    const sidebar = qs('.v2-sidebar');
    const sidebarTitle = qs('.v2-side-title', sidebar);
    const controls = qs('.controls');
    const hero = qs('.v2-hero');
    const selected = qs('.v2-selected-card');
    const description = qs('.v2-description');
    if(shell) shell.classList.remove('v2-desktop-info-layout');
    if(sidebarTitle) sidebarTitle.textContent = 'Filters';
    if(sidebar && controls && controls.parentNode !== sidebar){
      if(originalControlsNext && originalControlsNext.parentNode === sidebar) sidebar.insertBefore(controls, originalControlsNext);
      else sidebar.appendChild(controls);
    }
    if(hero && selected && selected.parentNode !== hero){
      if(originalHeroFirst && originalHeroFirst.parentNode === hero) hero.insertBefore(selected, originalHeroFirst);
      else hero.insertBefore(selected, hero.firstChild);
    }
    if(hero && description && description.parentNode !== hero){
      if(originalSelectedNext && originalSelectedNext.parentNode === hero) hero.insertBefore(description, originalSelectedNext);
      else hero.appendChild(description);
    }
    const panel = qs('.v2-filter-panel');
    if(panel && !panel.querySelector('.controls')) panel.remove();
    moved = false;
  }

  function apply(){
    injectStyles();
    if(isDesktop()) applyDesktop();
    else restoreMobile();
  }

  function boot(){
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 900);
    window.addEventListener('resize', () => requestAnimationFrame(apply));
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
