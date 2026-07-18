'use strict';

const path=require('path');

global.window=global;
global.OptimizerRuntime={chunks:{featureEvidence:{},skillProfiles:{}}};

for(const file of [
  'optimizer-v6-policy.js',
  'optimizer-v6-evidence.js',
  'optimizer-v6-resource-reasoner.js',
  'optimizer-v6-feature-model.js',
  'optimizer-v6-team-evaluator.js',
  'optimizer-v6-explanations.js',
  'optimizer-v6-story-search.js',
  'optimizer-v6-platoon-generator.js',
  'optimizer-v6-platoon-allocator.js',
  'optimizer-v6-engine.js',
  'optimizer-v6-controller.js',
  'optimizer-v6-regression-fixtures.js',
  'optimizer-v6-story-regression-fixtures.js',
  'optimizer-v6-platoon-regression-fixtures.js'
])require(path.join(__dirname,'..','optimizer-v6',file));

for(const [name,run] of [['foundation',global.runOptimizerV6RegressionFixtures],['story',global.runOptimizerV6StoryRegressionFixtures],['platoon',global.runOptimizerV6PlatoonRegressionFixtures]]){
  const report=run();
  for(const row of report.results)console.log(`${row.pass?'PASS':'FAIL'} ${row.name}: ${row.detail}`);
  console.log(`V6 ${name} fixtures: ${report.passed}/${report.total} passed`);
  if(report.failed)process.exitCode=1;
}
