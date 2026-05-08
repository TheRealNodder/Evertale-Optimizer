/* image-cache-reset.js — disables stale bad-image cache before catalog.js initializes */
(function(){
  const BAD_KEYS = new Set([
    'evertale_bad_img_urls_v1',
    'evertale_bad_img_urls_v2'
  ]);

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
})();
