(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;
  const C=S.constants;

  function add(out,key,words,blob){if(S.has(blob,words))out[key]=Math.max(out[key]||0,1);}
  function roleScore(blob,words){return S.has(blob,words)?1:0;}
  function extract(unit){
    const blob=S.textBlob(unit);
    const applies={},consumes={},enables={},protects={},conflicts={},punishes={};

    add(applies,'burn',['burn','burning','ignite','frostburn'],blob);
    add(applies,'poison',['poison','poisoned','venom','toxin','lethal_poison','mega_poison'],blob);
    add(applies,'sleep',['sleep','sleeping','slumber','dream'],blob);
    add(applies,'stun',['stun','stunned','shock','push_back'],blob);
    add(applies,'stealth',['stealth','hidden'],blob);

    add(consumes,'burn',['burn_drive','burn_blast','burning_enemy','burning enemies','frostburned enemy'],blob);
    add(consumes,'poison',['poison_eater','poison_devour','poisoned_enemy','poisoned enemies'],blob);
    add(consumes,'sleep',['dream','nightmare','sleeping_enemy','sleeping enemies'],blob);
    add(consumes,'stun',['time_strike','stunned_enemy','stunned enemies'],blob);
    add(consumes,'blood',['bloodfury','blood fury','bloodthirst','blood thirst','bloodnova'],blob);
    add(consumes,'survivor',['survivor','survival'],blob);
    add(consumes,'crisis',['crisis','low_hp','low hp'],blob);

    add(enables,'spirit',['spirit','gain_spirit','gain spirit'],blob);
    add(enables,'turn',['turn_grant','give_turn','next turn','reduce_tu','tu reduced','haste','quicken'],blob);
    add(enables,'summon',['summon','minion','conjure'],blob);
    add(enables,'cleanse',['purify','cleanse','remove_negative','remove debuff'],blob);
    add(enables,'revive',['revive','resurrect','return battlefield'],blob);

    add(protects,'guard',['guard','guardian','protector','bodyguard','protect allies'],blob);
    add(protects,'barrier',['barrier','shield','ward','armor','damage_reduction','less damage'],blob);
    add(protects,'hold_ground',['hold_ground','hold ground','survive at 1 hp','cannot be defeated'],blob);
    add(protects,'heal',['heal','recover','restore','regeneration','lifesteal'],blob);

    add(punishes,'guardian',['enemy guardian','enemy protector','ignore guardian'],blob);
    add(punishes,'status',['statused enemy','negative effect'],blob);

    if(applies.burn&&consumes.poison)conflicts.status=1;
    if(applies.poison&&consumes.burn)conflicts.status=1;
    if(applies.sleep&&S.has(blob,['random enemy','all enemies','damage all']))conflicts.sleepBreak=1;

    const roles={
      anchor:roleScore(blob,C.roleWords.anchor)+Object.keys(consumes).length*.45,
      dps:roleScore(blob,C.roleWords.dps)+Object.keys(consumes).length*.35,
      support:roleScore(blob,C.roleWords.support)+Object.keys(enables).length*.25,
      control:roleScore(blob,C.roleWords.control)+Object.keys(applies).filter(k=>['sleep','stun','stealth'].includes(k)).length*.4,
      tank:roleScore(blob,C.roleWords.tank)+Object.keys(protects).length*.3
    };

    return{blob,applies,consumes,enables,protects,punishes,conflicts,roles};
  }
  function attach(rows){
    return S.arr(rows).map(unit=>{
      const clone={...unit};
      clone.__v5={...(clone.__v5||{}),features:extract(unit)};
      return clone;
    });
  }

  root.featureModel={extract,attach};
})(window);
