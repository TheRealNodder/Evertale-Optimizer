'use strict';

const path=require('path');

global.window=global;
global.OptimizerRuntime={chunks:{featureEvidence:{}}};

for(const file of [
  'optimizer-v6-policy.js',
  'optimizer-v6-evidence.js',
  'optimizer-v6-feature-model.js',
  'optimizer-v6-team-evaluator.js',
  'optimizer-v6-regression-fixtures.js'
])require(path.join(__dirname,'..','optimizer-v6',file));

const report=global.runOptimizerV6RegressionFixtures();
for(const row of report.results)console.log(`${row.pass?'PASS':'FAIL'} ${row.name}: ${row.detail}`);
console.log(`V6 foundation fixtures: ${report.passed}/${report.total} passed`);
if(report.failed)process.exitCode=1;
