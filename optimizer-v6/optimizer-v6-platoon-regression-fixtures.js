(function(g){
  'use strict';
  const root=g.OptimizerV6=g.OptimizerV6||{},P=root.policy,F=root.featureModel,G=root.platoonGenerator,A=root.platoonAllocator;
  if(!P||!F||!G||!A)return;
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const ev=feature=>({feature,strength:1.5,confidence:.98,sources:['raw.activeSkills[0]']});
  const unit=(id,element='Fire',atk=1000)=>({id,sourceId:id,family:id,name:id,element,stats:{atk,hp:5000,spd:100,cost:20}});
  function attach(units,store){const previous=g.OptimizerRuntime;g.OptimizerRuntime={chunks:{featureEvidence:store,skillProfiles:{}}};const out=F.attach(units);g.OptimizerRuntime=previous;return out;}
  function roster(counts={Fire:15,Water:10}){const units=[],store={};for(const [element,count] of Object.entries(counts))for(let i=0;i<count;i++){const id=`${element}Unit${String(i).padStart(2,'0')}`;units.push(unit(id,element,1000+i*20));store[id]=[ev(i%2?'payoff_burn':'applies_burn'),ev(i%3?'role_healer':'role_guardian')];}return{units,store};}
  function candidate(name,units,score){return{token:name,units,unitIds:units.map(row=>row.id),plan:'hybrid',element:'',format:'auto',score,viable:true};}

  function run(){
    const results=[],test=(name,fn)=>{try{results.push({name,pass:true,detail:fn()||'pass'});}catch(error){results.push({name,pass:false,detail:String(error?.message||error)});}};
    test('platoons are 20x5, unique, and blank after exhaustion',()=>{
      const fixture=roster(),prepared=attach(fixture.units,fixture.store),options={presetMode:'hard',presetTag:'burn',format:'auto'},generated=G.generate(prepared,options),allocation=A.allocate(generated,prepared,options);
      assert(allocation.platoons.length===20&&allocation.platoons.every(row=>row.units.length===5),'Platoon shape changed');const ids=allocation.platoons.flatMap(row=>row.units).filter(Boolean);assert(new Set(ids).size===ids.length,'Duplicate allocated unit');
      assert(allocation.platoons.slice(5).every(row=>row.units.every(id=>!id)),'Lower rows were not blank after 25-unit exhaustion');return `${ids.length} filled slots`;
    });
    test('forced mono is internal per row, not global',()=>{
      const fixture=roster({Fire:10,Water:10}),prepared=attach(fixture.units,fixture.store),options={presetMode:'hard',presetTag:'burn',format:'force_mono'},allocation=A.allocate(G.generate(prepared,options),prepared,options),map=new Map(prepared.map(row=>[row.id,P.key(row.element)]));
      const active=allocation.platoons.filter(row=>row.units.some(Boolean));assert(active.every(row=>new Set(row.units.filter(Boolean).map(id=>map.get(id))).size===1),'A mono row mixed elements');assert(new Set(active.map(row=>map.get(row.units.find(Boolean)))).size>=2,'One global element was imposed');return `${active.length} mono rows across multiple elements`;
    });
    test('locked platoon slot remains exact',()=>{
      const fixture=roster({Fire:10}),prepared=attach(fixture.units,fixture.store),locked=prepared[4].id,options={presetMode:'hard',presetTag:'burn',format:'force_mono',currentLayout:{platoons:[[ '', '',locked,'','' ]]},slotLocks:{platoons:[[false,false,true,false,false]]}},allocation=A.allocate(G.generate(prepared,options),prepared,options);
      assert(allocation.platoons[0].units[2]===locked,'Locked platoon position changed');return locked;
    });
    test('global allocator beats adversarial sequential greedy',()=>{
      const all=attach(['S','A1','A2','A3','A4','B1','B2','B3','B4','C1'].map(id=>unit(id)),{}),by=new Map(all.map(row=>[row.id,row]));
      const a=candidate('A',['S','A1','A2','A3','A4'].map(id=>by.get(id)),100),b=candidate('B',['S','B1','B2','B3','B4'].map(id=>by.get(id)),90),c=candidate('C',['A1','A2','A3','A4','C1'].map(id=>by.get(id)),90);
      const result=A.allocate({candidates:[a,b,c],lockedRows:{},diagnostics:{format:'auto'}},[],{allocationBudgetMs:100});const tokens=result.selectedRows.filter(Boolean).map(row=>row.token);
      assert(tokens.includes('B')&&tokens.includes('C')&&!tokens.includes('A'),`Expected B+C replacement, got ${tokens}`);return `selected ${tokens.join('+')}`;
    });
    test('scarce bridge unit is reserved for its highest-value row',()=>{
      const all=attach(['Guardian','F1','F2','F3','F4','H1','H2','H3','H4','N1','N2','N3','N4','N5'].map(id=>unit(id)),{}),by=new Map(all.map(row=>[row.id,row]));
      const low=candidate('low-guardian',['Guardian','F1','F2','F3','F4'].map(id=>by.get(id)),70),high=candidate('high-guardian',['Guardian','H1','H2','H3','H4'].map(id=>by.get(id)),98),neutral=candidate('neutral',['N1','N2','N3','N4','N5'].map(id=>by.get(id)),80);
      const result=A.allocate({candidates:[low,high,neutral],lockedRows:{},diagnostics:{format:'auto'}},[],{allocationBudgetMs:100}),tokens=result.selectedRows.filter(Boolean).map(row=>row.token);
      assert(tokens.includes('high-guardian')&&tokens.includes('neutral')&&!tokens.includes('low-guardian'),`Scarce guardian misallocated: ${tokens}`);return tokens.join('+');
    });
    test('hard-plan fallback rows report explicit relaxation',()=>{
      const all=attach(Array.from({length:10},(_,index)=>unit(`Relax${index}01`)),{}),first=candidate('burn-row',all.slice(0,5),80);first.plan='burn';
      const result=A.allocate({candidates:[first],lockedRows:{},diagnostics:{format:'auto',requestedPlan:'burn'}},all,{allocationBudgetMs:100}),relaxed=result.platoons[1];
      assert(relaxed.units.every(Boolean)&&relaxed.plan==='hybrid'&&relaxed.relaxed,'Fallback row was not explicitly marked relaxed');
      assert(result.diagnostics.relaxations.some(row=>row.row===2&&row.requestedPlan==='burn'),'Allocator diagnostics hid hard-plan relaxation');
      return relaxed.relaxationReason;
    });
    const failed=results.filter(row=>!row.pass);return{passed:results.length-failed.length,failed:failed.length,total:results.length,results};
  }
  root.platoonRegressionFixtures={run};g.runOptimizerV6PlatoonRegressionFixtures=run;
})(window);
