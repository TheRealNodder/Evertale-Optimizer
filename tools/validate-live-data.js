#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const required = [
  'apkfiles/entries/bundles/catalog.bundle.json',
  'apkfiles/entries/bundles/character_families.bundle.json',
  'apkfiles/entries/characters/families/index.json',
  'apkfiles/entries/weapons/index.json',
  'apkfiles/entries/accessories/index.json',
  'apkfiles/entries/bosses/index.json',
  'live-data-config.js',
  'data-loader.js',
  'catalog.js',
  'app.js',
  'optimizer.js',
];

let ok = true;
for (const rel of required) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.error(`[missing] ${rel}`);
    ok = false;
  } else {
    console.log(`[ok] ${rel}`);
  }
}

const forbiddenRoots = ['data'];
for (const rel of forbiddenRoots) {
  if (fs.existsSync(path.join(root, rel))) {
    console.error(`[live-mode violation] root /${rel} still exists; move it to /legacy/${rel}`);
    ok = false;
  }
}

const sourceFiles = ['app.js', 'catalog.js', 'data-loader.js', 'optimizer.js'];
for (const rel of sourceFiles) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  if (text.includes('./data/') || text.includes('"/data') || text.includes("'/data")) {
    console.error(`[live-mode violation] ${rel} still references /data`);
    ok = false;
  }
}

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'apkfiles/entries/bundles/catalog.bundle.json'), 'utf8'));
const counts = Object.fromEntries(Object.entries(catalog.categories || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));
console.log('[catalog counts]', counts);

if (!counts.characters) {
  console.error('[invalid] catalog bundle contains no characters');
  ok = false;
}

process.exit(ok ? 0 : 1);
