/* image-cache-reset.js — disables stale bad-image cache and refreshes ImageKit photo URLs only */
(function(){
  const BAD_KEYS = new Set([
    'evertale_bad_img_urls_v1',
    'evertale_bad_img_urls_v2'
  ]);
  const IMAGEKIT_BASE = 'https://ik.imagekit.io/r8fsa98s9/';
  const CONFIG = window.EVERTALE_LIVE_CONFIG || {};
  const IMAGE_VERSION = String(CONFIG.imageVersion || CONFIG.imageCacheVersion || CONFIG.dataVersion || CONFIG.version || '').trim();

  function versionImageUrl(value){
    const raw = String(value || '');
    if (!raw || !IMAGE_VERSION || !raw.includes(IMAGEKIT_BASE)) return value;
    try {
      const url = new URL(raw, window.location.href);
      if (!url.href.includes(IMAGEKIT_BASE)) return value;
      if (url.searchParams.get('imgv') === IMAGE_VERSION) return value;
      url.searchParams.set('imgv', IMAGE_VERSION);
      return url.href;
    } catch (_) {
      if (/([?&])imgv=/.test(raw)) return raw.replace(/([?&])imgv=[^&]*/g, '$1imgv=' + encodeURIComponent(IMAGE_VERSION));
      const sep = raw.includes('?') ? '&' : '?';
      return raw + sep + 'imgv=' + encodeURIComponent(IMAGE_VERSION);
    }
  }

  function refreshImages(root){
    if (!IMAGE_VERSION) return;
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('img[src*="ik.imagekit.io/r8fsa98s9/"]').forEach(img => {
      const next = versionImageUrl(img.getAttribute('src') || img.src || '');
      if (next && next !== img.getAttribute('src')) img.setAttribute('src', next);
    });
  }

  let scheduled = false;
  function scheduleRefresh(root){
    if (scheduled) return;
    scheduled = true;
    const run = () => { scheduled = false; refreshImages(root); };
    if ('requestAnimationFrame' in window) requestAnimationFrame(run);
    else setTimeout(run, 32);
  }

  try {
    for (const key of BAD_KEYS) localStorage.removeItem(key);

    const originalGetItem = localStorage.getItem.bind(localStorage);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);

    localStorage.getItem = function(key){
      if (BAD_KEYS.has(String(key))) return '[]';
      return originalGetItem(key);
    };

    localStorage.setItem = function(key, value){
      if (BAD_KEYS.has(String(key))) return;
      return originalSetItem(key, value);
    };

    localStorage.removeItem = function(key){
      if (BAD_KEYS.has(String(key))) return originalRemoveItem(key);
      return originalRemoveItem(key);
    };
  } catch (err) {
    console.warn('[ImageCacheReset] Unable to disable stale image cache', err);
  }

  try {
    window.EvertaleImageCache = Object.assign({}, window.EvertaleImageCache || {}, {
      imageVersion: IMAGE_VERSION,
      versionImageUrl,
      refreshImages,
      scheduleRefresh
    });

    document.addEventListener('DOMContentLoaded', () => {
      scheduleRefresh(document);
      [150, 600, 1400, 3200, 6500].forEach(ms => setTimeout(() => scheduleRefresh(document), ms));
    }, { once: true });
    document.addEventListener('v2:card-selected', e => scheduleRefresh(e.detail?.card || document), true);
    document.addEventListener('v2:hero-state-change', e => scheduleRefresh(e.detail?.card || document), true);
    document.addEventListener('click', e => scheduleRefresh(e.target?.closest?.('.unitCard') || document), true);
    document.addEventListener('input', () => scheduleRefresh(document), true);
    document.addEventListener('change', () => scheduleRefresh(document), true);
    window.addEventListener('scroll', () => scheduleRefresh(document), { passive: true });
  } catch (err) {
    console.warn('[ImageCacheReset] Unable to refresh ImageKit photo URLs', err);
  }
})();