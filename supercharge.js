/* supercharge.js — registers cache layer and warms critical data after first paint. */
(function(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('./sw.js').then(function(reg){
      if(reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      if(navigator.serviceWorker.controller){
        navigator.serviceWorker.controller.postMessage({ type: 'WARM_DATA' });
      }
    }).catch(function(err){
      console.warn('[Supercharge] Service worker registration failed:', err);
    });
  });
})();
