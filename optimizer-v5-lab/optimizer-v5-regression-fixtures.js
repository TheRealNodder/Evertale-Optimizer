(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared,E=root.engine;
  const MAIN=5,BACK=3,PLATOONS=20,SIZE=5;
  function unit(id,order,element,skills,extra={}){
    return{id,name:extra.name||id,family:extra.family||id,entryPath:`entries/${String(order).padStart(4,'0')}_${id}.json`,element,activeSkills:S.arr(skills),passiveSkills:S.arr(extra.passives),stats:{atk:extra.atk||1200,hp:extra.hp||5600,spd:extra.spd||500,cost:extra.cost||24}};
  }
  function options(scope='story',mode='auto',preset=''){
    return{buildScope:scope,presetTag:preset,presetMode:preset?'hard':'auto',doctrineOverrides:{monoVsRainbow:{selectionMode:mode}},currentLayout:{storyMain:Array(MAIN).fill(''),storyBack:Array(BACK).fill(''),platoons:Array.from({length:PLATOONS},()=>Array(SIZE).fill(''))},slotLocks:{storyMain:Array(MAIN).fill(false),storyBack:Array(BACK).fill(false),platoons:Array.from({length:PLATOONS},()=>Array(SIZE).fill(false))}};
  }
  function resultIds(result){return[...S.arr(result?.story?.main),...S.arr(result?.story?.back),...S.arr(result?.platoons).flatMap(row=>S.arr(row?.units||row))].map(S.txt).filter(Boolean);}
  function storyIds(result){return[...S.arr(result?.story?.main),...S.arr(result?.story?.back)].map(S.txt).filter(Boolean);}
  function assert(value,message){if(!value)throw new Error(message);}
  function feature(unitValue){return root.featureModel.extract(unitValue);}
  function hasFeature(unitValue,group,key){return !!feature(unitValue)?.[group]?.[key];}
  function uniqueByIdentity(ids,units){
    const byId=new Map(units.map(row=>[S.txt(row.id),row]));
    for(const mode of ['entry','family','name']){const values=ids.map(id=>S.identity(byId.get(id)||{id})[mode]);if(new Set(values).size!==values.length)return false;}
    return true;
  }
  function run(){
    if(!S||!E||typeof E.run!=='function')throw new Error('Optimizer V5 regression fixtures require the complete lab engine.');
    const rows=[];
    const test=(name,fn)=>{try{const detail=fn()||'pass';rows.push({name,pass:true,detail});}catch(err){rows.push({name,pass:false,detail:S.txt(err?.message||err)});}};

    test('real extracted skill vocabulary',()=>{
      const cases=[
        ['BurnSelfSpiritChargeBAstridBride','applies','burn'],['BurnDriveAChineseRizette','consumes','burn'],
        ['PoisonTouchRandomDoubleABahamut','applies','poison'],['PoisonEaterDoubleAFastDarkAstrid','consumes','poison'],
        ['SleepSingleAJeanneDarkAngel','applies','sleep'],['DreamHuntDoubleARizetteSwimsuit','consumes','sleep'],
        ['StunRandom150A','applies','stun'],['TimeStrikeDoubleASamuraiGirl','consumes','stun'],
        ['RecklessGainSpiritABlueSeaSerpent','enables','spirit'],['HighSpiritAttackDoubleALifeWhiteKnight','consumes','spirit'],
        ['GiveTurnALudmillaRegular','enables','turn'],['TUReducSpiritGainEnergyConverterA','enables','tu_reduction'],
        ['PurifyHealDoubleALudmillaChristmas','enables','cleanse'],['ReviveOdinRegularA01','enables','revive'],
        ['ProtectAlliesHealAlternatingStun','protects','guard'],['StaticBarrierPassiveAMechaSisterNew','protects','barrier'],
        ['SpiritedHoldGroundAZoroRegular','protects','hold_ground'],['SummonTokenx2ADeathCooldownGothGirl','enables','summon'],
        ['BloodfuryDoubleASnowWhite','consumes','blood'],['ProtectorKillerACallenDragonDark','punishes','guardian'],
        ['RandomAttackAElmKouhaiRegular','conflicts','random_aoe'],['ZeroSpiritAllAttackAGenieRegular','conflicts','all_enemy_damage'],
        ['RoyalVoid','consumes','void']
      ];
      const missed=cases.filter(([skill,group,key])=>!hasFeature(unit(skill,1,'fire',[skill]),group,key)).map(row=>row[0]);
      assert(!missed.length,'missed skill vocabulary: '+missed.join(', '));return `${cases.length} vocabulary checks`;
    });

    test('resolved metadata does not invent status engines',()=>{
      const noisy=unit('metadata-only',2,'light',[{id:'SingleAttackA',name:'Attack',description:'Removes Burn, Poison, Sleep, and Stun immunity metadata.'}],{passives:[{id:'StatusImmunity',name:'Status Immunity',description:'Immune to Burn, Poison, Sleep, and Stun.'}]});
      const f=feature(noisy),statusKeys=['burn','poison','sleep','stun'];
      const invented=statusKeys.filter(key=>f.applies?.[key]||f.consumes?.[key]);
      assert(!invented.length,'metadata invented status engines: '+invented.join(', '));
      return 'status cleanup and immunity text ignored as engine evidence';
    });

    test('researched synergy and conflict edges',()=>{
      const raw=[unit('battery',1,'storm',['RecklessGainSpiritABlueSeaSerpent']),unit('overdrive',2,'light',['HighSpiritAttackDoubleALifeWhiteKnight']),unit('void',3,'fire',['RoyalVoid']),unit('sleep',4,'water',['SleepSingleAJeanneDarkAngel']),unit('aoe',5,'storm',['RandomAttackAElmKouhaiRegular']),unit('summon',6,'earth',['SummonTokenx2ADeath']),unit('blood',7,'dark',['BloodfuryDoubleASnowWhite'])];
      const prepared=E.prepare(raw,{}),byId=new Map(prepared.map(row=>[row.id,row]));
      const pair=(a,b)=>root.synergyGraph.pairScore(byId.get(a),byId.get(b));
      assert(pair('battery','overdrive').score>0,'spirit battery should support high-spirit payoff');
      assert(pair('battery','void').score<0,'spirit gain should conflict with void payoff');
      assert(pair('sleep','aoe').score<0,'random AoE should conflict with sleep');
      assert(pair('summon','blood').score>0,'summon creation should support blood payoff');
      return 'battery, void, sleep/AoE, and summon/blood edges';
    });

    test('Mono Burn anchor build',()=>{
      const burn=Array.from({length:10},(_,i)=>unit(`burn-${i}`,100+i,'fire',[i%2?'BurnDriveAChineseRizette':'BurnSelfSpiritChargeBAstridBride'],{atk:1250+i*15,spd:520+i}));
      const off=[unit('poison-new',900,'earth',['PoisonEaterDoubleAFastDarkAstrid'],{atk:1800,spd:700}),unit('sleep-new',901,'water',['DreamHuntDoubleARizetteSwimsuit'],{atk:1800,spd:700})];
      const result=E.run([...burn,...off],options('story','force_mono','burn')),picked=storyIds(result),byId=new Map([...burn,...off].map(row=>[row.id,row]));
      assert(picked.length===8,'Mono Story should fill eight slots when available');
      assert(new Set(picked.map(id=>byId.get(id).element)).size===1,'Mono Story mixed elements');
      assert(result.diagnostics?.selectedEngine==='burn','Burn was not selected as the engine');
      assert(picked.some(id=>hasFeature(byId.get(id),'applies','burn'))&&picked.some(id=>hasFeature(byId.get(id),'consumes','burn')),'Mono Burn lacks setup/payoff');
      return `${picked.length} fire units with Burn setup/payoff`;
    });

    test('Multitype Blood bridge build',()=>{
      const pool=[
        unit('summoner-a',201,'earth',['SummonTokenx2ADeathCooldownGothGirl'],{spd:690}),unit('blood-a',202,'dark',['BloodfuryDoubleASnowWhite'],{atk:1750}),
        unit('protector',203,'light',['ProtectAlliesHealAlternatingStun'],{hp:7600}),unit('turn',204,'storm',['GiveTurnALudmillaRegular']),
        unit('cleanser',205,'water',['PurifyHealDoubleALudmillaChristmas']),unit('summoner-b',206,'fire',['SummonTokenx2AFireCooldownDarkLudmilla']),
        unit('blood-b',207,'dark',['BloodthirstDoubleADarkAstridNewYear'],{atk:1680}),unit('battery',208,'light',['RecklessGainSpiritABlueSeaSerpent']),
        unit('neutral-a',209,'water',['SingleAttackA'],{atk:1500}),unit('neutral-b',210,'storm',['SingleAttackA'],{atk:1480})
      ];
      const result=E.run(pool,options('story','force_rainbow','blood')),picked=storyIds(result),byId=new Map(pool.map(row=>[row.id,row]));
      assert(picked.some(id=>hasFeature(byId.get(id),'enables','summon')),'Multitype Blood lacks summon setup');
      assert(picked.some(id=>hasFeature(byId.get(id),'consumes','blood')),'Multitype Blood lacks payoff');
      assert(new Set(picked.map(id=>byId.get(id).element)).size>1,'Multitype team did not cross elements');
      assert(result.diagnostics?.storyPicks?.length===picked.length,'Story explanations are incomplete');
      return `${new Set(picked.map(id=>byId.get(id).element)).size} elements with summon/blood bridge`;
    });

    test('strict duplicates and exhausted platoons',()=>{
      const pool=Array.from({length:10},(_,i)=>unit(`unique-${i}`,300+i,i%2?'fire':'water',['SingleAttackA'],{family:i===9?'family-8':`family-${i}`}));
      const result=E.run(pool,options('platoons','auto','')),picked=resultIds(result);
      const empty=S.arr(result.platoons).reduce((sum,row)=>sum+SIZE-S.arr(row?.units).filter(Boolean).length,0);
      assert(picked.length===9,'duplicate family should leave nine globally unique selections');
      assert(uniqueByIdentity(picked,pool),'entry/family/name duplicate escaped the guard');
      assert(empty===99,'lower platoons should contain 99 empty slots');
      return `${picked.length} unique picks, ${empty} empty platoon slots`;
    });

    const failures=rows.filter(row=>!row.pass);console.table(rows);
    const report={passed:rows.length-failures.length,failed:failures.length,total:rows.length,results:rows,engineVersion:'optimizerEngineV5-lab-fixtures-v1'};
    if(failures.length)console.error('[Optimizer V5 Fixtures] failures',failures);else console.info('[Optimizer V5 Fixtures] all checks passed',report);
    return report;
  }
  root.regressionFixtures={run};
  g.runOptimizerV5RegressionFixtures=run;
})(window);
