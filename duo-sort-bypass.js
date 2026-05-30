/* duo-sort-bypass.js — disabled stabilization shim.
   Duo child hiding must happen in data-loader/duo-source-collapse before render.
   DOM-level hiding created mutation loops with catalog sorting and state restoration.
*/
(function(){
  window.EvertaleDuoSortBypassDisabled = true;
})();
