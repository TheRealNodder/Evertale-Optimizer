(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  const base=root.featureModel;
  if(!S||!base||typeof base.extract!=='function')return;

  function tokens(unit){
    const values=[
      ...S.arr(unit?.derivedTags),
      ...S.arr(unit?.tags),
      ...S.arr(unit?.manualTags),
      ...S.arr(unit?.runtimeTags),
      unit?.__runtimeV2?.tagText,
      unit?.__runtimeV2?.aiTags,
      unit?.optimizerPlan,
      unit?.optimizerRole
    ].flat().map(S.keyText).filter(Boolean);
    const text=[...new Set(values)].join(' ');
    const has=(...needles)=>needles.some(v=>text.includes(S.keyText(v)));
    return{values,text,has};
  }
  function max(obj,key,value=1){obj[key]=Math.max(S.num(obj[key]),value);}
  function bridge(unit,features){
    const f={
      ...features,
      applies:{...(features.applies||{})},
      consumes:{...(features.consumes||{})},
      enables:{...(features.enables||{})},
      protects:{...(features.protects||{})},
      punishes:{...(features.punishes||{})},
      conflicts:{...(features.conflicts||{})},
      roles:{...(features.roles||{})}
    };
    const t=tokens(unit);

    if(t.has('burn_apply','ai_prioritizes_burn','burning_status'))max(f.applies,'burn',1.2);
    if(t.has('poison_apply','ai_prioritizes_poison'))max(f.applies,'poison',1.2);
    if(t.has('sleep_apply','ai_prioritizes_sleep_frostburn','frostburn'))max(f.applies,'sleep',1.1);
    if(t.has('stun_apply','ai_prioritizes_stun'))max(f.applies,'stun',1.2);
    if(t.has('stealth'))max(f.applies,'stealth',1);

    if(t.has('burn_synergy','burn_drive','burn_blast'))max(f.consumes,'burn',1.3);
    if(t.has('poison_synergy','poison_eater','poison_devour'))max(f.consumes,'poison',1.3);
    if(t.has('sleep_synergy','dream','nightmare'))max(f.consumes,'sleep',1.3);
    if(t.has('stun_synergy','time_strike'))max(f.consumes,'stun',1.3);
    if(t.has('blood','bloodfury','bloodthirst','bloodnova'))max(f.consumes,'blood',1.2);
    if(t.has('survivor','survival'))max(f.consumes,'survivor',1.2);
    if(t.has('crisis','low_hp'))max(f.consumes,'crisis',1.2);
    if(t.has('charge','execute'))max(f.consumes,'charge',1);

    if(t.has('spirit_synergy','spirit_gain','spirit_control'))max(f.enables,'spirit',1.2);
    if(t.has('tu_manip','turn_grant','haste','quicken')){max(f.enables,'turn',1.1);max(f.enables,'tu_reduction',1.1);}
    if(t.has('purify','cleanse'))max(f.enables,'cleanse',1.2);
    if(t.has('revive'))max(f.enables,'revive',1.2);
    if(t.has('summon','summon_or_entry_synergy'))max(f.enables,'summon',1.1);

    if(t.has('guard','guardian','protector','role_tank'))max(f.protects,'guard',1.2);
    if(t.has('barrier','damage_reduction','ward','shield'))max(f.protects,'barrier',1.1);
    if(t.has('hold_ground'))max(f.protects,'hold_ground',1.2);
    if(t.has('heal','regeneration','lifesteal'))max(f.protects,'heal',1.1);
    if(t.has('ai_guardian_breaker','guardian_killer','protectorkiller'))max(f.punishes,'guardian',1.2);

    if(t.has('role_dps')){max(f.roles,'dps',1.2);max(f.roles,'anchor',Math.max(S.num(f.roles.anchor),.6));}
    if(t.has('role_support'))max(f.roles,'support',1.2);
    if(t.has('role_tank'))max(f.roles,'tank',1.2);
    if(t.has('role_control'))max(f.roles,'control',1.2);
    if(f.enables.cleanse)max(f.roles,'cleanser',1);
    if(f.enables.spirit||f.enables.turn||f.enables.tu_reduction)max(f.roles,'tempo',1);
    if(Object.keys(f.consumes).length)max(f.roles,'anchor',Math.max(S.num(f.roles.anchor),.8));

    f.selectorBridge={tagText:t.text,matched:true};
    return f;
  }
  function extract(unit){return bridge(unit,base.extract(unit));}
  function attach(rows){
    return S.arr(rows).map(unit=>{
      const clone={...unit};
      clone.__v5={...(clone.__v5||{}),features:extract(unit)};
      return clone;
    });
  }
  root.featureModel={...base,extract,attach,bridge};
})(window);
