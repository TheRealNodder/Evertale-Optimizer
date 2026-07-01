(function(g){
  'use strict';
  const root=g.OptimizerV5Lab=g.OptimizerV5Lab||{};
  const S=root.shared;
  const base=root.featureModel;
  if(!S||!base||typeof base.extract!=='function')return;

  function addText(parts,value,depth=0){
    if(value==null||value===''||depth>5)return;
    if(typeof value==='string'||typeof value==='number'||typeof value==='boolean'){parts.push(String(value));return;}
    if(Array.isArray(value)){value.forEach(v=>addText(parts,v,depth+1));return;}
    if(typeof value==='object')Object.entries(value).forEach(([k,v])=>{parts.push(String(k));addText(parts,v,depth+1);});
  }
  function unitBattleText(unit){
    const parts=[];
    addText(parts,unit?.derivedTags);addText(parts,unit?.tags);addText(parts,unit?.manualTags);addText(parts,unit?.runtimeTags);
    addText(parts,unit?.__runtimeV2?.tagText);addText(parts,unit?.__runtimeV2?.aiTags);
    const rt=g.OptimizerRuntime?.chunks||{};
    const keys=[unit?.id,unit?.sourceId,unit?.family,unit?.name,unit?.title,unit?.internal?.sourceId,unit?.internal?.family].map(S.clean).filter(Boolean);
    for(const source of [rt.battleIntent,rt.abilityGraph,rt.characters,rt.characterEntries]){
      const rows=Array.isArray(source)?source:(source&&typeof source==='object'?Object.values(source):[]);
      rows.filter(r=>r&&typeof r==='object').forEach(row=>{
        const rowKeys=[row.id,row.sourceId,row.family,row.internalMonsterId,row.name,row.title].map(S.clean).filter(Boolean);
        if(rowKeys.some(k=>keys.includes(k))){
          addText(parts,row?.derivedTags);addText(parts,row?.tags);addText(parts,row?.manualTags);addText(parts,row?.runtimeTags);
          addText(parts,row?.activeSkills);addText(parts,row?.passiveSkills);
        }
      });
    }
    return S.keyText(parts.join(' '));
  }
  function has(text,...words){return words.some(w=>text.includes(S.keyText(w)));}
  function max(obj,key,value=1){obj[key]=Math.max(S.num(obj[key]),value);}
  function apply(text,f){
    if(has(text,'burn_apply','burning','inflict_burn','apply_burn','frostburn','ignite'))max(f.applies,'burn',1.6);
    if(has(text,'poison_apply','poisoned','inflict_poison','apply_poison','mega_poison','venom','toxin'))max(f.applies,'poison',1.6);
    if(has(text,'sleep_apply','sleeping','inflict_sleep','apply_sleep','deep_sleep','slumber'))max(f.applies,'sleep',1.6);
    if(has(text,'stun_apply','stunned','inflict_stun','apply_stun','shock','push_back'))max(f.applies,'stun',1.6);
    if(has(text,'burn_synergy','burn_drive','burn_blast','burning_enemy','vs_burning'))max(f.consumes,'burn',1.7);
    if(has(text,'poison_synergy','poison_eater','poison_devour','poisoned_enemy','vs_poison'))max(f.consumes,'poison',1.7);
    if(has(text,'sleep_synergy','dream_hunter','dream_devour','nightmare','sleeping_enemy','vs_sleep'))max(f.consumes,'sleep',1.7);
    if(has(text,'stun_synergy','time_strike','time_buster','stunned_enemy','vs_stunned'))max(f.consumes,'stun',1.7);
    if(has(text,'gain_spirit','spirit_gain','ally_spirit','pain_spirit'))max(f.enables,'spirit',1.5);
    if(has(text,'turn_grant','give_turn','grant_turn','next_turn'))max(f.enables,'turn',1.45);
    if(has(text,'reduce_tu','tu_reduced','tu_to_0','haste','quicken','accelerate'))max(f.enables,'tu_reduction',1.45);
    if(has(text,'cleanse','purify','remove_negative','remove_debuff'))max(f.enables,'cleanse',1.5);
    if(has(text,'revive','resurrect','return_to_battlefield'))max(f.enables,'revive',1.5);
    if(has(text,'summon','spawn_minion','create_minion','conjure'))max(f.enables,'summon',1.35);
    if(has(text,'guardian','protector','bodyguard','protect_allies'))max(f.protects,'guard',1.5);
    if(has(text,'barrier','shield','ward','damage_reduction','less_damage'))max(f.protects,'barrier',1.4);
    if(has(text,'hold_ground','survive_at_1_hp','cannot_be_defeated'))max(f.protects,'hold_ground',1.5);
    if(has(text,'heal','recover_hp','restore_hp','regeneration','lifesteal'))max(f.protects,'heal',1.3);
    if(has(text,'blood','sacrifice','defeated_ally'))max(f.consumes,'blood',1.3);
    if(has(text,'survivor','survival'))max(f.consumes,'survivor',1.25);
    if(has(text,'crisis','low_hp','desperate'))max(f.consumes,'crisis',1.25);
  }
  function roles(f){
    if(Object.keys(f.consumes||{}).length)max(f.roles,'anchor',1.2);
    if(f.consumes?.burn||f.consumes?.poison||f.consumes?.sleep||f.consumes?.stun||f.consumes?.blood||f.consumes?.survivor||f.consumes?.crisis)max(f.roles,'dps',1.25);
    if(f.enables?.spirit||f.enables?.turn||f.enables?.tu_reduction||f.enables?.cleanse||f.enables?.revive||f.protects?.heal)max(f.roles,'support',1.2);
    if(f.enables?.spirit||f.enables?.turn||f.enables?.tu_reduction)max(f.roles,'tempo',1.15);
    if(f.enables?.cleanse)max(f.roles,'cleanser',1.15);
    if(f.protects?.guard||f.protects?.barrier||f.protects?.hold_ground)max(f.roles,'tank',1.2);
    if(f.applies?.sleep||f.applies?.stun||f.enables?.tu_reduction)max(f.roles,'control',1.15);
  }
  function extract(unit){
    const f=base.extract(unit);
    f.applies={...(f.applies||{})};f.consumes={...(f.consumes||{})};f.enables={...(f.enables||{})};f.protects={...(f.protects||{})};f.punishes={...(f.punishes||{})};f.conflicts={...(f.conflicts||{})};f.roles={...(f.roles||{})};
    const text=S.keyText([unitBattleText(unit),f.activeSkillBlob,f.passiveSkillBlob].filter(Boolean).join(' '));
    apply(text,f);roles(f);
    f.battleIntent={read:true,textLength:text.length};
    return f;
  }
  function attach(rows){return S.arr(rows).map(unit=>{const clone={...unit};clone.__v5={...(clone.__v5||{}),features:extract(unit)};return clone;});}
  root.featureModel={...base,extract,attach,unitBattleText};
})(window);
