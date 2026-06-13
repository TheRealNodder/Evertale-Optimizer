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
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function isDesktop(){ return window.innerWidth >= BREAKPOINT; }
  function safeText(value){ return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
  function decodeAttrJson(value){ try { return JSON.parse(decodeURIComponent(value || '')); } catch { return []; } }

  function injectStyles(){
    if(document.getElementById('v2-desktop-structure-style')) return;
    const style=document.createElement('style');
    style.id='v2-desktop-structure-style';
    style.textContent=`
      @media (min-width:821px){
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout{
          display:grid!important;
          grid-template-columns:minmax(320px,360px) minmax(0,1fr)!important;
          gap:18px!important;
          align-items:start!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-sidebar{
          --v2-page-viewport-top:72px;
          position:sticky!important;
          top:var(--v2-page-viewport-top)!important;
          height:calc(100dvh - var(--v2-page-viewport-top))!important;
          max-height:calc(100dvh - var(--v2-page-viewport-top))!important;
          min-height:calc(100dvh - var(--v2-page-viewport-top))!important;
          overflow:hidden!important;
          display:flex!important;
          flex-direction:column!important;
          gap:8px!important;
          padding:10px!important;
          border-radius:24px!important;
          background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(8,13,26,.96))!important;
          border:1px solid rgba(255,255,255,.12)!important;
          box-shadow:0 18px 55px rgba(0,0,0,.34)!important;
          contain:layout paint!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-side-title{
          flex:0 0 auto!important;
          display:block!important;
          margin:0 4px 2px!important;
          font-size:12px!important;
          letter-spacing:.14em!important;
          text-transform:uppercase!important;
          color:var(--muted,#b7c0d8)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-main{ min-width:0!important; }
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
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-filter-panel #viewToggle{ display:none!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-description{ width:100%!important; min-width:0!important; margin:0!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card{
          flex:1 1 auto!important;
          min-height:0!important;
          height:100%!important;
          max-height:100%!important;
          display:grid!important;
          grid-template-rows:minmax(180px,34dvh) auto minmax(0,1fr)!important;
          gap:8px!important;
          padding:10px!important;
          overflow:hidden!important;
          border-radius:22px!important;
          background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.03))!important;
          border:1px solid rgba(255,255,255,.12)!important;
        }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art{ grid-row:1!important; flex:initial!important; width:100%!important; min-height:0!important; height:100%!important; max-height:100%!important; border-radius:20px!important; overflow:hidden!important; display:flex!important; align-items:center!important; justify-content:center!important; background:radial-gradient(circle at 50% 18%,rgba(255,255,255,.12),rgba(0,0,0,.20) 62%,rgba(0,0,0,.38))!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art img,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art picture,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-art canvas{ width:100%!important; height:100%!important; object-fit:contain!important; object-position:center center!important; display:block!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-feature-info{ grid-row:2!important; flex:initial!important; width:100%!important; min-width:0!important; min-height:0!important; padding:0!important; overflow:hidden!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-kicker{ display:none!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-name{ font-size:clamp(22px,2.2vw,30px)!important; line-height:1.05!important; text-align:center!important; margin-top:2px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-title{ display:block!important; text-align:center!important; line-height:1.2!important; margin-top:4px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-pill-row{ display:flex!important; flex-wrap:wrap!important; justify-content:center!important; gap:7px!important; margin-top:8px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-pill-row>*{ flex:1 1 0!important; min-width:0!important; min-height:30px!important; padding:6px 10px!important; border-radius:999px!important; text-align:center!important; white-space:nowrap!important; overflow:hidden!important; text-overflow:ellipsis!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stats{ display:grid!important; grid-template-columns:repeat(4,minmax(0,1fr))!important; gap:7px!important; margin-top:8px!important; padding:8px!important; border-radius:16px!important; background:rgba(255,255,255,.045)!important; border:1px solid rgba(255,255,255,.10)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat{ min-width:0!important; border-radius:12px!important; padding:6px 4px!important; text-align:center!important; background:rgba(255,255,255,.065)!important; border:1px solid rgba(255,255,255,.10)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat span{ display:block!important; font-size:10px!important; letter-spacing:.08em!important; color:var(--muted,#b7c0d8)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat b{ display:block!important; margin-top:2px!important; font-size:13px!important; white-space:nowrap!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-description{ grid-row:3!important; flex:initial!important; min-height:0!important; height:100%!important; max-height:100%!important; overflow:hidden!important; display:flex!important; flex-direction:column!important; gap:9px!important; padding:10px!important; border-radius:18px!important; background:rgba(0,0,0,.18)!important; border:1px solid rgba(255,255,255,.10)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-desc-head{ flex:0 0 auto!important; display:flex!important; flex-direction:column!important; gap:8px!important; align-items:stretch!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-desc-head h2{ margin:0!important; font-size:12px!important; letter-spacing:.12em!important; text-transform:uppercase!important; color:var(--muted,#b7c0d8)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tabs{ display:grid!important; grid-template-columns:repeat(2,minmax(0,1fr))!important; gap:7px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn{ min-width:0!important; min-height:34px!important; border-radius:999px!important; border:1px solid color-mix(in srgb,var(--element-primary,#f6ca5e) 54%,rgba(255,255,255,.14))!important; background:rgba(255,255,255,.06)!important; color:#fff!important; font-weight:850!important; font-size:12px!important; cursor:pointer!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn.active{ background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#f6ca5e) 78%,#fff 22%) 0%,var(--element-primary,#f6ca5e) 46%,color-mix(in srgb,var(--element-secondary,#a855f7) 78%,#111827 22%) 100%)!important; border-color:rgba(255,255,255,.32)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel{ flex:1 1 auto!important; min-height:0!important; overflow:auto!important; overscroll-behavior:contain!important; border-radius:14px!important; padding:12px!important; background:rgba(0,0,0,.18)!important; border:1px solid rgba(255,255,255,.10)!important; line-height:1.35!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel p{ margin:0 0 10px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel strong{ color:#fff!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-desc-text{ display:none!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid{ grid-template-columns:repeat(4,minmax(0,1fr))!important; gap:12px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard{ min-height:430px!important; padding:10px!important; gap:9px!important; border-radius:20px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitThumb{ height:clamp(190px,18vw,260px)!important; min-height:190px!important; border-radius:16px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitThumb img{ object-fit:contain!important; object-position:center center!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitThumb::after{ width:46px!important; height:46px!important; top:8px!important; right:8px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitName{ font-size:clamp(17px,1.35vw,22px)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .unitTitle{ font-size:clamp(12px,1vw,14px)!important; white-space:normal!important; word-break:normal!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .v2-detail-btn,
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .v2-detail-backdrop{ display:none!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .statLine{ grid-template-columns:repeat(4,minmax(0,1fr))!important; gap:5px!important; padding:6px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .stat{ border-radius:12px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .statLabel{ font-size:10px!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid .unitCard .statVal{ font-size:13px!important; }

        @media (min-width:821px) and (max-height:760px){
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-selected-card{ grid-template-rows:minmax(150px,30dvh) auto minmax(0,1fr)!important; gap:6px!important; padding:8px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-name{ font-size:clamp(19px,2vw,25px)!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-title{ margin-top:2px!important; font-size:12px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-pill-row{ margin-top:5px!important; gap:5px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stats{ gap:4px!important; margin-top:5px!important; padding:5px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat{ padding:4px 3px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat span{ font-size:8px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-stat b{ font-size:11px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-description{ gap:6px!important; padding:8px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-tab-btn{ min-height:30px!important; font-size:11px!important; }
          body.page-catalog-v2 .v2-shell.v2-desktop-info-layout .v2-detail-scroll-panel{ padding:9px!important; }
        }
      }
      @media (min-width:821px) and (max-width:1180px){
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout{ grid-template-columns:minmax(290px,320px) minmax(0,1fr)!important; }
        body.page-catalog-v2 .v2-shell.v2-desktop-info-layout #catalogGrid{ grid-template-columns:repeat(3,minmax(0,1fr))!important; }
      }
      @media (max-width:820px){ body.page-catalog-v2 .v2-filter-panel, body.page-catalog-v2 .v2-filter-title{ display:contents!important; } }
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

  function makeDetailsModule(){
    const description = qs('.v2-description');
    if(!description) return;
    let head = qs('.v2-desc-head', description);
    if(!head){ head = document.createElement('div'); head.className = 'v2-desc-head'; description.insertBefore(head, description.firstChild); }
    let title = qs('h2', head);
    if(!title){ title = document.createElement('h2'); head.insertBefore(title, head.firstChild); }
    title.textContent = 'Details';
    let tabs = qs('.v2-detail-tabs', description);
    if(!tabs){
      tabs = document.createElement('div');
      tabs.className = 'v2-detail-tabs';
      tabs.innerHTML = [['description','Description'],['leader','Leader'],['active','Active'],['passive','Passive']].map(([key,label]) => `<button type="button" class="v2-detail-tab-btn${key==='description'?' active':''}" data-v2-detail-kind="${key}">${label}</button>`).join('');
      head.appendChild(tabs);
    }
    let panel = qs('.v2-detail-scroll-panel', description);
    if(!panel){ panel = document.createElement('div'); panel.className = 'v2-detail-scroll-panel'; description.appendChild(panel); }
  }

  function currentSelectedCard(){ return qs('#catalogGrid .unitCard.v2-selected') || qs('#catalogGrid .unitCard'); }
  function rowsFromCard(card, attr){ if(!card) return []; return decodeAttrJson(card.getAttribute(attr)); }
  function renderSkillRows(rows){
    if(!Array.isArray(rows) || !rows.length) return '<p>No skills loaded.</p>';
    return rows.map(row => `<p><strong>${safeText(row?.name || row?.id || 'Skill')}</strong><br>${safeText(row?.description || 'No description loaded.')}</p>`).join('');
  }
  function leaderHtml(card){
    if(!card) return '<p>No leader skill loaded.</p>';
    const block = qs('.leaderBlock', card);
    const name = qs('.leaderName', block)?.textContent || '';
    const desc = qs('.leaderDesc', block)?.textContent || '';
    if(name || desc) return `<p><strong>${safeText(name || 'Leader Skill')}</strong><br>${safeText(desc || 'No leader skill description loaded.')}</p>`;
    return '<p>No leader skill loaded.</p>';
  }
  function descriptionHtml(){ return `<p>${safeText(qs('#v2Desc')?.textContent || 'No description loaded.')}</p>`; }
  function activeDetailKind(){ return qs('.v2-detail-tab-btn.active')?.getAttribute('data-v2-detail-kind') || 'description'; }
  function updateDetailPanel(kind = activeDetailKind()){
    if(!isDesktop()) return;
    makeDetailsModule();
    const panel = qs('.v2-detail-scroll-panel');
    if(!panel) return;
    const card = currentSelectedCard();
    qsa('.v2-detail-tab-btn').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-v2-detail-kind') === kind));
    if(kind === 'leader') panel.innerHTML = leaderHtml(card);
    else if(kind === 'active') panel.innerHTML = renderSkillRows(rowsFromCard(card, 'data-active-skills'));
    else if(kind === 'passive') panel.innerHTML = renderSkillRows(rowsFromCard(card, 'data-passive-skills'));
    else panel.innerHTML = descriptionHtml();
    panel.scrollTop = 0;
  }
  function attachDetailHandlers(){
    if(document.__v2DesktopDetailsBound) return;
    document.__v2DesktopDetailsBound = true;
    document.addEventListener('click', event => {
      const tab = event.target.closest('.v2-detail-tab-btn');
      if(tab){ updateDetailPanel(tab.getAttribute('data-v2-detail-kind') || 'description'); return; }
      const card = event.target.closest('#catalogGrid .unitCard');
      if(card) setTimeout(() => updateDetailPanel(activeDetailKind()), 80);
    }, true);
    const desc = qs('#v2Desc');
    if(desc) new MutationObserver(() => updateDetailPanel(activeDetailKind())).observe(desc, { childList:true, subtree:true, characterData:true });
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
    if(!originalSidebarParent){ originalSidebarParent = sidebar.parentNode; originalSidebarNext = sidebar.nextSibling; originalHeroParent = hero.parentNode; originalHeroFirst = hero.firstChild; originalSelectedNext = selected.nextSibling; originalControlsNext = controls.nextSibling; }
    shell.classList.add('v2-desktop-info-layout');
    if(sidebarTitle) sidebarTitle.textContent = 'Selected Info';
    const panel = makeFilterPanel();
    if(!panel.parentNode) hero.insertBefore(panel, hero.firstChild);
    if(controls.parentNode !== panel) panel.appendChild(controls);
    if(selected.parentNode !== sidebar) sidebar.appendChild(selected);
    if(description && description.parentNode !== selected) selected.appendChild(description);
    makeDetailsModule();
    attachDetailHandlers();
    setTimeout(() => updateDetailPanel(activeDetailKind()), 90);
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
    if(sidebar && controls && controls.parentNode !== sidebar){ if(originalControlsNext && originalControlsNext.parentNode === sidebar) sidebar.insertBefore(controls, originalControlsNext); else sidebar.appendChild(controls); }
    if(hero && selected && selected.parentNode !== hero){ if(originalHeroFirst && originalHeroFirst.parentNode === hero) hero.insertBefore(selected, originalHeroFirst); else hero.insertBefore(selected, hero.firstChild); }
    if(hero && description && description.parentNode !== hero){ if(originalSelectedNext && originalSelectedNext.parentNode === hero) hero.insertBefore(description, originalSelectedNext); else hero.appendChild(description); }
    const panel = qs('.v2-filter-panel');
    if(panel && !panel.querySelector('.controls')) panel.remove();
    moved = false;
  }
  function apply(){ injectStyles(); if(isDesktop()) applyDesktop(); else restoreMobile(); }
  function boot(){ apply(); setTimeout(apply, 250); setTimeout(apply, 900); window.addEventListener('resize', () => requestAnimationFrame(apply)); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
