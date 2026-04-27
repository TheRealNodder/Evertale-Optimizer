(function(){
  function pageKey(){
    const path = (location.pathname || '').toLowerCase();
    if (path.includes('roster')) return 'roster';
    if (path.includes('optimizer')) return 'optimizer';
    return 'catalog';
  }
  function themeOptions(){
    const labels = window.EvertaleTheme?.labels || {};
    const keys = ['auto','default','spring','summer','autumn','winter','halloween','thanksgiving','christmas','newyear','valentine','stpatrick','easter','independence'];
    return keys.map(k=>`<option value="${k}">${labels[k] || k}</option>`).join('');
  }
  function closeMenu(){
    document.body.classList.remove('sideMenuOpen');
    document.querySelector('.sideMenu')?.setAttribute('aria-hidden','true');
    document.querySelector('.sideMenuToggle')?.setAttribute('aria-expanded','false');
  }
  function openMenu(){
    document.body.classList.add('sideMenuOpen');
    document.querySelector('.sideMenu')?.setAttribute('aria-hidden','false');
    document.querySelector('.sideMenuToggle')?.setAttribute('aria-expanded','true');
  }
  function toggleMenu(){ document.body.classList.contains('sideMenuOpen') ? closeMenu() : openMenu(); }

  function build(){
    if (document.querySelector('.sideMenu')) return;
    const cur = pageKey();
    const topbarInner = document.querySelector('.topbar-inner');
    if (topbarInner && !document.querySelector('.sideMenuToggle')) {
      const btn = document.createElement('button');
      btn.className = 'sideMenuToggle';
      btn.type = 'button';
      btn.setAttribute('aria-label','Open menu');
      btn.setAttribute('aria-expanded','false');
      btn.innerHTML = '<span></span><span></span><span></span>';
      topbarInner.prepend(btn);
    }

    const overlay = document.createElement('div');
    overlay.className = 'sideMenuOverlay';
    overlay.setAttribute('aria-hidden','true');

    const menu = document.createElement('aside');
    menu.className = 'sideMenu';
    menu.setAttribute('aria-hidden','true');
    menu.innerHTML = `
      <div class="sideMenuHead">
        <div>
          <div class="sideMenuTitle">Evertale Optimizer</div>
          <div class="sideMenuSub">Quick navigation</div>
        </div>
        <button class="sideMenuClose" type="button" aria-label="Close menu">×</button>
      </div>

      <div class="sideThemeBlock">
        <label class="sideThemeLabel" for="sideThemeSelect">Style</label>
        <select id="sideThemeSelect" class="input sideThemeSelect">${themeOptions()}</select>
      </div>

      <nav class="sideNav" aria-label="Site navigation">
        <details class="sideGroup" ${cur==='catalog'?'open':''}>
          <summary>Catalog</summary>
          <a href="./index.html?type=all">All</a>
          <a href="./index.html?type=characters">Characters</a>
          <a href="./index.html?type=weapons">Weapons</a>
          <a href="./index.html?type=accessories">Accessories</a>
          <a href="./index.html?type=bosses">Bosses</a>
        </details>
        <details class="sideGroup" ${cur==='roster'?'open':''}>
          <summary>Roster</summary>
          <a href="./roster.html">My Roster</a>
          <a href="./roster.html#owned">Owned Units</a>
          <a href="./roster.html#filters">Filters</a>
        </details>
        <details class="sideGroup" ${cur==='optimizer'?'open':''}>
          <summary>Optimizer</summary>
          <a href="./optimizer.html">Optimizer Home</a>
          <a href="./optimizer.html#storySection">Story Team</a>
          <a href="./optimizer.html#platoonsSection">Platoons</a>
          <a href="./optimizer.html#storageGrid">Storage</a>
        </details>
      </nav>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    const select = menu.querySelector('#sideThemeSelect');
    if (select) {
      select.value = window.EvertaleTheme?.getChoice?.() || 'auto';
      select.addEventListener('change', ()=>window.EvertaleTheme?.applyTheme?.(select.value));
      document.addEventListener('evertale-theme-change', e => { select.value = e.detail?.choice || 'auto'; });
    }

    document.querySelector('.sideMenuToggle')?.addEventListener('click', toggleMenu);
    menu.querySelector('.sideMenuClose')?.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    menu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, {once:true}); else build();
})();
