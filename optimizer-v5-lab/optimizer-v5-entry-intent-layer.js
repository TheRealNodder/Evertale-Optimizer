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
    if(typeof value==='object'){
      for(const [key,val] of Object.entries(value)){
        parts.push(String(key));
        addText(parts,val,depth+1);
      }
    }
  }
  function entryText(unit){
    const parts=[];
    addText(parts,unit);
    addText(parts,unit?.raw);
    addText(parts,unit?.refs);
    addText(parts,unit?.resolved);
    addText(parts,unit?.internal);
    addText(parts,unit?.states);
    return S.keyText(parts.join(' '));
  }
  function has(text,...needles){return needles.some(n=>text.includes(S.keyText(n)));}
  function max(obj,key,value=1){obj[key]=Math.max(S.num(obj[key]),value);}
  function merge(unit,features){
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
    const text=entryText(unit);

    if(has(text,'burn_apply','burning','burned','burn attack','inflict burn','frostburn','ignite'))max(f.applies,'burn',1.4);
    if(has(text,'poison_apply','poisoned','poison attack','inflict poison','mega poison','lethal poison','venom','toxin'))max(f.applies,'poison',1.4);
    if(has(text,'sleep_apply','sleeping','sleep attack','inflict sleep','deep sleep','slumber','noxious sleep'))max(f.applies,'sleep',1.4);
    if(has(text,'stun_apply','stunned','stun attack','inflict stun','shock','push back','pushback'))max(f.applies,'stun',1.4);
    if(has(text,'stealth','super stealth','hidden'))max(f.applies,'stealth',1.1);

    if(has(text,'burn_synergy','burn drive','burn blast','burning enemy','burning enemies','frostburned enemy','vs burning','isburning'))max(f.consumes,'burn',1.5);
    if(has(text,'poison_synergy','poison eater','poison devour','poisoned enemy','poisoned enemies','mega poison eater','vs poison','ispoisoned'))max(f.consumes,'poison',1.5);
    if(has(text,'sleep_synergy','dream hunter','dreamhunt','dream devour','nightmare','sleeping enemy','sleeping enemies','vs sleep','issleeping'))max(f.consumes,'sleep',1.5);
    if(has(text,'stun_synergy','time strike','time buster','stunned enemy','stunned enemies','vs stunned','isstunned'))max(f.consumes,'stun',1.5);
    if(has(text,'bloodfury','blood fury','bloodthirst','blood thirst','bloodnova','blood nova','defeated ally','sacrifice'))max(f.consumes,'blood',1.35);
    if(has(text,'survivor','survival fury','survival burst','after 300 tu'))max(f.consumes,'survivor',1.25);
    if(has(text,'crisis','low hp','desperate strike','hp 25','less than hp'))max(f.consumes,'crisis',1.25);
    if(has(text,'charge','power charge','charged attack'))max(f.consumes,'charge',1.1);
    if(has(text,'overdrive','spirit blast','spirit crash','spend spirit','costs spirit','consume spirit'))max(f.consumes,'spirit',1.1);

    if(has(text,'gain spirit','spirit gain','ally spirit','pain spirit','spirit recovery','spirit charge','spirit battery'))max(f.enables,'spirit',1.35);
    if(has(text,'turn grant','give turn','grant turn','next turn','ally turn','bloodturn'))max(f.enables,'turn',1.3);
    if(has(text,'reduce tu','tu reduced','tu to 0','haste','quicken','accelerate','lower tu'))max(f.enables,'tu_reduction',1.3);
    if(has(text,'purify','cleanse','remove negative','remove debuff','clear status'))max(f.enables,'cleanse',1.35);
    if(has(text,'revive','resurrect','return to battlefield','reincarnation'))max(f.enables,'revive',1.35);
    if(has(text,'summon','create minion','spawn minion','conjure','morphan'))max(f.enables,'summon',1.2);

    if(has(text,'guardian','protector','bodyguard','protect allies','protect teammates','redirect damage'))max(f.protects,'guard',1.35);
    if(has(text,'barrier','shield','ward','armor','damage reduction','less damage','damage limit'))max(f.protects,'barrier',1.25);
    if(has(text,'hold ground','survive at 1 hp','survives with 1 hp','cannot be defeated'))max(f.protects,'hold_ground',1.35);
    if(has(text,'heal','restore hp','recover hp','regeneration','lifesteal','life steal','drain hp'))max(f.protects,'heal',1.2);

    if(has(text,'ignore guardian','anti guardian','guardian killer','protector killer','guard buster'))max(f.punishes,'guardian',1.25);
    if(has(text,'random attack','random enemy','random damage','random aoe'))max(f.conflicts,'random_aoe',1);
    if(has(text,'attack all','all enemy','all enemies','damage all','aoe attack'))max(f.conflicts,'all_enemy_damage',1);
    if(f.applies.sleep&&(f.conflicts.random_aoe||f.conflicts.all_enemy_damage))max(f.conflicts,'sleep_break',1);

    if(Object.keys(f.consumes).length)max(f.roles,'anchor',1.05);
    if(f.consumes.burn||f.consumes.poison||f.consumes.sleep||f.consumes.stun||f.consumes.blood||f.consumes.survivor||f.consumes.crisis||f.consumes.charge)max(f.roles,'dps',1.1);
    if(f.enables.spirit||f.enables.turn||f.enables.tu_reduction||f.enables.cleanse||f.enables.revive||f.protects.heal)max(f.roles,'support',1.05);
    if(f.enables.spirit||f.enables.turn||f.enables.tu_reduction)max(f.roles,'tempo',1.05);
    if(f.enables.cleanse)max(f.roles,'cleanser',1.05);
    if(f.protects.guard||f.protects.barrier||f.protects.hold_ground)max(f.roles,'tank',1.05);
    if(f.applies.sleep||f.applies.stun||f.enables.tu_reduction)max(f.roles,'control',1.05);

    f.entryIntent={read:true,textLength:text.length};
    return f;
  }
  function extract(unit){return merge(unit,base.extract(unit));}
  function attach(rows){
    return S.arr(rows).map(unit=>{
      const clone={...unit};
      clone.__v5={...(clone.__v5||{}),features:extract(unit)};
      return clone;
    });
  }
  root.featureModel={...base,extract,attach,entryText,merge};
})(window);
