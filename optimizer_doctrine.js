// optimizer_doctrine.js
window.OPTIMIZER_DOCTRINE = {
  OPTIMIZER_DOCTRINE: {
    dataAuthority: {
      charactersJsonCanonical: true,
      neverMutateCharactersAtRuntime: true,
      leaderSkillNeverNullRule: true,
      missingLeaderFallback: { name: "No Leader Skill", description: "This unit does not provide a leader skill." }
    },
    teamFormats: { story: { main: 5, back: 3 }, platoons: { count: 20, size: 5 } },
    leaderSkill: {
      appliesTo: "all_8",
      stacking: "best_only",
      mathModel: "multiplier",
      scopeRules: {
        elementMentioned: { mode: "mono_bias", minMatchRatio: 0.6 },
        genericAllies: { valueTier: "medium" }
      },
      parsing: {
        detectElements: ["fire","water","storm","earth","light","dark"],
        detectPercents: true,
        percentHandling: "use_if_found_else_tag_only",
        keywordsToTag: {
          sleep: ["sleep"],
          burn: ["burn","ignite"],
          poison: ["poison","toxic","venom"],
          stun: ["stun","freeze"],
          heal: ["heal","regen","revive","resurrect"],
          turn: ["tu","turn","push back","time strike"],
          atkBuff: ["attack up","atk up","attack increased","damage up"],
          hpBuff: ["max hp","hp increased","damage reduction","shield","barrier"],
          cleanse: ["cleanse","purify","remove debuff","immunity"]
        }
      },
      tieBreakers: ["higherMatchRatio","higherParsedPercent","higherTeamAtk"]
    },
    statusWeights: { poison:5, burn:5, turn:5, sleep:4, stun:4, heal:4, atkBuff:3, hpBuff:3, cleanse:3 },
    roleRules: {
      deriveRolesFromTags: true,
      storyRequirements: { dpsMin:2, sustainMin:1, controlMin:1, enforcement:"soft_penalty" },
      platoonRequirements: { dpsMin:1, sustainOrControlMin:1, enforcement:"soft_penalty" }
    },
    frontVsBack: {
      assignmentMode: "auto",
      frontPreference: { weightSpd:0.6, weightControl:0.3, weightHp:0.1 },
      backPreference: { weightAtk:0.6, weightHeal:0.3, weightRevive:0.1 },
      neverBacklineTags: [],
      neverFrontlineTags: []
    },
    monoVsRainbow: {
      selectionMode: "auto",
      monoRequiresLeader: true,
      monoThreshold: { story:0.75, platoon:0.8 },
      rainbowThreshold: { storyDistinctElementsMin:4 },
      whenToPreferMono: ["leaderElementMatchesMajority","teamHasStrongSingleStatusPlan"],
      whenToPreferRainbow: ["noStrongElementLeader","needCoverageOrSafety"]
    },
    optimizerSearch: {
      candidatePoolSize: 80,
      beamWidthStory: 120,
      greedyPlatoons: true,
      duplicatePolicyAcrossPlatoons: "no_duplicates",
      duplicatePolicyStoryVsPlatoons: "story_units_excluded",
      varietyPressure: { enabled:true, penalizeOverusedTags:true, penaltyPerRepeatTag:0.15 }
    },
    scoringModel: {
      baseStats: { atkWeight:0.42, spdWeight:0.28, hpWeight:0.2, efficiencyAtkPerCostWeight:0.1 },
      teamAdditives: { coverageWeight:0.25, pairSynergyWeight:0.35, elementStrategyWeight:0.4 },
      leaderMultiplierWeight: 0.6
    },
    examples: {
      explainInOneParagraph: "",
      sanityChecks: [
        "If only 8 owned units exist, story uses all 8.",
        "If fewer than 100 owned units exist, platoons fill as many as possible then leave blanks.",
        "Leader skill is chosen from within the story 8.",
        "No mutation of characters.json."
      ]
    }
  }
};