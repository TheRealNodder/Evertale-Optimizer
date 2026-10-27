'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_PATH = path.join(ROOT, 'apkfiles', 'entries', 'runtime', 'optimizer_runtime_model.json');
const SEED_PATH = path.join(ROOT, 'apkfiles', 'derived', 'character-seed-index.json');
const PROFILE_STORAGE_KEY = 'evertale_roster_profiles_v1';

function parseArgs(argv) {
  const args = { intelligence: 'probe', profile: '', json: '', plans: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index] || '';
    else if (token === '--json') args.json = argv[++index] || '';
    else if (token === '--plans') args.plans = argv[++index] || '';
    else if (token === '--intelligence') args.intelligence = argv[++index] || 'probe';
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function printHelp() {
  console.log([
    'Usage: node tools/audit_optimizer_v6_catalog.js [options]',
    '',
    'Options:',
    '  --profile <file>       Audit only families in an exported roster profile.',
    '  --plans <csv>          Limit strategy audit (default: every V6 plan).',
    '  --intelligence <level> probe, standard, deep, or ultra (default: probe).',
    '  --json <file>          Write the complete audit report as JSON.',
  ].join('\n'));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sourceIdOf(entry) {
  return String(entry?.sourceId || entry?.internal?.sourceId || entry?.raw?.name || '').trim();
}

function familyOf(entry) {
  const sourceId = sourceIdOf(entry);
  return String(entry?.family || entry?.internal?.family || entry?.raw?.family || sourceId.replace(/\d+$/, '')).trim();
}

function formRank(entry) {
  const sourceId = sourceIdOf(entry);
  const suffix = Number(sourceId.match(/(\d+)$/)?.[1] || 0);
  return suffix || Number(entry?.stars || entry?.raw?.stars || 0) || 1;
}

function mergeCharacterFamilies(characterEntries) {
  const groups = new Map();
  for (const entry of Object.values(characterEntries || {})) {
    const family = familyOf(entry);
    if (!family) continue;
    if (!groups.has(family)) groups.set(family, []);
    groups.get(family).push(entry);
  }

  return [...groups.entries()].map(([family, entries]) => {
    entries.sort((left, right) => formRank(left) - formRank(right) || sourceIdOf(left).localeCompare(sourceIdOf(right)));
    const best = entries[entries.length - 1];
    const forms = entries.map(entry => ({
      sourceId: sourceIdOf(entry),
      dataSourceId: sourceIdOf(entry),
      state: formRank(entry) === 1 ? 'base' : formRank(entry) >= 3 ? 'final' : 'evolved',
      stars: Number(entry?.stars ?? entry?.raw?.stars ?? 0),
      rarity: entry?.rarity || '',
      stats: entry?.stats || {},
      raw: entry?.raw || {},
      refs: entry?.refs || {},
      activeSkills: entry?.activeSkills || entry?.refs?.activeSkills || [],
      passiveSkills: entry?.passiveSkills || entry?.refs?.passives || [],
      order: Number(entry?.sourceOrder || entry?.fileHandleOrder || entry?.order || 0),
    }));
    const order = Math.max(...entries.map(entry => Number(entry?.sourceOrder || entry?.fileHandleOrder || entry?.order || 0)), 0);
    return {
      ...best,
      id: family,
      sourceId: family,
      family,
      internal: { ...(best?.internal || {}), family, sourceId: sourceIdOf(best) },
      formSourceIds: entries.map(sourceIdOf),
      forms,
      statsByForm: forms,
      skillsByForm: forms,
      stats: best?.stats || {},
      atk: best?.stats?.atk ?? best?.atk,
      hp: best?.stats?.hp ?? best?.hp,
      spd: best?.stats?.spd ?? best?.spd,
      cost: best?.stats?.cost ?? best?.cost,
      fileHandleOrder: order,
      sourceOrder: order,
      order,
    };
  }).sort((left, right) => Number(right.order) - Number(left.order) || left.family.localeCompare(right.family));
}

function installBrowserStubs(profileState) {
  global.window = global;
  const store = new Map();
  if (profileState) store.set(PROFILE_STORAGE_KEY, JSON.stringify(profileState));
  global.localStorage = {
    getItem: key => store.has(String(key)) ? store.get(String(key)) : null,
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: key => store.delete(String(key)),
  };
  global.dispatchEvent = global.dispatchEvent || (() => true);
  global.CustomEvent = global.CustomEvent || class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
}

function loadRuntimeModules(runtime, profileState) {
  installBrowserStubs(profileState);
  global.OptimizerRuntime = {
    contracts: { optimizerFoundationReady: true },
    chunks: {
      featureEvidence: runtime.featureEvidence || {},
      skillProfiles: runtime.skillProfiles || {},
      leaderProfiles: runtime.leaderProfiles || {},
    },
  };
  require(path.join(ROOT, 'runtime-stat-engine.js'));
  if (fs.existsSync(SEED_PATH)) global.EvertaleRuntimeStatEngine.installSeedIndex(readJson(SEED_PATH));
  require(path.join(ROOT, 'roster-profile-store.js'));
  require(path.join(ROOT, 'optimizer-v5-lab', 'optimizer-v5-shared.js'));
  for (const file of [
    'optimizer-v6-policy.js',
    'optimizer-v6-local-meta.js',
    'optimizer-v6-evidence.js',
    'optimizer-v6-skill-model.js',
    'optimizer-v6-resource-reasoner.js',
    'optimizer-v6-feature-model.js',
    'optimizer-v6-team-evaluator.js',
    'optimizer-v6-explanations.js',
    'optimizer-v6-story-search.js',
    'optimizer-v6-platoon-generator.js',
    'optimizer-v6-platoon-allocator.js',
    'optimizer-v6-engine.js',
  ]) require(path.join(ROOT, 'optimizer-v6', file));
}

function compactUnit(unit, plan) {
  const feature = global.OptimizerV6.featureModel;
  const skill = global.OptimizerV6.skillModel.portfolio(unit, plan);
  const signal = feature.archetypeSignal(unit, plan);
  const roles = unit?.__v6?.roles || {};
  const strongestRole = Object.entries(roles).sort((left, right) => Number(right[1]) - Number(left[1]))[0] || ['', 0];
  return {
    id: String(unit?.id || unit?.sourceId || ''),
    name: String(unit?.name || unit?.title || unit?.id || ''),
    element: String(unit?.element || ''),
    planContribution: Number(signal.score.toFixed(2)),
    setup: Number(signal.setup.toFixed(3)),
    payoff: Number(signal.payoff.toFixed(3)),
    strongestRole: strongestRole[0],
    roleScore: Number(Number(strongestRole[1]).toFixed(2)),
    hardConflict: feature.hardPlanConflict(unit, plan),
    antiSynergy: Number(feature.antiSynergy(unit, plan).toFixed(3)),
    topSkill: skill.topAction ? {
      id: skill.topAction.skill.id,
      name: skill.topAction.skill.name,
      score: Number(skill.topAction.score.toFixed(2)),
      features: skill.topAction.features,
      reason: skill.topAction.reason,
    } : null,
  };
}

function summarizeTeam(best, plan, diagnostics = {}) {
  if (!best) return null;
  const units = best.ordered || [];
  const rows = units.map(unit => compactUnit(unit, plan));
  const elementCounts = {};
  for (const row of rows) elementCounts[row.element || 'Unknown'] = (elementCounts[row.element || 'Unknown'] || 0) + 1;
  return {
    score: Number(best.evaluation.score.toFixed(3)),
    elements: elementCounts,
    distinctElements: Object.keys(elementCounts).length,
    contributors: rows.filter(row => row.planContribution > 0).length,
    setupContributors: rows.filter(row => row.setup > 0).length,
    payoffContributors: rows.filter(row => row.payoff > 0).length,
    hardConflicts: rows.filter(row => row.hardConflict).map(row => row.id),
    relaxed: diagnostics?.planContract?.relaxed === true,
    relaxationReason: diagnostics?.planContract?.reason || '',
    durationMs: Number(diagnostics?.durationMs || 0),
    units: rows,
  };
}

function selectedUnits(prepared, ids) {
  const map = new Map();
  for (const unit of prepared) {
    for (const key of [unit?.id, unit?.sourceId, unit?.family, unit?.internal?.sourceId, ...(unit?.formSourceIds || [])]) {
      if (key && !map.has(String(key))) map.set(String(key), unit);
    }
  }
  return (ids || []).map(id => map.get(String(id))).filter(Boolean);
}

function auditRuntimeCoverage(runtime, units, prepared) {
  const allEntries = Object.values(runtime.characterEntries || {});
  const evidenceIds = new Set(Object.keys(runtime.featureEvidence || {}));
  const skillIds = new Set(Object.keys(runtime.skillProfiles || {}));
  const exactTargetSkills = Object.values(runtime.skillProfiles || {}).flatMap(profile => profile?.skills || [])
    .filter(skill => skill?.target && typeof skill.target === 'object' && skill.target.authority).length;
  const allSkills = Object.values(runtime.skillProfiles || {}).flatMap(profile => profile?.skills || []);
  return {
    characterEntries: allEntries.length,
    families: units.length,
    entriesWithEvidence: allEntries.filter(entry => evidenceIds.has(sourceIdOf(entry))).length,
    entriesWithSkillProfiles: allEntries.filter(entry => skillIds.has(sourceIdOf(entry))).length,
    contextualSkills: allSkills.length,
    exactTargetContracts: exactTargetSkills,
    preparedFamiliesWithEvidence: prepared.filter(unit => (unit?.__v6?.evidence?.records || []).length).length,
    preparedFamiliesWithSkills: prepared.filter(unit => (unit?.__v6?.skillProfile?.skills || []).length).length,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { printHelp(); return; }
  const runtime = readJson(RUNTIME_PATH);
  const profileState = args.profile ? readJson(path.resolve(args.profile)) : null;
  loadRuntimeModules(runtime, profileState);

  const allFamilies = mergeCharacterFamilies(runtime.characterEntries);
  const profileFamilies = new Set(Object.keys(profileState?.profiles || {}));
  const units = profileState ? allFamilies.filter(unit => profileFamilies.has(unit.family)) : allFamilies;
  const missingProfileFamilies = profileState ? [...profileFamilies].filter(family => !allFamilies.some(unit => unit.family === family)) : [];
  const engine = global.OptimizerV6.engine;
  const policy = global.OptimizerV6.policy;
  const storySearch = global.OptimizerV6.storySearch;
  const prepared = engine.prepare(units, { metaWeight: 'balanced' });
  const requestedPlans = args.plans
    ? args.plans.split(',').map(value => policy.normalizeArchetype(value)).filter(Boolean)
    : [...policy.plans];
  const plans = [...new Set(requestedPlans)];
  const errors = [];
  const warnings = [];
  const planAudits = [];

  if (prepared.length < policy.story.total) errors.push(`Roster has ${prepared.length} units; Story requires ${policy.story.total}.`);
  for (const plan of plans) {
    const options = {
      plan,
      presetTag: plan === 'hybrid' ? '' : plan,
      presetMode: plan === 'hybrid' ? 'auto' : 'hard',
      format: 'auto',
      strictFormat: false,
      searchIntelligence: args.intelligence,
      metaWeight: 'balanced',
    };
    const result = storySearch.search(prepared, options);
    const team = summarizeTeam(result.best, plan, result.diagnostics);
    planAudits.push({ plan, ...team, search: result.diagnostics });
    if (!team) { errors.push(`${plan}: no legal Story team.`); continue; }
    if (team.hardConflicts.length) errors.push(`${plan}: destructive plan conflicts selected: ${team.hardConflicts.join(', ')}.`);
    if (!team.relaxed && policy.pairedPlans.includes(plan) && (!team.setupContributors || !team.payoffContributors)) {
      errors.push(`${plan}: an unrelaxed paired plan is missing setup or payoff.`);
    }
  }

  const monoAudits = [];
  for (const element of policy.elements) {
    const result = storySearch.search(prepared, {
      plan: 'hybrid', format: 'force_mono', targetElement: element, strictFormat: true,
      searchIntelligence: args.intelligence, metaWeight: 'balanced',
    });
    const team = summarizeTeam(result.best, 'hybrid', result.diagnostics);
    monoAudits.push({ element, ...team, search: result.diagnostics });
    if (!team) { warnings.push(`${element}: no complete legal mono Story team in this roster.`); continue; }
    const selectedElements = Object.keys(team.elements).map(value => value.toLowerCase());
    if (selectedElements.length !== 1 || selectedElements[0] !== element) errors.push(`${element}: mono audit selected ${selectedElements.join(', ') || 'no element'}.`);
  }

  const burnResult = engine.run(prepared, {
    preparedV6: true,
    buildScope: 'story',
    plan: 'burn',
    presetTag: 'burn',
    presetMode: 'hard',
    searchIntelligence: args.intelligence === 'probe' ? 'standard' : args.intelligence,
    metaWeight: 'balanced',
  });
  let burnTournament = null;
  if (burnResult?.diagnostics?.v6Failed) errors.push(`Burn tournament failed: ${burnResult.diagnostics.v6Error}`);
  else {
    const ids = [...(burnResult.story?.main || []), ...(burnResult.story?.back || [])];
    const teamUnits = selectedUnits(prepared, ids);
    burnTournament = {
      format: burnResult.format,
      plan: burnResult.plan,
      score: Number(Number(burnResult.score).toFixed(3)),
      durationMs: burnResult.diagnostics?.durationMs || 0,
      selectedElement: burnResult.diagnostics?.selectedElement || '',
      units: teamUnits.map(unit => compactUnit(unit, 'burn')),
      usedFallback: burnResult.diagnostics?.usedFallback === true,
    };
    const conflicts = burnTournament.units.filter(unit => unit.hardConflict).map(unit => unit.id);
    if (conflicts.length) errors.push(`Burn tournament selected destructive conflicts: ${conflicts.join(', ')}.`);
    if (burnTournament.usedFallback) errors.push('Burn tournament used a fallback engine.');
  }

  const report = {
    status: errors.length ? 'failed' : warnings.length ? 'warning' : 'ok',
    generatedAt: new Date().toISOString(),
    policyVersion: policy.version,
    runtimeSchemaVersion: runtime.schemaVersion,
    scope: profileState ? 'roster-profile' : 'full-catalog',
    profilePath: args.profile ? path.resolve(args.profile) : '',
    requestedFamilies: profileFamilies.size,
    auditedFamilies: prepared.length,
    missingProfileFamilies,
    intelligence: args.intelligence,
    coverage: auditRuntimeCoverage(runtime, allFamilies, prepared),
    planAudits,
    monoAudits,
    burnTournament,
    errors,
    warnings,
  };

  if (args.json) {
    const output = path.resolve(args.json);
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${output}`);
  }

  console.log(`Optimizer V6 catalog audit: ${report.status}`);
  console.log(`Scope: ${report.scope}; families: ${report.auditedFamilies}; policy: ${report.policyVersion}`);
  console.log(`Coverage: evidence ${report.coverage.entriesWithEvidence}/${report.coverage.characterEntries}, skills ${report.coverage.entriesWithSkillProfiles}/${report.coverage.characterEntries}, contextual actions ${report.coverage.contextualSkills}`);
  console.log('Plans:');
  for (const row of planAudits) {
    console.log(`- ${row.plan}: ${row.score ?? 'n/a'}; contributors ${row.contributors ?? 0}; setup/payoff ${row.setupContributors ?? 0}/${row.payoffContributors ?? 0}; conflicts ${(row.hardConflicts || []).length}; relaxed ${row.relaxed === true}`);
  }
  console.log('Mono elements:');
  for (const row of monoAudits) console.log(`- ${row.element}: ${row.score ?? 'unavailable'}; ${row.distinctElements ?? 0} element(s)`);
  if (burnTournament) {
    console.log(`Burn tournament: ${burnTournament.format}/${burnTournament.selectedElement || 'mixed'} score ${burnTournament.score} in ${burnTournament.durationMs} ms`);
    for (const unit of burnTournament.units) console.log(`  ${unit.id} [${unit.element}] plan ${unit.planContribution}; ${unit.topSkill?.name || 'no structured action'}; conflict ${unit.hardConflict}`);
  }
  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  for (const error of errors) console.error(`ERROR: ${error}`);
  if (errors.length) process.exitCode = 1;
}

try { main(); }
catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
}
