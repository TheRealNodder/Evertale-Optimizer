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
const themeEffectsSource = read('theme-effects.css');
const watermarkSource = read('element-watermark.css');
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
if (!themeSource.includes('data-theme-material') || !themeEffectsSource.includes('html[data-theme-material="gem"]')) {
  errors.push('Gem themes must retain their centralized material scoping');
}
if (!themeSource.includes('--legendary-body') || !themeSource.includes('--legendary-energy') || !themeSource.includes('--legendary-detail')) {
  errors.push('Legendary themes must retain their fixed body, energy, and detail palette');
}
if (themeSource.includes('installMaterialStyles') || themeSource.includes('evertale-material-theme-style')) {
  errors.push('Theme material CSS must have one external authority instead of runtime style injection');
}
for (const effect of [
  'rebirth', 'abyss-wind', 'aurora-water', 'magma', 'ocean-pressure', 'delta-stream',
  'time-rings', 'space-rift', 'distortion', 'creation', 'white-flame', 'thunder-generator',
  'freeze-shock', 'ice-burn', 'life-antlers', 'cocoon-drain', 'cell-grid', 'solar-corona',
  'lunar-phase', 'prism-rays', 'blade-trail', 'shield-wave', 'dynamax-core',
  'ancient-pulse', 'future-grid', 'stellar-crystal',
]) {
  if (!themeSource.includes(`effect:'${effect}'`)) errors.push(`Legendary aura metadata is missing: ${effect}`);
  if (!themeEffectsSource.includes(`data-theme-effect="${effect}"`)) errors.push(`Legendary aura CSS is missing: ${effect}`);
}
for (const finish of ['gloss-crimson', 'gloss-cobalt', 'metallic-rose', 'bronze', 'black-white', 'galaxy', 'warm-plastic']) {
  if (!themeSource.includes(`finish:'${finish}'`)) errors.push(`Console material metadata is missing: ${finish}`);
  if (!themeEffectsSource.includes(`data-theme-finish="${finish}"`)) errors.push(`Console material CSS is missing: ${finish}`);
}
for (const attribute of ['data-theme-family', 'data-theme-effect', 'data-theme-finish', 'data-theme-hardware']) {
  if (!themeSource.includes(attribute)) errors.push(`Theme runtime does not expose ${attribute}`);
}
if (!themeSource.includes('ensureEffectLayer') || !themeSource.includes('siteThemeFx__field') || !themeSource.includes('siteThemeFx__particles')) {
  errors.push('Theme runtime must install exactly one dedicated, pointer-inert effect layer');
}
if (/body::(?:before|after)/.test(themeEffectsSource)) {
  errors.push('Dynamic theme effects must not replace the shared body pseudo-element decoration');
}
if (!themeEffectsSource.includes('@media (prefers-reduced-motion:reduce)')) {
  errors.push('Dynamic theme effects must retain a reduced-motion fallback');
}
if (!themeEffectsSource.includes('z-index:-1') || !themeEffectsSource.includes('isolation:isolate') || /body\s*>\s*main[\s\S]{0,120}z-index/i.test(themeEffectsSource)) {
  errors.push('Theme effect stacking must stay behind content without trapping page overlays in a main stacking context');
}
if (!themeEffectsSource.includes('display:none') || !themeEffectsSource.includes('will-change:transform,opacity')) {
  errors.push('Inactive theme compositor layers must stay hidden and unpromoted');
}
if (/hue-rotate|animation:[^;]*(?:flash|shake)/i.test(themeEffectsSource)) {
  errors.push('Dynamic themes contain an unsafe or visually unstable animation');
}
if (watermarkSource.includes('data-theme-key=') || watermarkSource.includes('data-theme-material=')) {
  errors.push('Element watermark CSS must not own page-level theme material rules');
}
const siteMenuSource = read('site-menu.js');
for (const group of ['Calendar', 'Pokémon · Versions', 'Pokémon · Hoenn Shiny', 'Pokémon · Paldea', 'Gems & Minerals', 'DS & 3DS', 'Signature']) {
  if (!themeSource.includes(`'${group}'`)) errors.push(`Theme menu group is missing: ${group}`);
}
if (!siteMenuSource.includes('siteThemeSwatchDivider') || !siteMenuSource.includes('groupOrder')) errors.push('Theme swatch category dividers are missing');
if (!siteMenuSource.includes("existing.forEach(button=>") || !siteMenuSource.includes("aria-pressed")) errors.push('Theme swatches do not preserve focused DOM nodes while updating active state');

for (const page of pages) {
  const html = read(page);
  const refs = [...html.matchAll(/(?:src|href)="\.\/([^"?#]+)/g)].map(match => match[1]);
  for (const ref of refs) {
    if (!exists(ref)) errors.push(`${page} references missing file: ${ref}`);
  }
  if (!html.includes('theme-effects.css?v=2')) {
    errors.push(`${page} does not load the current dynamic theme effects layer`);
  }
  if (!html.includes('site-menu.js?v=16')) {
    errors.push(`${page} does not load the focus-preserving theme menu revision`);
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
const desktopCatalogSource = read('test-catalog-v2-desktop-structure.js');
const mobileCatalogDockSource = read('catalog-mobile-command-dock.js');
const mobileCatalogDockStyles = read('catalog-mobile-command-dock.css');
if (!catalogHtml.includes('test-catalog-v2-desktop-structure.js?v=13')) {
  errors.push('index.html does not use the current desktop catalog state-sync cache token');
}
if (!catalogHtml.includes('catalog-mobile-command-dock.css?v=1') || !catalogHtml.includes('catalog-mobile-command-dock.js?v=1')) {
  errors.push('index.html does not load the mobile catalog command dock authority');
}
for (const label of ['Return to Top', 'All', 'Characters', 'Weapons', 'Bosses', 'Accessories']) {
  if (!mobileCatalogDockSource.includes(label)) errors.push(`Mobile catalog command dock is missing control: ${label}`);
}
if (!mobileCatalogDockSource.includes("searchHost.appendChild(sourceSearch)")) {
  errors.push('Mobile catalog dock does not reuse the canonical search control');
}
if (!mobileCatalogDockSource.includes("sourceType.dispatchEvent(new Event('change'")) {
  errors.push('Mobile catalog entry menu does not synchronize with the canonical type control');
}
if (!mobileCatalogDockStyles.includes('position:fixed') || !mobileCatalogDockStyles.includes('.catalog-mobile-landscape') || !mobileCatalogDockStyles.includes('grid-template-columns:clamp(165px,30vw,260px) minmax(0,1fr)')) {
  errors.push('Mobile catalog dock or horizontal landscape card layout is incomplete');
}
if (!read('catalog-v2-lite.js').includes("if(state.type==='all')hydrateAll(true)")) {
  errors.push('Catalog All filter does not hydrate every entry category');
}
if (!read('catalog-v2-lite.js').includes('openDetail,getSelectedId') || !read('test-catalog-v2-mobile-detail-badge-tabs.js').includes('EvertaleCatalogV2.openDetail(card)')) {
  errors.push('Mobile detail buttons do not use the populated catalog detail authority');
}
if (!desktopCatalogSource.includes('awakenIndexFromCard(card)')) {
  errors.push('Desktop catalog selection does not derive the awakened index from the selected card');
}
const awakenedSelectionSyncs = desktopCatalogSource.match(/selectedAwakenIndex\s*=\s*awakenIndexFromCard\(card\)/g) || [];
if (awakenedSelectionSyncs.length < 2) {
  errors.push('Desktop catalog card handlers do not both preserve the card awakened index');
}
if (!desktopCatalogSource.includes('setTimeout(()=>{if(card!==currentSelectedCard())return;selectedAwakenIndex=awakenIndexFromCard(card)')) {
  errors.push('Desktop catalog delayed state sync can overwrite a newer rapid card selection');
}
if (/v2:card-selected[\s\S]{0,300}selectedAwakenIndex\s*=\s*0/.test(desktopCatalogSource)) {
  errors.push('Desktop catalog selection still resets awakened state to the default index');
}
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

const optimizerHtml = read('optimizer.html');
const optimizerSource = read('optimizer.js');
const researchSource = read('optimizer-strategy-research.js');
const v6LoaderSource = read('optimizer-v6/optimizer-v6-loader.js');
const v6PolicySource = read('optimizer-v6/optimizer-v6-policy.js');
for (const control of ['searchIntelligenceSelect', 'metaWeightSelect', 'useAdvisoryMetaPrior', 'researchStrategies']) {
  if (!optimizerHtml.includes(`id="${control}"`)) errors.push(`Optimizer control is missing: ${control}`);
}
if (!optimizerHtml.includes('optimizer-v6-loader.js?v=9') || !v6LoaderSource.includes('optimizer-v6-local-meta.js')) {
  errors.push('Optimizer V6 local-meta module is not in the current public loader chain');
}
for (const level of ['standard', 'deep', 'ultra']) {
  if (!v6PolicySource.includes(`${level}:`)) errors.push(`Optimizer search intelligence profile is missing: ${level}`);
}
if (!optimizerSource.includes('options.advisoryMeta') || !optimizerSource.includes('dataset.optimizerSearching')) {
  errors.push('Optimizer does not pass advisory meta or expose real search activity to the theme layer');
}
if (!optimizerSource.includes('recordAdvisoryComparison') || !optimizerSource.includes('optimizerAdvisoryChangedSlots')) {
  errors.push('Optimizer does not expose pick changes between matched advisory-on and advisory-off runs');
}
if (!v6PolicySource.includes("defaultLevel:'deep'") || !read('optimizer-v6/optimizer-v6-engine.js').includes("probeLevel=useProbe?'probe'")) {
  errors.push('Optimizer must retain the balanced default and two-pass complete-team tournament');
}
for (const contract of ['evertale_optimizer_local_meta_snapshot_v1', 'generated-release-order', 'dataVersion', 'scoresByIdentity']) {
  if (!researchSource.includes(contract)) errors.push(`Local meta cache contract is missing: ${contract}`);
}
if (!researchSource.includes('expiresAt')) errors.push('Public advisory cache does not enforce source expiry');
if (/document\.cookie/i.test(researchSource)) {
  errors.push('Local optimizer meta should use localStorage, not request-transmitted cookies');
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

const dataWorkflows = ['.github/workflows/entry-safe-rebuild.yml', '.github/workflows/master-control.yml'];
const nodeMaintenanceWorkflow = '.github/workflows/node-maintenance.yml';
const workflows = [...dataWorkflows, nodeMaintenanceWorkflow];
const activeWorkflowFiles = fs.readdirSync(path.join(root, '.github', 'workflows')).filter(file => /\.ya?ml$/i.test(file));
if (activeWorkflowFiles.length !== workflows.length) {
  errors.push(`Expected exactly ${workflows.length} active workflows, found ${activeWorkflowFiles.length}: ${activeWorkflowFiles.join(', ')}`);
}
for (const workflow of dataWorkflows) {
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

if (!exists(nodeMaintenanceWorkflow)) {
  errors.push(`Missing active workflow: ${nodeMaintenanceWorkflow}`);
} else {
  const yaml = read(nodeMaintenanceWorkflow);
  for (const expected of [
    'actions/checkout@v6',
    'actions/setup-node@v6',
    'node-version-file: .node-version',
    'check-latest: true',
    'npm ci',
    'npm test',
  ]) {
    if (!yaml.includes(expected)) errors.push(`${nodeMaintenanceWorkflow} is missing ${expected}`);
  }
  if (/actions\/(?:checkout|setup-node)@v[1-5]\b/.test(yaml)) {
    errors.push(`${nodeMaintenanceWorkflow} still contains a pre-Node-24 action major`);
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
