(function(g){
  'use strict';

  const root=g.OptimizerV6=g.OptimizerV6||{};
  const P=root.policy,M=root.localMeta,E=root.evidence,F=root.featureModel,T=root.teamEvaluator,R=root.resourceReasoner,X=root.explanations;
  if(!P||!M||!E||!F||!T||!R||!X)return;

  function assert(condition,message){if(!condition)throw new Error(message);}
  function unit(id,element='Fire',extra={}){
    return{id,sourceId:id,family:id.replace(/\d+$/,''),name:id,element,stats:{atk:1000,hp:5000,spd:100,cost:20},...extra};
  }
  function evidence(feature,strength=1.4,confidence=.98,source='raw.activeSkills[0]'){
    return{feature,strength,confidence,sources:[source]};
  }
  function makeTeam(prefix='Unit'){
    return Array.from({length:8},(_,index)=>unit(`${prefix}${String.fromCharCode(65+index)}01`,['Fire','Water','Storm','Earth'][index%4]));
  }
  function skill(id,extra={}){return{id,name:id,description:'',tuCost:100,spiritGain:0,spiritCost:0,useLimit:null,targeting:'1Enemy',useCondition:'',flags:[],components:['Damage'],source:`resolved.activeSkills.${id}`,...extra};}
  function skillStore(units,skillsById={}){const out={};for(const row of units)out[row.sourceId]={sourceId:row.sourceId,family:row.family,skills:skillsById[row.sourceId]||[skill(`Attack${row.sourceId}`)]};return out;}
  function withStore(store,units,profiles={},options={},leaders={}){
    const previous=g.OptimizerRuntime;
    g.OptimizerRuntime={...(previous||{}),chunks:{...(previous?.chunks||{}),featureEvidence:store,skillProfiles:profiles,leaderProfiles:leaders}};
    const attached=F.attach(units,options);
    g.OptimizerRuntime=previous;
    return attached;
  }
  function expectedFailure(run){const original=console.error;console.error=()=>{};try{return run();}finally{console.error=original;}}

  function run(){
    const results=[];
    const test=(name,fn)=>{try{results.push({name,pass:true,detail:fn()||'pass'});}catch(error){results.push({name,pass:false,detail:String(error?.message||error)});}};

    test('policy locks team sizes and score ranges',()=>{
      assert(P.story.main===5&&P.story.back===3&&P.story.total===8,'Story contract changed');
      assert(P.platoons.rows===20&&P.platoons.size===5,'Platoon contract changed');
      assert(P.story.leaderStacking==='best_only'&&P.story.leaderScope===8,'Leader contract changed');
      return '5+3 Story, 20x5 platoons, leader all-eight best-only';
    });

    test('search intelligence profiles increase monotonically',()=>{
      const standard=P.intelligenceProfile('standard'),deep=P.intelligenceProfile('deep'),ultra=P.intelligenceProfile('ultra');
      for(const field of ['storyBeamWidth','storyCandidateCap','storyPlacementFinalists','placementCombinations','platoonRowsPerPlan','allocatorPoolSize','allocationBudgetMs']){
        assert(standard[field]<deep[field]&&deep[field]<ultra[field],`${field} is not monotonic across intelligence profiles`);
      }
      assert(P.intelligenceProfile({}).level==='deep','Deep is not the balanced default search intelligence');
      return `beam ${standard.storyBeamWidth} -> ${deep.storyBeamWidth} -> ${ultra.storyBeamWidth}`;
    });

    test('auto tournament probes every complete plan before deep refinement',()=>{
      const prepared=withStore({},makeTeam('Tournament'));
      const contest=root.engine.tournament(prepared,{searchIntelligence:'deep',requirePlanComplete:false,buildScope:'story'});
      assert(contest.diagnostics.useProbe&&contest.diagnostics.probeLevel==='probe','Deep auto tournament skipped the bounded probe pass');
      assert(contest.diagnostics.refinedCandidates===2,'Deep auto tournament did not refine its top two finalists');
      assert(contest.diagnostics.completeCandidates>=3,'Auto tournament did not preserve complete alternatives');
      return `${contest.diagnostics.completeCandidates} complete probes, ${contest.diagnostics.refinedCandidates} refined`;
    });

    test('result cache ignores unlocked layout churn but tracks locked identity',()=>{
      const units=makeTeam('Cache'),locks={
        storyMain:[true,false,false,false,false],storyBack:[false,false,false],
        platoons:Array.from({length:20},()=>Array(5).fill(false))
      };
      const options=id=>({
        buildScope:'story',searchIntelligence:'deep',slotLocks:locks,
        currentLayout:{storyMain:[id,'A','B','C','D'],storyBack:['E','F','G'],platoons:Array.from({length:20},()=>Array(5).fill(''))}
      });
      const first=root.controller.cacheKey(units,options('CacheA01'));
      const unlockedChanged=options('CacheA01');unlockedChanged.currentLayout.storyMain[1]='ChangedUnlocked01';
      const second=root.controller.cacheKey(units,unlockedChanged);
      const lockedChanged=root.controller.cacheKey(units,options('CacheB01'));
      assert(first===second,'Unlocked optimizer output invalidated the deterministic result cache');
      assert(first!==lockedChanged,'Changing a locked identity failed to invalidate the result cache');
      return 'unlocked layout stable; locked identity invalidates';
    });

    test('local latest-unit snapshot is schema and data-version bound',()=>{
      const bundle={generatedAt:123,contentHash:'fixture',entries:[
        {family:'NewestFamily',order:100,name:'Newest',title:'Drop',rarity:'SSR',states:[{sourceId:'NewestFamily01'},{sourceId:'NewestFamily02'}]},
        {family:'RecentFamily',order:99,name:'Recent',title:'Drop',rarity:'SSR',states:[{sourceId:'RecentFamily01'}]},
        {family:'OlderFamily',order:1,name:'Older',title:'Unit',rarity:'SSR',states:[{sourceId:'OlderFamily01'}]}
      ]};
      const snapshot=M.buildSnapshot(bundle,{dataVersion:'fixture-v1',cachedAt:456});
      assert(M.validateSnapshot(snapshot,{dataVersion:'fixture-v1'}).valid,'Valid local snapshot was rejected');
      assert(!M.validateSnapshot(snapshot,{dataVersion:'fixture-v2'}).valid,'Stale data-version snapshot remained valid');
      assert(snapshot.maxOrder===100&&snapshot.scoresByIdentity.newestfamily01>0,'Snapshot lost global order or source identity');
      assert(!M.engineOptions(snapshot,false,{dataVersion:'fixture-v1'}).enabled,'Advisory snapshot applied without explicit opt-in');
      assert(M.engineOptions(snapshot,true,{dataVersion:'fixture-v1'}).enabled,'Valid opted-in snapshot did not produce engine options');
      return `${snapshot.latest.length} records, max order ${snapshot.maxOrder}`;
    });

    test('advisory recency applies only after opt-in and stays bounded',()=>{
      const raw=[unit('RecentMeta01','Fire',{__v5:{meta:{order:90,newer:.2}}})];
      const disabled=withStore({},raw,{},{
        advisoryMeta:{enabled:false,schemaVersion:1,maxOrder:100,scoresByIdentity:{recentmeta01:100}}
      })[0].__v6;
      const enabled=withStore({},raw,{},{
        advisoryMeta:{enabled:true,schemaVersion:1,maxOrder:100,source:'generated-release-order',confidence:.76,scoresByIdentity:{recentmeta01:100}}
      })[0].__v6;
      assert(disabled.metaPrior===20,'Disabled advisory changed generated recency');
      assert(enabled.metaPrior>disabled.metaPrior&&enabled.metaPrior<=100,'Enabled advisory was missing or unbounded');
      assert(enabled.metaEvidence.applied&&enabled.metaEvidence.source==='generated-release-order','Advisory provenance is missing');
      return `${disabled.metaPrior.toFixed(1)} disabled -> ${enabled.metaPrior.toFixed(1)} enabled`;
    });

    test('element affinity cannot create a status engine',()=>{
      const fire=withStore({},[unit('AffinityOnly01','Fire')])[0];
      assert(F.mechanical(fire.__v6.evidence,'burn','setup')===0,'Fire affinity invented burn setup');
      assert(fire.__v6.evidence.affinities.burn>0,'Expected bounded Fire affinity signal');
      return 'Fire affinity is support-only';
    });

    test('incidental skip lists are rejected as evidence',()=>{
      const trap=withStore({Trap01:[evidence('applies_burn',1.6,.98,'resolved.activeSkills.X.revengeEffectsToSkip[4]')]},[unit('Trap01')])[0];
      assert(F.mechanical(trap.__v6.evidence,'burn','setup')===0,'Rejected skip-list reference became setup');
      return 'revengeEffectsToSkip provenance rejected';
    });

    test('AI, Frostburn, and healthy substrings cannot invent features',()=>{
      const raw=[unit('FrostOnly01','Water'),unit('FrostPayoff01','Water'),unit('AiHint01','Storm'),unit('HealthyOnly01','Light')],store={
        FrostOnly01:[evidence('applies_burn',1.6,.98,'resolved.activeSkills.FrostburnAttack.localization.description')],
        FrostPayoff01:[evidence('payoff_burn',1.5,.98,'resolved.activeSkills.FrostburnDrive.localization.description')],
        AiHint01:[evidence('payoff_stun',1.5,.98,'resolved.activeSkillsAI.0.ai.EnemyHasTimestrikerNoProtector')],
        HealthyOnly01:[evidence('role_healer',1.25,.98,'resolved.activeSkills.HighSpiritHealthyBlast#identifier')]
      },prepared=withStore(store,raw);
      assert(F.mechanical(prepared[0].__v6.evidence,'burn','setup')===0,'Frostburn became normal Burn setup');
      assert(F.mechanical(prepared[1].__v6.evidence,'burn','payoff')===0,'Frostburn became normal Burn payoff');
      assert(F.mechanical(prepared[2].__v6.evidence,'stun','payoff')===0,'AI target hint became Stun payoff');
      assert(F.roleEvidence(prepared[3].__v6.evidence,'healer')===0,'healthy substring became healing');
      return 'context-invalid evidence rejected';
    });

    test('cross-element direct evidence remains authoritative',()=>{
      const water=withStore({WaterBurn01:[evidence('applies_burn',1.6,.98,'resolved.activeSkills.WardBurnAlly#identifier')]},[unit('WaterBurn01','Water')])[0];
      assert(F.mechanical(water.__v6.evidence,'burn','setup')>0,'Direct cross-element Burn evidence was discarded');
      assert(!water.__v6.evidence.affinities.burn,'Water received Fire-only affinity');
      return 'mechanics outrank element without inventing affinity';
    });

    test('Frostburn, Stealth, Counter, and Charge remain distinct engines',()=>{
      for(const plan of ['frostburn','stealth','counter','charge']){
        const raw=makeTeam(`Typed${plan}`),store={
          [raw[0].sourceId]:[evidence(`applies_${plan}`)],
          [raw[1].sourceId]:[evidence(`payoff_${plan}`)]
        },report=T.evaluate(withStore(store,raw),{plan,format:'auto'});
        assert(report.valid&&report.engine.complete,`${plan} did not produce a complete distinct engine: ${report.errors.join('; ')}`);
        assert(F.mechanical(report.engine&&withStore(store,[raw[0]])[0].__v6.evidence,plan,'setup')>0,`${plan} setup evidence was not mapped`);
      }
      return 'four typed setup/payoff engines remain separate';
    });

    test('Counter stance is a self-contained engine',()=>{
      const raw=makeTeam('CounterPlan'),store={};raw.slice(0,4).forEach(row=>store[row.sourceId]=[evidence('applies_counter')]);
      const team=withStore(store,raw),engine=T.engineState(team,'counter',{presetMode:'hard'});
      assert(engine.complete&&engine.coherent&&engine.requiresSetup&&!engine.requiresPayoff,'Counter stance incorrectly requires a nonexistent payoff feature');
      return `${engine.contributorCount} stance contributors, no invented payoff`;
    });

    test('generated support, defense, counter, and timing features are consumed',()=>{
      const raw=[unit('TypedSupport01','Light'),unit('TypedDefense01','Earth')],prepared=withStore({
        TypedSupport01:[evidence('role_ally_healer'),evidence('role_ally_cleanser'),evidence('timing_entry_self')],
        TypedDefense01:[evidence('defense_armor'),evidence('defense_hold_ground'),evidence('removes_sleep')]
      },raw),support=F.archetypeSignal(prepared[0],'heal'),cleanse=F.archetypeSignal(prepared[0],'cleanse'),defense=F.archetypeSignal(prepared[1],'defense'),counter=F.counterProfile(prepared[1]);
      assert(support.contributes&&cleanse.contributes,'Generated ally/team support roles were ignored');
      assert(defense.contributes&&counter.hold_ground>0&&counter.removes_sleep>0,'Generated defense/counter evidence was ignored');
      assert(F.timingProfile(prepared[0]).entry>0,'Generated entry timing evidence was ignored');
      return 'typed support, defense, removal counter, and entry timing mapped';
    });

    test('team support outranks ally support, which outranks self-only support',()=>{
      const raw=[unit('TeamSupport01','Light'),unit('AllySupport01','Light'),unit('SelfSupport01','Light')],prepared=withStore({
        TeamSupport01:[evidence('role_team_healer'),evidence('role_team_cleanser')],
        AllySupport01:[evidence('role_ally_healer'),evidence('role_ally_cleanser')],
        SelfSupport01:[evidence('role_self_sustain'),evidence('role_self_cleanser')]
      },raw),heal=prepared.map(unit=>F.archetypeSignal(unit,'heal').score),cleanse=prepared.map(unit=>F.archetypeSignal(unit,'cleanse').score);
      assert(heal[0]>heal[1]&&heal[1]>heal[2],`Heal scope order is wrong: ${heal.join(' > ')}`);
      assert(cleanse[0]>cleanse[1]&&cleanse[1]>cleanse[2],`Cleanse scope order is wrong: ${cleanse.join(' > ')}`);
      return 'team > ally > self for Heal and Cleanse';
    });

    test('typed relations separate production, payoff, and anti-synergy',()=>{
      const blocked=E.normalizeItem({...evidence('applies_burn'),relations:['prevents'],receipts:[{source:'raw.activeSkills[0]',relation:'prevents'}]}),produces=E.normalizeItem({...evidence('applies_burn'),relations:['produces'],receipts:[{source:'raw.activeSkills[0]',relation:'produces'}]});
      assert(!blocked.authoritative&&blocked.relationCompatible===false,'Preventive relation became positive Burn setup');
      assert(produces.authoritative&&produces.relationCompatible===true,'Positive production relation was rejected');
      const raw=makeTeam('Relation'),baseStore={};
      for(let i=0;i<4;i++)baseStore[raw[i].sourceId]=[evidence(i%2?'payoff_burn':'applies_burn')];
      const vulnerableStore={...baseStore,[raw[4].sourceId]:[{...evidence('penalized_by_burn',1.2,.99),relations:['penalized_by'],receipts:[{source:'raw.activeSkills[0]',relation:'penalized_by'}]}]};
      const safe=T.evaluate(withStore(baseStore,raw),{plan:'burn',presetMode:'hard'}),vulnerable=T.evaluate(withStore(vulnerableStore,raw),{plan:'burn',presetMode:'hard'});
      assert(vulnerable.penalties.planVulnerability>0&&vulnerable.score<safe.score,'Explicit Burn vulnerability did not reduce a Burn team');
      assert(vulnerable.contributionLedger.plan.vulnerableUnits.includes(raw[4].id),'Anti-synergy unit was omitted from the contribution ledger');
      return `Burn vulnerability penalty ${vulnerable.penalties.planVulnerability.toFixed(1)}/100`;
    });

    test('same-plan status removal is a bounded conflict, not a counter bonus',()=>{
      const makeRemoval=(feature,targetTeam)=>({...evidence(feature,1,.99),relations:['removes'],receipts:[{source:'raw.activeSkills[0]',relation:'removes',targetTeam}]});
      for(const plan of ['burn','poison','sleep']){
        const row=withStore({[`Remove${plan}01`]:[makeRemoval(`removes_${plan}`,plan==='burn'?'allies':'enemies')]},[unit(`Remove${plan}01`)])[0];
        assert(F.removalConflict(row,plan)>0&&F.antiSynergy(row,plan)>0,`${plan} removal did not register as plan conflict`);
      }
      const allyPoison=withStore({AllyPoisonCleanse01:[makeRemoval('removes_poison','allies')]},[unit('AllyPoisonCleanse01')])[0];
      assert(F.removalConflict(allyPoison,'poison')===0,'Ally Poison cleanse was incorrectly treated as an enemy-engine conflict');
      const pivot=withStore({SleepPivot01:[evidence('payoff_burn'),evidence('applies_sleep'),makeRemoval('removes_burn','enemies')]},[unit('SleepPivot01','Water')])[0];
      assert(F.destructiveRemoval(pivot,'burn')>0&&F.hardPlanConflict(pivot,'burn'),'Enemy Burn-consuming Sleep pivot was not rejected from hard Burn');
      return 'Burn removal and enemy Poison/Sleep removal conflict; allied cleanse remains support';
    });

    test('primary archetype is required while secondary remains bounded',()=>{
      const raw=[...makeTeam('Archetype'),unit('ArchetypeReserve01','Dark')],store={};
      store[raw[0].sourceId]=[evidence('applies_burn')];store[raw[1].sourceId]=[evidence('payoff_burn')];store[raw[2].sourceId]=[evidence('applies_burn')];store[raw[3].sourceId]=[evidence('team_healer')];
      const prepared=withStore(store,raw),options={plan:'hybrid',format:'auto',requirePlanComplete:false,archetypes:['burn','heal']},contract=T.archetypeAvailability(prepared,options);
      const aligned=T.evaluate(prepared.slice(0,8),{...options,archetypeContract:contract});
      const missingPrimary=T.evaluate([prepared[0],prepared[1],...prepared.slice(3,9)],{...options,archetypeContract:contract});
      const noSecondary=T.evaluate([prepared[0],prepared[1],prepared[2],...prepared.slice(4,9)],{...options,archetypeContract:contract});
      assert(aligned.valid&&aligned.archetypes.primary.satisfied&&aligned.archetypes.secondary.satisfied,'Aligned primary/secondary contract failed');
      assert(!missingPrimary.valid&&/Primary burn effect/.test(missingPrimary.errors.join(' ')),'Primary archetype was treated as an optional score hint');
      assert(noSecondary.valid&&!noSecondary.archetypes.secondary.satisfied,'Secondary archetype incorrectly became a hard constraint');
      assert(P.archetype.secondaryScoreShare<=.25,'Secondary archetype score is not bounded');
      return `primary required; secondary capped at ${Math.round(P.archetype.secondaryScoreShare*100)}%`;
    });

    test('forced status plan rejects neutral-majority completion',()=>{
      const raw=makeTeam('Coherence'),weakStore={
        [raw[0].sourceId]:[evidence('applies_burn')],
        [raw[1].sourceId]:[evidence('payoff_burn')]
      },strongStore={...weakStore,[raw[2].sourceId]:[evidence('applies_burn')],[raw[3].sourceId]:[evidence('payoff_burn')]};
      const weak=T.evaluate(withStore(weakStore,raw),{plan:'burn',presetMode:'hard',format:'auto'}),strong=T.evaluate(withStore(strongStore,raw),{plan:'burn',presetMode:'hard',format:'auto'});
      assert(!weak.valid&&weak.engine.complete&&!weak.engine.coherent,'Two contributors passed a forced eight-unit Burn plan');
      assert(strong.valid&&strong.engine.coherent&&strong.contributionLedger.plan.contributors===4,'Four-contributor forced Burn plan did not pass coherently');
      return `${weak.engine.contributorCount}/8 rejected; ${strong.engine.contributorCount}/8 accepted`;
    });

    test('unavailable typed plan is explicitly relaxed',()=>{
      const raw=makeTeam('Relaxed'),prepared=withStore({},raw),contract=T.planAvailability(prepared,'charge',{presetMode:'hard'}),report=T.evaluate(prepared,{plan:'charge',presetMode:'hard',format:'auto',planContract:contract});
      assert(contract.relaxed&&!contract.feasible&&/authoritative charge evidence/.test(contract.reason),'Missing Charge authority was not diagnosed');
      assert(report.valid&&report.relaxations.some(row=>row.type==='plan'&&row.plan==='charge'),'Unavailable plan relaxation was silent or still failed');
      return contract.reason;
    });

    test('unavailable primary archetype is explicitly relaxed',()=>{
      const raw=makeTeam('RelaxedPrimary'),prepared=withStore({},raw),options={plan:'hybrid',format:'auto',requirePlanComplete:false,archetypes:['charge']},contract=T.archetypeAvailability(prepared,options),report=T.evaluate(prepared,{...options,archetypeContract:contract});
      assert(contract.primary?.relaxed&&/authoritative charge evidence/.test(contract.primary.reason),'Missing primary Charge authority was not diagnosed');
      assert(report.valid&&report.relaxations.some(row=>row.type==='archetype'&&row.archetype==='charge'),'Primary effect relaxation was silent or still failed');
      return contract.primary.reason;
    });

    test('support plans require direct scoped evidence when feasible',()=>{
      const cases={heal:'role_team_healer',cleanse:'role_team_cleanser',defense:'role_defender',guardian:'role_guardian',spirit:'resource_spirit',tempo:'tempo_turn'};
      for(const [plan,feature] of Object.entries(cases)){
        const raw=makeTeam(`Support${plan}`),store={[raw[0].sourceId]:[evidence(feature)],[raw[1].sourceId]:[evidence(feature)]},prepared=withStore(store,raw),contract=T.planAvailability(prepared,plan,{presetMode:'hard'}),report=T.evaluate(prepared,{plan,presetMode:'hard',format:'auto',planContract:contract});
        assert(contract.feasible&&!contract.relaxed&&report.valid&&report.engine.coherent,`${plan} did not enforce its direct support evidence: ${report.errors.join('; ')}`);
      }
      const neutral=withStore({},makeTeam('AttackRelaxed')),attack=T.planAvailability(neutral,'attack',{presetMode:'hard'});
      assert(attack.relaxed&&/authoritative attack evidence/.test(attack.reason),'Unavailable Attack evidence was not explicitly relaxed');
      return 'Heal, Cleanse, Defense, Guardian, Spirit, and Tempo distinct; Attack relaxed without evidence';
    });

    test('V6 auto plan selection ignores legacy Frostburn keyword bias',()=>{
      const raw=[unit('SleepSetup01','Water'),unit('SleepPayoff01','Water'),unit('SleepSupport01','Light')];
      const prepared=withStore({
        SleepSetup01:[evidence('applies_sleep')],
        SleepPayoff01:[evidence('payoff_sleep')],
        SleepSupport01:[evidence('applies_sleep'),evidence('payoff_sleep')]
      },raw);
      const previous=g.OptimizerV5Lab;
      g.OptimizerV5Lab={candidatePool:{selectPlan:()=> 'burn'}};
      const plan=root.engine.selectedPlan({presetTag:'auto'},prepared);
      g.OptimizerV5Lab=previous;
      assert(plan==='sleep',`expected sleep from V6 evidence, got ${plan}`);
      return`${plan} selected from authoritative V6 evidence`;
    });

    test('all evaluator components and penalties are bounded',()=>{
      const raw=makeTeam('Bounded');
      const store={};raw.forEach((row,index)=>store[row.sourceId]=[evidence(index%2?'payoff_burn':'applies_burn'),evidence(index%3?'role_healer':'role_guardian')]);
      const report=T.evaluate(withStore(store,raw),{plan:'burn',format:'auto'});
      assert(report.valid,'Expected valid bounded fixture');
      assert([...Object.values(report.components),...Object.values(report.penalties)].every(value=>value>=0&&value<=100),'Unbounded component found');
      assert(report.score>=0&&report.score<=100,'Unbounded team score');
      return `score ${report.score.toFixed(2)}`;
    });

    test('leader evaluation uses selected eight and best-only stacking',()=>{
      const raw=makeTeam('Leader');
      raw[0].leaderSkill={internalId:'AllAllies20Percent',description:'All allies gain 20% Attack'};
      raw[1].leaderSkill={internalId:'FireAllies30Percent',description:'Fire allies gain 30% Attack'};
      const attached=withStore({},raw),leader=T.leaderValue(attached);
      assert(leader.stacking==='best_only'&&leader.scope===8,'Leader stacking/scope incorrect');
      assert(leader.selected&&leader.candidates.length===2,'Expected two candidates and one selected leader');
      assert(leader.selected.scope===8,'Selected leader did not evaluate all eight');
      return `${leader.selected.unitId} selected from ${leader.candidates.length}`;
    });

    test('structured leader profiles are consumed with provenance',()=>{
      const raw=makeTeam('StructuredLeader'),leaders={StructuredLeaderA01:{id:'WaterAllies25',name:'Water allies',description:'Water allies gain 25% Attack',affected:'Water allies',condition:'',elements:['water'],percentages:[25],generic:false}};
      const leader=T.leaderValue(withStore({},raw,{}, {},leaders));
      assert(leader.selected?.source==='generated-leader-profile','Generated leader profile was ignored');
      assert(leader.selected.element==='water'&&leader.selected.percent===25,'Structured leader element or percentage was reinterpreted incorrectly');
      return `${leader.selected.leaderId} covers ${leader.selected.matches}/8 selected units`;
    });

    test('coherent rainbow requires four contributing elements',()=>{
      const raw=makeTeam('Rainbow'),store={};
      const features=['applies_burn','payoff_burn','role_guardian','tempo_turn'];
      raw.forEach((row,index)=>store[row.sourceId]=[evidence(features[index%4])]);
      const report=T.evaluate(withStore(store,raw),{plan:'hybrid',format:'force_rainbow',strictFormat:true,requirePlanComplete:false});
      assert(report.valid,`Coherent four-element rainbow was rejected: ${report.errors.join('; ')} / ${JSON.stringify(report.element)}`);
      assert(report.element.contributingElements.length>=4,'Rainbow contribution count is below four');
      return `${report.element.distinctElements} elements, ${report.element.contributingElements.length} contributing`;
    });

    test('color-only rainbow is rejected',()=>{
      const raw=makeTeam('ColorOnly'),store={};
      raw.forEach((row,index)=>{if(index%4<3)store[row.sourceId]=[evidence(['applies_burn','payoff_burn','role_guardian'][index%4])];});
      const report=T.evaluate(withStore(store,raw),{plan:'hybrid',format:'force_rainbow',strictFormat:true,requirePlanComplete:false});
      assert(!report.valid,'Color-only fourth element passed strict rainbow');
      assert(report.element.distinctElements===4&&report.element.contributingElements.length===3,`Fixture did not isolate color-only contribution: ${JSON.stringify(report.element)}`);
      return 'four colors present, only three mechanically contributing';
    });

    test('newer neutral unit cannot replace mandatory setup',()=>{
      const raw=makeTeam('Mandatory'),store={};
      store[raw[0].sourceId]=[evidence('applies_burn')];store[raw[1].sourceId]=[evidence('payoff_burn')];
      const complete=withStore(store,raw);
      const neutral=unit('NewestNeutral01','Fire',{stats:{atk:999999,hp:999999,spd:999,cost:1}});
      const replaced=withStore(store,[neutral,...raw.slice(1)]);
      const good=T.evaluate(complete,{plan:'burn',format:'auto',metaWeight:'strong'}),bad=T.evaluate(replaced,{plan:'burn',format:'auto',metaWeight:'strong'});
      assert(good.valid,'Complete mechanical team was rejected');
      assert(!bad.valid&&bad.score===0,'Neutral newer unit overrode mandatory setup');
      return 'mechanical completeness remains mandatory at strong newer-unit weight';
    });

    test('newer-unit weighting is configurable and bounded',()=>{
      const older=makeTeam('OlderMeta').map(row=>({...row,__v5:{meta:{newer:0}}}));
      const newer=makeTeam('NewerMeta').map(row=>({...row,__v5:{meta:{newer:1}}}));
      const oldTeam=withStore({},older),newTeam=withStore({},newer),evaluate=(team,metaWeight)=>T.evaluate(team,{plan:'hybrid',format:'auto',metaWeight,requirePlanComplete:false});
      const offOld=evaluate(oldTeam,'off'),offNew=evaluate(newTeam,'off'),balancedOld=evaluate(oldTeam,'balanced'),balancedNew=evaluate(newTeam,'balanced'),strongOld=evaluate(oldTeam,'strong'),strongNew=evaluate(newTeam,'strong');
      const balancedGain=balancedNew.score-balancedOld.score,strongGain=strongNew.score-strongOld.score;
      assert(Math.abs(offNew.score-offOld.score)<.001,'Off mode still changed score by release recency');
      assert(balancedGain>0&&strongGain>balancedGain,'Higher setting did not increase the bounded recency preference');
      assert(strongNew.metaWeighting.scoreWeight===.10&&strongNew.componentWeights.boundedMetaPrior===.10,'Strong mode exceeded or missed the 10% contract');
      assert(strongNew.score<=100,'Strong meta weighting escaped the normalized score range');
      return `off ${offNew.score.toFixed(2)}, balanced gain ${balancedGain.toFixed(2)}, strong gain ${strongGain.toFixed(2)}`;
    });

    test('strong newer-unit weight preserves unique safety and leader value',()=>{
      const compare=({feature,leader=false})=>{
        const raw=makeTeam(`Required${feature||'Leader'}`),store={};
        if(feature)store[raw[0].sourceId]=[evidence(feature)];
        if(leader)raw[0].leaderSkill={internalId:'AllAllies20Percent',description:'All allies gain 20% Attack'};
        raw[0].__v5={meta:{newer:0}};
        const neutral=unit(`NewestNeutral${feature||'Leader'}01`,raw[0].element,{__v5:{meta:{newer:1}}});
        const good=T.evaluate(withStore(store,raw),{plan:'hybrid',format:'auto',metaWeight:'strong',requirePlanComplete:false});
        const bad=T.evaluate(withStore(store,[neutral,...raw.slice(1)]),{plan:'hybrid',format:'auto',metaWeight:'strong',requirePlanComplete:false});
        assert(good.score>bad.score,`Strong recency displaced unique ${feature||'leader'} value`);
      };
      compare({feature:'role_guardian'});compare({feature:'role_cleanser'});compare({leader:true});
      return 'guardian, cleanser, and leader contributions remain ahead of a neutral newer replacement';
    });

    test('structured Spirit facts produce an evidence-backed opening forecast',()=>{
      const raw=makeTeam('Spirit');raw[0].stats.spd=220;raw[1].stats.spd=180;
      const store={
        [raw[0].sourceId]:[evidence('resource_spirit',1.3,.98,'resolved.activeSkills.GainTwo#identifier')],
        [raw[1].sourceId]:[evidence('payoff_burn',1.5,.98,'resolved.activeSkills.BurnPayoff#identifier')]
      };
      const profiles=skillStore(raw,{[raw[0].sourceId]:[skill('GainTwo',{tuCost:80,spiritGain:2})],[raw[1].sourceId]:[skill('BurnPayoff',{tuCost:100,spiritCost:3})]});
      const forecast=R.teamForecast(withStore(store,raw,profiles),'burn');
      assert(forecast.source==='structured-skill-profiles','Structured authority was not used');
      assert(forecast.minimumReserve===1&&forecast.generatorBeforeSpender===true,`Unexpected forecast: ${JSON.stringify(forecast)}`);
      assert(forecast.openingSequence[0].skillId==='GainTwo','Speed-ordered generator was not first');
      return `reserve ${forecast.minimumReserve}, opening ${forecast.openingSequence.map(row=>row.skillId).join(' -> ')}`;
    });

    test('Spirit sequencing rewards generator before spender',()=>{
      const build=(generatorSpeed,spenderSpeed)=>{
        const raw=makeTeam('Order');raw[0].stats.spd=generatorSpeed;raw[1].stats.spd=spenderSpeed;
        const profiles=skillStore(raw,{[raw[0].sourceId]:[skill('Generator',{spiritGain:2})],[raw[1].sourceId]:[skill('Spender',{spiritCost:3})]});
        return R.teamForecast(withStore({},raw,profiles),'hybrid');
      };
      const good=build(220,180),bad=build(180,220);
      assert(good.minimumReserve<bad.minimumReserve,'Ordering did not change required reserve');
      assert(good.score>bad.score,'Resource score did not reward safer sequencing');
      return `${good.score.toFixed(1)} before vs ${bad.score.toFixed(1)} after`;
    });

    test('multiple high-cost opening actions raise a visible warning',()=>{
      const raw=makeTeam('Pressure'),profiles=skillStore(raw,{
        [raw[0].sourceId]:[skill('CostlyOne',{spiritCost:3})],
        [raw[1].sourceId]:[skill('CostlyTwo',{spiritCost:4})]
      });
      const forecast=R.teamForecast(withStore({},raw,profiles),'hybrid');
      assert(forecast.competingHighCostActions===2,'High-cost actions were not counted');
      assert(forecast.warnings.some(value=>/compete for Spirit/.test(value)),'Conflict warning was omitted');
      return forecast.warnings.join(' ');
    });

    test('team explanation cites only structured skills and exposes receipts',()=>{
      const raw=makeTeam('Explain'),store={};
      store[raw[0].sourceId]=[evidence('applies_burn',1.6,.98,'resolved.activeSkills.Ignite#identifier')];
      store[raw[1].sourceId]=[evidence('payoff_burn',1.5,.98,'resolved.activeSkills.BurnBlast#identifier')];
      const profiles=skillStore(raw,{[raw[0].sourceId]:[skill('Ignite',{spiritGain:1})],[raw[1].sourceId]:[skill('BurnBlast',{spiritCost:2})]});
      const team=withStore(store,raw,profiles),evaluation=T.evaluate(team,{plan:'burn',format:'auto'}),report=X.explain(team,evaluation,{plan:'burn',format:'hybrid'});
      const allowed=new Set(Object.values(profiles).flatMap(row=>row.skills.map(value=>value.id)));
      assert(report.openingSequence.every(action=>allowed.has(action.skillId)),'Explanation invented a skill');
      assert(report.receipts.length===Object.keys(evaluation.components).length,'Score receipts are incomplete');
      assert(report.method==='deterministic-evidence-reasoning','Explanation method is not explicit');
      return `${report.openingSequence.length} sourced actions, ${report.receipts.length} receipts`;
    });

    test('missing runtime authority fails without fallback',()=>{
      const previous=g.OptimizerRuntime;g.OptimizerRuntime={contracts:{optimizerFoundationReady:false},chunks:{}};
      const report=expectedFailure(()=>root.engine.run(makeTeam('MissingRuntime'),{buildScope:'story',presetMode:'hard',presetTag:'burn'}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&report.diagnostics.usedFallback===false,'Missing runtime did not fail safely');
      return report.engineVersion;
    });

    test('insufficient roster fails without changing format contracts',()=>{
      const previous=g.OptimizerRuntime;g.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:{},skillProfiles:{}}};
      const report=expectedFailure(()=>root.engine.run(makeTeam('Short').slice(0,7),{buildScope:'story',presetMode:'hard',presetTag:'burn'}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&/Insufficient owned roster/.test(report.diagnostics.v6Error),'Insufficient roster was concealed');return report.diagnostics.v6Error;
    });

    test('invalid locked unit is reported and V4 remains unused',()=>{
      const raw=makeTeam('BadLock'),store={};raw.forEach((row,index)=>store[row.sourceId]=[evidence(index%2?'payoff_burn':'applies_burn')]);const prepared=withStore(store,raw),previous=g.OptimizerRuntime;
      g.OptimizerRuntime={contracts:{optimizerFoundationReady:true},chunks:{featureEvidence:store,skillProfiles:{}}};const report=expectedFailure(()=>root.engine.run(prepared,{preparedV6:true,buildScope:'story',presetMode:'hard',presetTag:'burn',currentLayout:{storyMain:['MissingUnit','','','',''],storyBack:['','','']},slotLocks:{storyMain:[true,false,false,false,false],storyBack:[false,false,false]}}));g.OptimizerRuntime=previous;
      assert(report.diagnostics.v6Failed&&report.diagnostics.usedFallback===false&&/Locked Story unit/.test(report.diagnostics.v6Error),'Invalid lock did not fail explicitly');return report.diagnostics.v6Error;
    });

    test('locked platoon identities are reserved before Story search',()=>{
      const raw=Array.from({length:10},(_,index)=>unit(`Reserve${String.fromCharCode(65+index)}01`,'Fire',{stats:{atk:1000+index*10,hp:5000,spd:100,cost:20}})),store={};
      raw.forEach((row,index)=>store[row.sourceId]=[evidence(index%2?'payoff_burn':'applies_burn')]);const prepared=withStore(store,raw),reserved=raw[9].sourceId;
      const options={preparedV6:true,buildScope:'story',presetMode:'hard',presetTag:'burn',currentLayout:{platoons:[[reserved,'','','','']]},slotLocks:{platoons:[[true,false,false,false,false]]}};
      const eligible=root.engine.storyEligible(prepared,options),report=root.engine.run(prepared,options),selected=[...report.story.main,...report.story.back];
      assert(!eligible.some(row=>row.sourceId===reserved)&&!selected.includes(reserved),'Story consumed a unit locked to a platoon');
      assert(report.diagnostics.reservedPlatoonUnits===1,'Reserved platoon diagnostics are missing');
      return `${reserved} reserved from Story`;
    });

    const failed=results.filter(row=>!row.pass);
    return{passed:results.length-failed.length,failed:failed.length,total:results.length,results,policyVersion:P.version};
  }

  root.regressionFixtures={run};
  g.runOptimizerV6RegressionFixtures=run;
})(window);
