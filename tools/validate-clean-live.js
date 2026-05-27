#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const required = [
  'index.html',
  'roster.html',
  'optimizer.html',
  'stat-test.html',
  'live-data-config.js',
  'runtime-data-bridge.js',
  'optimizerRuntimeLoader.js',
  'apkfiles/entries/manifest.json',
  'apkfiles/entries/runtime/optimizer_runtime_manifest.json',
  'apkfiles/derived/evertale-runtime-scaling.json',
  'apkfiles/derived/character-seed-index.json'
];

let ok = true;
for (const file of required) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    console.error('[MISS]', file);
    ok = false;
  } else {
    console.log('[OK]', file);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apkfiles/entries/runtime/optimizer_runtime_manifest.json'), 'utf8'));
console.log('[runtime chunks]', Object.keys(manifest.chunks || {}).join(', '));

if (!ok) process.exit(1);
console.log('Validation passed.');
