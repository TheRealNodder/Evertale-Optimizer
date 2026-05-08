/* image-cache-reset.js — clears stale bad-image cache before catalog.js initializes */
(function(){
  try {
    localStorage.removeItem('evertale_bad_img_urls_v1');
    localStorage.removeItem('evertale_bad_img_urls_v2');
  } catch (err) {
    console.warn('[ImageCacheReset] Unable to clear stale image cache', err);
  }
})();
