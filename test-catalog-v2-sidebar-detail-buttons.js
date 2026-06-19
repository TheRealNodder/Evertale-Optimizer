/* test-catalog-v2-sidebar-detail-buttons.js
   Desktop sidebar-only detail controls.
   Adds the four detail buttons directly under the selected sidebar stats.
*/
(function(){
  const BREAKPOINT = 821;
  let activeKind = 'leader';

  function qs(sel, root=document){ return root&&root.querySelector?root.querySelector(sel):null; }
  function qsa(sel, root=document){ return root&&root.querySelectorAll?Array.from(root.querySelectorAll(sel)):[]; }
  function isDesktop(){ return window.innerWidth >= BREAKPOINT; }
  function safe(value){ return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/\n/g,'<br>'); }
  function decodeRows(value){ try { const rows = JSON.parse(decodeURIComponent(value || '')); return Array.isArray(rows) ? rows : []; } catch { return []; } }
  function cardBySelectedId(){ const id = window.EvertaleCatalogV2?.getSelectedId?.() || qs('#v2AwakenTabs')?.dataset?.v2ActiveCard || ''; if(!id) return null; const esc = window.CSS&&window.CSS.escape ? window.CSS.escape(String(id)) : String(id).replace(/"/g,'\\"'); return qs(`#catalogGrid .unitCard[data-id="${esc}"],#catalogGrid .unitCard[data-source-id="${esc}"],#catalogGrid .unitCard[data-family="${esc}"]`); }
  function selectedCard(){ return window.EvertaleCatalogV2?.selectedCard?.() || qs('#catalogGrid .unitCard.v2-selected') || cardBySelectedId(); }

  function injectStyle(){
    if(qs('#v2-sidebar-detail-buttons-style')) return;
    const style = document.createElement('style');
    style.id = 'v2-sidebar-detail-buttons-style';
    style.textContent = `
      @media (min-width:821px){
        body.page-catalog-v2 .v2-sidebar #v2SidebarDetailMount{
          display:flex!important;
          flex-direction:column!important;
          gap:8px!important;
          width:100%!important;
          min-height:0!important;
          flex:1 1 auto!important;
          margin-top:2px!important;
          overflow:hidden!important;
        }
        body.page-catalog-v2 .v2-sidebar #v2SidebarDetailTabs{
          display:grid!important;
          grid-template-columns:repeat(4,minmax(0,1fr))!important;
          gap:6px!important;
          width:100%!important;
          flex:0 0 auto!important;
        }
        body.page-catalog-v2 .v2-sidebar #v2SidebarDetailTabs button{
          min-width:0!important;
          min-height:34px!important;
          border-radius:12px!important;
          border:1px solid color-mix(in srgb,var(--element-primary,#a855f7) 42%,rgba(255,255,255,.16))!important;
          background:rgba(255,255,255,.065)!important;
          color:#fff!important;
          font-size:9px!important;
          font-weight:900!important;
          line-height:1.05!important;
          text-align:center!important;
          text-transform:uppercase!important;
          letter-spacing:.02em!important;
          padding:6px 4px!important;
          cursor:pointer!important;
        }
        body.page-catalog-v2 .v2-sidebar #v2SidebarDetailTabs button.active{
          background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#a855f7) 78%,#fff 22%) 0%,var(--element-primary,#a855f7) 48%,color-mix(in srgb,var(--element-secondary,#581c87) 78%,#111827 22%) 100%)!important;
          border-color:rgba(255,255,255,.32)!important;
        }
        body.page-catalog-v2 .v2-sidebar #v2SidebarDetailPanel{
          flex:1 1 auto!important;
          min-height:72px!important;
          overflow:auto!important;
          overscroll-behavior:contain!important;
          border-radius:14px!important;
          padding:12px!important;
          background:linear-gradient(145deg,color-mix(in srgb,var(--element-primary,#a855f7) 14%,rgba(0,0,0,.22)),rgba(0,0,0,.20))!important;
          border:1px solid color-mix(in srgb,var(--element-primary,#a855f7) 32%,rgba(255,255,255,.12))!important;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important;
          line-height:1.35!important;
          color:#fff!important;
        }
        body.page-catalog-v2 .v2-sidebar #v2SidebarDetailPanel p{margin:0 0 10px!important;}
        body.page-catalog-v2 .v2-sidebar #v2SidebarDetailPanel strong{color:#fff!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function skillRows(card, type){
    const attr = type === 'active' ? 'data-active-skills' : 'data-passive-skills';
    const rows = decodeRows(card?.getAttribute(attr));
    return rows.map(row => ({
      name: row?.name || row?.id || 'Skill',
      meta: [row?.tu ? `${row.tu} TU` : '', row?.sp !== undefined ? `${Number(row.sp) > 0 ? '+' : ''}${row.sp} SP` : ''].filter(Boolean).join(' • '),
      desc: row?.description || 'No description loaded.'
    }));
  }

  function renderSkill(card, type){
    const rows = skillRows(card, type);
    if(!rows.length) return '<p>No skills loaded.</p>';
    return rows.map(row => `<p><strong>${safe(row.name)}</strong>${row.meta ? `<br><span>${safe(row.meta)}</span>` : ''}<br>${safe(row.desc)}</p>`).join('');
  }

  function renderLeader(card){
    const name = qs('.leaderName', card)?.textContent?.trim() || 'Leader Skill';
    const desc = qs('.leaderDesc', card)?.textContent?.trim() || 'No leader skill loaded.';
    return `<p><strong>${safe(name)}</strong><br>${safe(desc)}</p>`;
  }

  function renderDescription(card){
    const desc = qs('#v2Desc')?.textContent?.trim() || qs('.descriptionText', card)?.textContent?.trim() || 'No description loaded.';
    return `<p>${safe(desc)}</p>`;
  }

  function render(kind=activeKind){
    const panel = qs('#v2SidebarDetailPanel');
    if(!panel) return;
    const card = selectedCard();
    activeKind = kind || 'leader';
    qsa('#v2SidebarDetailTabs button').forEach(btn => btn.classList.toggle('active', btn.dataset.sidebarDetail === activeKind));
    if(activeKind === 'leader') panel.innerHTML = renderLeader(card);
    else if(activeKind === 'active') panel.innerHTML = renderSkill(card, 'active');
    else if(activeKind === 'passive') panel.innerHTML = renderSkill(card, 'passive');
    else panel.innerHTML = renderDescription(card);
  }

  function ensure(){
    injectStyle();
    if(!isDesktop()) return;
    const stats = qs('.v2-sidebar .v2-stats');
    if(!stats) return;
    let mount = qs('#v2SidebarDetailMount');
    if(!mount){
      mount = document.createElement('div');
      mount.id = 'v2SidebarDetailMount';
      mount.innerHTML = `
        <div id="v2SidebarDetailTabs">
          <button type="button" data-sidebar-detail="leader" class="active">Leader Skill</button>
          <button type="button" data-sidebar-detail="active">Active Skill</button>
          <button type="button" data-sidebar-detail="passive">Passive Skill</button>
          <button type="button" data-sidebar-detail="description">Description</button>
        </div>
        <div id="v2SidebarDetailPanel"></div>
      `;
      stats.insertAdjacentElement('afterend', mount);
    } else if(mount.previousElementSibling !== stats){
      stats.insertAdjacentElement('afterend', mount);
    }
    render(activeKind);
  }

  let ensureRaf = 0;
  function scheduleEnsure(){
    if(ensureRaf) return;
    ensureRaf = requestAnimationFrame(() => {
      ensureRaf = 0;
      ensure();
    });
  }

  function watchStableSurfaces(){
    const targets = [qs('#catalogGrid'), qs('.v2-sidebar')].filter(Boolean);
    if(!targets.length) return false;
    const observer = new MutationObserver(scheduleEnsure);
    targets.forEach(target => observer.observe(target, { childList:true }));
    return true;
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest('#v2SidebarDetailTabs button');
    if(!btn) return;
    event.preventDefault();
    event.stopPropagation();
    render(btn.dataset.sidebarDetail || 'leader');
  }, true);

  document.addEventListener('v2:hero-state-change', () => requestAnimationFrame(() => render(activeKind)));
  document.addEventListener('DOMContentLoaded', () => { ensure(); setTimeout(ensure,250); setTimeout(ensure,900); setTimeout(ensure,1600); if(!watchStableSurfaces())setTimeout(watchStableSurfaces,900); });
  window.addEventListener('resize', scheduleEnsure);
})();
