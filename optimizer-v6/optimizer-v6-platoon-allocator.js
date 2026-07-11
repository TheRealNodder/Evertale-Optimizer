(function(g){
  'use strict';
  const root=g.OptimizerV6=g.OptimizerV6||{},P=root.policy,G=root.platoonGenerator,S=root.storySearch;
  if(!P||!G||!S)return;
  const rows=value=>Array.isArray(value)?value:[],num=value=>Number.isFinite(Number(value))?Number(value):0,uid=unit=>P.txt(unit?.id||unit?.sourceId||unit?.family||unit?.name);

  function rowConflicts(row,used){return row.units.some(unit=>used.some(other=>P.identityConflicts(unit,other)));}
  function mark(row,used){row.units.forEach(unit=>used.push(unit));}
  function objective(selected){
    const active=selected.filter(Boolean),filled=active.reduce((sum,row)=>sum+row.units.length,0),complete=active.filter(row=>row.units.length===P.platoons.size&&row.viable!==false).length,scores=active.map(row=>num(row.score));
    return{filled,complete,weakest:scores.length?Math.min(...scores):0,total:scores.reduce((sum,value)=>sum+value,0),diversity:new Set(active.map(row=>`${row.element||'mixed'}:${row.plan}`)).size};
  }
  function better(a,b){for(const key of ['filled','complete','weakest','total','diversity'])if(num(a[key])!==num(b[key]))return num(a[key])>num(b[key]);return false;}

  function scarcity(candidates){const counts=new Map();for(const row of candidates)for(const unit of row.units){const key=P.identity(unit).entry;counts.set(key,(counts.get(key)||0)+1);}return counts;}
  function adjusted(row,counts){const cost=row.units.reduce((sum,unit)=>sum+1/Math.max(1,counts.get(P.identity(unit).entry)||1),0);return num(row.score)-cost*2.5;}

  function greedy(candidates,rowLimit=P.platoons.rows,seed=[]){
    const selected=[...seed],used=[];selected.filter(Boolean).forEach(row=>mark(row,used));const counts=scarcity(candidates);
    const ordered=[...candidates].sort((a,b)=>adjusted(b,counts)-adjusted(a,counts)||b.score-a.score||a.token.localeCompare(b.token));
    for(const row of ordered){if(selected.length>=rowLimit)break;if(!rowConflicts(row,used)){selected.push(row);mark(row,used);}}
    return selected;
  }

  function compatibleSet(candidate,selected,skipIndexes=[]){const used=[];selected.forEach((row,index)=>{if(row&&!skipIndexes.includes(index))mark(row,used);});return !rowConflicts(candidate,used);}
  function improve(selected,candidates,deadline){
    let current=[...selected],iterations=0,changed=true;const pool=candidates.slice(0,180);
    while(changed&&Date.now()<deadline){changed=false;iterations++;
      for(let i=0;i<current.length&&!changed;i++){
        const base=current.filter((_,index)=>index!==i),available=pool.filter(row=>compatibleSet(row,current,[i]));let best=current;
        for(let a=0;a<available.length;a++){
          const one=[...base,available[a]];if(better(objective(one),objective(best)))best=one;
          for(let b=a+1;b<available.length;b++){if(rowConflicts(available[b],available[a].units))continue;const two=[...base,available[a],available[b]];if(two.length<=P.platoons.rows&&better(objective(two),objective(best)))best=two;}
        }
        if(best!==current){current=best;changed=true;}
      }
    }
    return{selected:current,iterations};
  }

  function placeLocked(row,rowIndex,options){
    const locked=G.lockedForRow(options,rowIndex),out=Array(P.platoons.size).fill(null),placed=new Set();
    for(const slot of locked){const unit=row.units.find(value=>uid(value)===slot.id);if(!unit)throw new Error(`Allocated row ${rowIndex+1} lost locked unit ${slot.id}`);out[slot.index]=unit;placed.add(unit);}
    const remaining=row.units.filter(unit=>!placed.has(unit)).sort((a,b)=>S.unitPotential(b,row.plan)-S.unitPotential(a,row.plan)||P.identity(a).entry.localeCompare(P.identity(b).entry));
    for(let index=0;index<out.length;index++)if(!out[index])out[index]=remaining.shift()||null;return out;
  }

  function partialRow(available,format){
    if(!available.length)return[];let pool=available;
    if(format==='force_mono'||format==='mono'){
      const groups=new Map();for(const unit of available){const element=unit?.__v6?.element||P.key(unit?.element);if(!groups.has(element))groups.set(element,[]);groups.get(element).push(unit);}
      pool=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0]))[0]?.[1]||[];
    }
    return [...pool].sort((a,b)=>S.unitPotential(b,'hybrid')-S.unitPotential(a,'hybrid')||P.identity(a).entry.localeCompare(P.identity(b).entry)).slice(0,P.platoons.size);
  }

  function allocate(generated,units,options={}){
    const started=Date.now(),format=generated?.diagnostics?.format||'auto',fixed=new Map(),used=[];
    for(const [indexText,candidates] of Object.entries(generated?.lockedRows||{})){
      const index=Number(indexText),candidate=rows(candidates).find(row=>!rowConflicts(row,used));if(!candidate)throw new Error(`No legal candidate for locked platoon ${index+1}`);fixed.set(index,candidate);mark(candidate,used);
    }
    const remaining=rows(generated?.candidates).filter(row=>!rowConflicts(row,used)),limit=P.platoons.rows-fixed.size,seed=greedy(remaining,limit),improved=improve(seed,remaining,Date.now()+(Number(options?.allocationBudgetMs)||1200));
    const selected=improved.selected.slice(0,limit),assigned=Array(P.platoons.rows).fill(null),open=[];for(let i=0;i<P.platoons.rows;i++)if(fixed.has(i))assigned[i]=fixed.get(i);else open.push(i);
    selected.forEach((row,index)=>{if(open[index]!==undefined)assigned[open[index]]=row;});
    const allUsed=[];assigned.filter(Boolean).forEach(row=>mark(row,allUsed));const available=rows(units).filter(unit=>!allUsed.some(other=>P.identityConflicts(unit,other)));
    for(let i=0;i<P.platoons.rows;i++)if(!assigned[i]){const partial=partialRow(available.filter(unit=>!allUsed.some(other=>P.identityConflicts(unit,other))),format);if(partial.length){const evaluation=G.rowEvaluation(partial,'hybrid');assigned[i]={units:partial,unitIds:partial.map(uid),plan:'hybrid',element:format.includes('mono')?P.key(partial[0]?.element):'',format,score:evaluation.score,viable:evaluation.complete,evaluation,token:G.token(partial),partial:true};mark(assigned[i],allUsed);}}
    const output=assigned.map((row,index)=>{if(!row)return{name:`Platoon ${index+1}`,units:Array(P.platoons.size).fill(''),score:0,plan:'',element:'',viable:false};const placed=placeLocked(row,index,options);return{name:`Platoon ${index+1}`,units:placed.map(unit=>unit?uid(unit):''),score:row.score,plan:row.plan,element:row.element,viable:row.viable!==false,partial:!!row.partial};});
    return{platoons:output,selectedRows:assigned,diagnostics:{...generated.diagnostics,objective:objective(assigned),allocationIterations:improved.iterations,durationMs:Date.now()-started,lockedRows:fixed.size}};
  }

  root.platoonAllocator={rowConflicts,mark,objective,better,scarcity,adjusted,greedy,compatibleSet,improve,placeLocked,partialRow,allocate};
})(window);
