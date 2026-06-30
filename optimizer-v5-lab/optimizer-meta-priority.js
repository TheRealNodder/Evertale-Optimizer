(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;

  const defaults={score:14000,pick:5000,story:3200,anchor:8000};

  function normalize(rows){
    const orders=S.arr(rows).map(S.metaOrder).filter(v=>v>0);
    const min=orders.length?Math.min(...orders):0;
    const max=orders.length?Math.max(...orders):0;
    const span=Math.max(1,max-min);
    return S.arr(rows).map(unit=>{
      const order=S.metaOrder(unit);
      const newer=order>0?(order-min)/span:0;
      const clone={...unit};
      clone.__v5={...(clone.__v5||{}),meta:{order,newer}};
      return clone;
    });
  }
  function boost(unit,type='score',weights=defaults){
    const newer=unit?.__v5?.meta?.newer||0;
    return newer*(weights[type]??defaults[type]??0);
  }
  function compare(a,b){
    return (b?.__v5?.meta?.newer||0)-(a?.__v5?.meta?.newer||0);
  }
  function newest(rows,count){return [...S.arr(rows)].sort(compare).slice(0,Math.max(0,count||0));}

  root.metaPriority={defaults,normalize,boost,compare,newest};
})(window);
