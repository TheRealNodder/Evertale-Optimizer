(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;

  function makeSet(){return{entry:new Set(),family:new Set(),name:new Set()};}
  function addKey(store,key){
    if(!store||!key)return;
    if(key.entry)store.entry.add(key.entry);
    if(key.family)store.family.add(key.family);
    if(key.name)store.name.add(key.name);
  }
  function hasKey(store,key){
    return !!(store&&key&&((key.entry&&store.entry.has(key.entry))||(key.family&&store.family.has(key.family))||(key.name&&store.name.has(key.name))));
  }
  function keyFor(unit){return unit?.__v5?.identity||S.identity(unit);}
  function create(){
    const used=makeSet();
    return{
      used,
      keyFor,
      isUsed(unit){return hasKey(used,keyFor(unit));},
      mark(unit){addKey(used,keyFor(unit));return unit;},
      markId(id,byId){const u=byId&&byId.get(S.txt(id));if(u)this.mark(u);return u;},
      markMany(ids,byId){S.arr(ids).forEach(id=>this.markId(id,byId));},
      rowUsed(ids,byId){const out=makeSet();S.arr(ids).forEach(id=>{const u=byId&&byId.get(S.txt(id));if(u)addKey(out,keyFor(u));});return out;},
      rowConflict(unit,ids,byId){return hasKey(this.rowUsed(ids,byId),keyFor(unit));},
      canUse(unit,ids,byId){return !!unit&&!this.isUsed(unit)&&!this.rowConflict(unit,ids,byId);}
    };
  }

  root.duplicateGuard={create,makeSet,addKey,hasKey,keyFor};
})(window);
