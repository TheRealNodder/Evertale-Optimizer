(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  if(!S)return;
  const C=S.constants;

  function add(out,key,words,blob,weight=1){if(S.has(blob,words))out[key]=Math.max(out[key]||0,weight);}
  function roleScore(blob,words){return S.has(blob,words)?1:0;}
  function count(out,keys){return keys.reduce((n,key)=>n+(out[key]?1:0),0);}
  function extract(unit){
    const blob=S.textBlob(unit);
    const applies={},consumes={},enables={},protects={},conflicts={},punishes={};

    add(consumes,'burn',['burn_drive','burndrive','burn_blast','burnblast','burn_force','burnforce','burn_frenzy','burnfrenzy','burn_devour','burndevour','burning_enemy','frostburned_enemy'],blob);
    add(consumes,'poison',['poison_eater','poisoneater','poison_devour','poisondevour','poison_fury','poisonfury','poison_drain','poisondrain','poisoned_enemy','mega_poison_eater'],blob);
    add(consumes,'sleep',['dream_hunter','dreamhunter','dream_hunt','dreamhunt','dream_devour','dreamdevour','dream_buster','dreambuster','dream_ender','dreamender','nightmare','sleep_killer','killsleep','sleeping_enemy'],blob);
    add(consumes,'stun',['time_strike','timestrike','time_buster','timebuster','time_charge_buster','timechargebuster','stun_burst','stunned_enemy'],blob);
    add(consumes,'stealth',['stealth_strike','stealthstrike','stealth_fury'],blob);
    add(consumes,'blood',['bloodfury','blood_fury','bloodthirst','blood_thirst','bloodnova','blood_nova','sacrifice_payoff'],blob);
    add(consumes,'survivor',['survivor','survival_fury','survival_burst'],blob);
    add(consumes,'crisis',['crisis','low_hp','desperate_strike','desperation'],blob);
    add(consumes,'spirit',['spirit_cost','spiritcost','costs_spirit','consume_spirit','spend_spirit','high_spirit_cost','highspirit','ten_spirit','tenspirit','spirit_blast','spiritblast','spirit_crash','spiritcrash','overdrive'],blob);
    add(consumes,'void',['void','zero_spirit','zerospirit','low_spirit','lowspirit'],blob);

    add(applies,'burn',['burn_attack','burnattack','inflict_burn','apply_burn','ignite','frostburn','burning_status'],blob);
    add(applies,'poison',['poison_attack','poisonattack','inflict_poison','apply_poison','venom','toxin','lethal_poison','mega_poison'],blob);
    add(applies,'sleep',['sleep_attack','sleepattack','inflict_sleep','apply_sleep','slumber','sleeping_status'],blob);
    add(applies,'stun',['stun_attack','stunattack','inflict_stun','apply_stun','shock','push_back','pushback'],blob);
    add(applies,'stealth',['gain_stealth','grant_stealth','enter_stealth','stealth_status','hidden'],blob);
    if(!consumes.burn)add(applies,'burn',['burn'],blob);
    if(!consumes.poison)add(applies,'poison',['poison'],blob);
    if(!consumes.sleep)add(applies,'sleep',['sleep'],blob);
    if(!consumes.stun)add(applies,'stun',['stun'],blob);
    if(!consumes.stealth)add(applies,'stealth',['stealth'],blob);

    add(enables,'spirit',['gain_spirit','gainspirit','spirit_gain','spiritgain','add_spirit','addspirit','spirit_recovery','spiritrecovery','spirit_battery','spiritbattery','spirit_charge','spiritcharge','pain_spirit','painspirit','plus_spirit'],blob);
    add(enables,'turn',['turn_grant','turngrant','give_turn','giveturn','grant_turn','grantturn','ally_turn','allyturn','randomallyturn','bloodturn','my_turn','myturn','next_turn'],blob);
    add(enables,'tu_reduction',['reduce_tu','reducetu','tu_reduction','tureduction','tu_reduc','tureduc','tu_minus','tuminus','lower_tu','tu_reduced','accelerate','haste','quicken'],blob);
    add(enables,'summon',['summon','create_minion','spawn_minion','conjure','create_morphan'],blob);
    add(enables,'cleanse',['purify','cleanse','remove_negative','remove_debuff','clear_status'],blob);
    add(enables,'revive',['revive','resurrect','return_to_battlefield','bring_back'],blob);

    add(protects,'guard',['guard','guardian','protector','bodyguard','protect_allies','protectallies','protect_teammates','protectteammates','protect_until','protectuntil','redirect_damage'],blob);
    add(protects,'barrier',['barrier','shield','ward','damage_reduction','less_damage','damage_limit'],blob);
    add(protects,'hold_ground',['hold_ground','holdground','survive_at_1_hp','cannot_be_defeated'],blob);
    add(protects,'heal',['heal','recover_hp','restore_hp','regeneration','lifesteal'],blob);

    add(punishes,'guardian',['enemy_guardian','enemy_protector','ignore_guardian','ignoreguardian','anti_guardian','guardian_killer','protectorkiller','guardbuster'],blob);
    add(punishes,'status',['statused_enemy','negative_effect','debuffed_enemy'],blob);

    add(conflicts,'random_aoe',['random_attack','randomattack','random_damage','randomdamage','random_aoe','randomaoe'],blob);
    add(conflicts,'all_enemy_damage',['damage_all','damageall','attack_all_enemies','attackallenemies','all_enemy_attack','allenemyattack','attack_all','attackall','all_attack','allattack','aoe_attack','aoeattack'],blob);
    if(applies.burn&&consumes.poison)conflicts.status=1;
    if(applies.poison&&consumes.burn)conflicts.status=1;
    if(applies.sleep&&(conflicts.random_aoe||conflicts.all_enemy_damage))conflicts.sleep_break=1;
    if(consumes.void&&enables.spirit)conflicts.void_spirit=1;

    const roles={
      anchor:roleScore(blob,C.roleWords.anchor)+count(consumes,['burn','poison','sleep','stun','blood','crisis','survivor','stealth','void'])*.5,
      dps:roleScore(blob,C.roleWords.dps)+count(consumes,['burn','poison','sleep','stun','blood','crisis','survivor','stealth','void'])*.4+(conflicts.all_enemy_damage?0.25:0),
      support:roleScore(blob,C.roleWords.support)+count(enables,['spirit','turn','tu_reduction','cleanse','revive'])*.35+(protects.heal?0.25:0),
      control:roleScore(blob,C.roleWords.control)+count(applies,['sleep','stun'])*.5,
      tank:roleScore(blob,C.roleWords.tank)+count(protects,['guard','barrier','hold_ground'])*.4,
      cleanser:enables.cleanse?1:0,
      tempo:count(enables,['spirit','turn','tu_reduction'])*.45
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
