const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');
const errors = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function literalConst(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(['\"])(.*?)\\1;`));
  return match ? match[2] : '';
}

const pages = ['index.html', 'roster.html', 'optimizer.html'];
const liveConfigSource = read('live-data-config.js');
const dataVersionBase = literalConst(liveConfigSource, 'DATA_VERSION_BASE');
const runtimeRevision = literalConst(liveConfigSource, 'RUNTIME_CACHE_REVISION');
const expectedDataVersion = [dataVersionBase, runtimeRevision].filter(Boolean).join('-');
if (!dataVersionBase || !runtimeRevision) {
  errors.push('live-data-config.js must separate DATA_VERSION_BASE from RUNTIME_CACHE_REVISION');
}

const themeSource = read('seasonal-theme.js');
for (const gem of ['gold', 'silver', 'ruby', 'sapphire', 'emerald', 'amethyst', 'diamond', 'pearl', 'platinum', 'opal', 'topaz', 'jade', 'obsidian', 'quartz']) {
  if (!themeSource.includes(`${gem}:`)) errors.push(`Gem/mineral theme is missing: ${gem}`);
}
for (const handheld of ['crimsonblack', 'cobaltblack', 'metallicrose', 'bronzexl', 'blackwhitedsi', 'galaxystyle', 'superfamicom']) {
  if (!themeSource.includes(`${handheld}:`)) errors.push(`DS/3DS theme is missing: ${handheld}`);
}
for (const legendary of [
  'hooh', 'lugia', 'suicune',
  'groudon', 'kyogre', 'rayquaza', 'shinyprimalgroudon', 'shinyprimalkyogre', 'shinymegarayquaza',
  'dialga', 'palkia', 'giratina', 'arceus',
  'reshiram', 'zekrom', 'blackkyurem', 'whitekyurem',
  'xerneas', 'yveltal', 'zygarde',
  'solgaleo', 'lunala', 'ultranecrozma',
  'zacian', 'zamazenta', 'eternatus',
  'koraidon', 'miraidon', 'terapagos',
]) {
  if (!themeSource.includes(`${legendary}:`)) errors.push(`Legendary theme is missing: ${legendary}`);
}
if (!themeSource.includes('data-theme-material') || !themeSource.includes('prefers-reduced-motion')) {
  errors.push('Gem themes must retain material scoping and reduced-motion handling');
}
if (!themeSource.includes('evertale-legendary-outline-pulse') || !themeSource.includes('--legendary-body') || !themeSource.includes('--legendary-energy') || !themeSource.includes('--legendary-detail')) {
  errors.push('Legendary themes must retain their fixed palette and subtle energy-outline pulse');
}
const siteMenuSource = read('site-menu.js');
for (const group of ['Calendar', 'Pokémon · Versions', 'Pokémon · Hoenn Shiny', 'Pokémon · Paldea', 'Gems & Minerals', 'DS & 3DS', 'Signature']) {
  if (!themeSource.includes(`'${group}'`)) errors.push(`Theme menu group is missing: ${group}`);
}
if (!siteMenuSource.includes('siteThemeSwatchDivider') || !siteMenuSource.includes('groupOrder')) errors.push('Theme swatch category dividers are missing');

for (const page of pages) {
  const html = read(page);
  const refs = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)/g)].map(match => match[1]);
  for (const ref of refs) {
    if (!exists(ref)) errors.push(`${page} references missing file: ${ref}`);
  }
  if (!html.includes(`live-data-config.js?v=${expectedDataVersion}`)) {
    errors.push(`${page} does not use the current full live-data config cache token`);
  }
  if (page !== 'optimizer.html' && !html.includes(`characters.live.bundle.json?v=${expectedDataVersion}`)) {
    errors.push(`${page} does not preload the current live character bundle`);
  }
  const sharedOrder = ['seasonal-theme.js', 'site-menu.js', 'live-data-config.js', 'image-cache-reset.js', 'data-loader.js'];
  let sharedPrevious = -1;
  for (const file of sharedOrder) {
    const current = html.indexOf(file);
    if (current < 0) errors.push(`${page} is missing shared runtime authority: ${file}`);
    if (current >= 0 && current < sharedPrevious) errors.push(`${page} shared runtime load order is invalid near: ${file}`);
    sharedPrevious = Math.max(sharedPrevious, current);
  }
}

const catalogHtml = read('index.html');
const catalogOrder = [
  'live-data-config.js',
  'data-loader.js',
  'data-loader-index-authority.js',
  'catalog-character-state-repair.js',
  'catalog-v2-lite.js',
  'catalog-click-fast-authority.js',
];
let previous = -1;
for (const file of catalogOrder) {
  const current = catalogHtml.indexOf(file);
  if (current < 0) errors.push(`index.html is missing runtime authority: ${file}`);
  if (current >= 0 && current < previous) errors.push(`index.html load order is invalid near: ${file}`);
  previous = Math.max(previous, current);
}

const catalog = JSON.parse(read('apkfiles/entries/bundles/catalog.bundle.json'));
for (const category of ['characters', 'weapons', 'accessories', 'bosses']) {
  const count = Array.isArray(catalog.categories?.[category]) ? catalog.categories[category].length : 0;
  if (!count) errors.push(`catalog.bundle.json has no ${category}`);
}

const fullCharacterBundle = JSON.parse(read('apkfiles/entries/bundles/characters.bundle.json'));
const liveCharacterBundlePath = 'apkfiles/entries/bundles/characters.live.bundle.json';
if (!exists(liveCharacterBundlePath)) {
  errors.push(`Missing fast runtime bundle: ${liveCharacterBundlePath}`);
} else {
  const liveCharacterBundle = JSON.parse(read(liveCharacterBundlePath));
  const fullCount = Array.isArray(fullCharacterBundle.entries) ? fullCharacterBundle.entries.length : 0;
  const liveCount = Array.isArray(liveCharacterBundle.entries) ? liveCharacterBundle.entries.length : 0;
  if (!fullCount || liveCount !== fullCount) errors.push(`Fast character bundle count ${liveCount} does not match full count ${fullCount}`);
  const fullBytes = fs.statSync(path.join(root, 'apkfiles/entries/bundles/characters.bundle.json')).size;
  const liveBytes = fs.statSync(path.join(root, liveCharacterBundlePath)).size;
  if (liveBytes >= fullBytes * 0.5) errors.push(`Fast character bundle is unexpectedly large: ${liveBytes} of ${fullBytes} bytes`);
  const sourceIds = new Set((liveCharacterBundle.entries || []).map(row => String(row?.internal?.sourceId || row?.sourceId || '')));
  for (const sourceId of ['JeanneFusion01', 'JeanneFusion02']) {
    if (!sourceIds.has(sourceId)) errors.push(`Fast character bundle is missing identity-sensitive entry: ${sourceId}`);
  }
  const jeanneFusion = (liveCharacterBundle.entries || []).find(row => String(row?.internal?.sourceId || row?.sourceId || '') === 'JeanneFusion02');
  if (!jeanneFusion?.resolved?.activeSkills?.SingleAttackAJeanneFusion?.localization?.description) {
    errors.push('Fast character bundle lost JeanneFusion active-skill localization');
  }
  if (!jeanneFusion?.resolved?.passives?.GuardianAngelPassiveAJeanneFusion?.localization?.description) {
    errors.push('Fast character bundle lost JeanneFusion passive localization');
  }
}

const workflows = ['.github/workflows/entry-safe-rebuild.yml', '.github/workflows/master-control.yml'];
const activeWorkflowFiles = fs.readdirSync(path.join(root, '.github', 'workflows')).filter(file => /\.ya?ml$/i.test(file));
if (activeWorkflowFiles.length !== workflows.length) {
  errors.push(`Expected exactly ${workflows.length} active workflows, found ${activeWorkflowFiles.length}: ${activeWorkflowFiles.join(', ')}`);
}
for (const workflow of workflows) {
  if (!exists(workflow)) {
    errors.push(`Missing active workflow: ${workflow}`);
    continue;
  }
  const yaml = read(workflow);
  for (const expected of ['actions/checkout@v6', 'actions/setup-python@v6', 'actions/upload-artifact@v7']) {
    if (!yaml.includes(expected)) errors.push(`${workflow} is missing ${expected}`);
  }
  for (const page of pages) {
    if (!yaml.includes(page)) errors.push(`${workflow} does not stage generated cache reference: ${page}`);
  }
  if (/actions\/(?:checkout|setup-python|upload-artifact)@v[1-5]\b/.test(yaml)) {
    errors.push(`${workflow} still contains a pre-Node-24 action major`);
  }
}

if (strict) {
  const retiredRootFiles = [
    'catalog.js',
    'catalog-lite.js',
    'catalog-sort.js',
    'test-catalog-v2-final-awaken-controller.js',
    'test-catalog-v2-sidebar-detail-buttons.js',
    'runtime-data-bridge.js',
    'supercharge.js',
  ];
  for (const file of retiredRootFiles) {
    if (exists(file)) errors.push(`Retired runtime file still at root: ${file}`);
  }
}

if (errors.length) {
  console.error(`Runtime validation failed (${errors.length}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Runtime validation passed: ${pages.length} pages, ${workflows.length} workflows, 4 data categories${strict ? ', strict cleanup' : ''}.`);
