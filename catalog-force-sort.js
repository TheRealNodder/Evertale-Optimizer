/* catalog-force-sort.js
   Sorting, default category, and progressive rendering are owned by
   catalog-v2-lite.js. This compatibility stub avoids the old MutationObserver
   and DOM reordering pass that could fight virtualization.
*/
(function(){
  window.__EVERTALE_CATALOG_FORCE_SORT_DISABLED = true;
})();
