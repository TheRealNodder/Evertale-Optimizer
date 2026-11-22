import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const source = name => readFileSync(new URL(name, root), 'utf8');
const foundation = ['characters', 'featureEvidence', 'skillProfiles', 'leaderProfiles', 'optimizerKnowledge', 'tags'];
const equipment = ['weapons', 'accessories'];
const allChunks = [...foundation, ...equipment, 'bosses', 'abilityGraph', 'characterEntries'];
const unit = { id: 'owned-unit', name: 'Owned Unit', element: 'fire', weaponType: 'Sword', tags: ['attack'] };
const weapon = { id: 'sword', name: 'Sword', weaponType: 'Sword', stats: { atk: 10 } };
const accessory = { id: 'armor', name: 'Armor', stats: { hp: 20 } };
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

function harness({ page = 'https://example.test/optimizer.html', runtimeBase = './apkfiles/entries/runtime', omit = [], failures = {}, gates = {}, payloads = {} } = {}) {
  const requests = [];
  const listeners = new Map();
  const status = { textContent: '' };
  const storage = new Map();
  const controls = new Map([['optimizerRuntimeStatus', status]]);
  const manifest = { chunks: Object.fromEntries(allChunks.filter(key => !omit.includes(key)).map(key => [key, { file: `${key}.json` }])) };
  const context = vm.createContext({
    URL, structuredClone, setTimeout, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    EVERTALE_LIVE_CONFIG: { runtimeBase, dataVersion: 'fixture version' },
    document: {
      body: { dataset: {} },
      getElementById: id => controls.get(id) || null,
      querySelectorAll: () => [],
      addEventListener(type, listener) {
        const rows = listeners.get(type) || [];
        rows.push(listener);
        listeners.set(type, rows);
      },
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    addEventListener() {},
    fetch: async rawUrl => {
      const url = new URL(rawUrl, page);
      const file = url.pathname.split('/').at(-1);
      const key = file === 'optimizer_runtime_manifest.json' ? 'manifest' : file.replace(/\.json$/, '');
      requests.push({ key, url: url.href });
      if (gates[key]) await gates[key].promise;
      if (failures[key] > 0) {
        failures[key]--;
        return { ok: false, status: 503 };
      }
      const data = key === 'weapons' ? { sword: weapon } : key === 'accessories' ? { armor: accessory } : {};
      return { ok: true, json: async () => key === 'manifest' ? manifest : Object.hasOwn(payloads, key) ? payloads[key] : { data } };
    },
  });
  context.window = context;
  const run = expression => vm.runInContext(expression, context);
  const load = name => vm.runInContext(source(name), context, { filename: fileURLToPath(new URL(name, root)) });
  load('optimizerRuntimeLoader.js');
  return { context, requests, status, storage, controls, listeners, run, load };
}

const requested = h => h.requests.map(row => row.key);
const json = value => JSON.parse(JSON.stringify(value));
async function hydrate(h) {
  await h.run('loadOptimizerRuntimeIfAvailable()');
  await h.run('equipmentLoadPromise');
}

test('foundation remains independent of equipment and heavy chunks', async () => {
  const h = harness();
  const runtime = await h.context.loadOptimizerRuntime({ profile: 'optimizer-foundation' });
  assert.equal(runtime.contracts.optimizerFoundationReady, true);
  assert.equal(runtime.contracts.optimizerEquipmentReady, false);
  assert.deepEqual(json(runtime.contracts.missingEquipmentChunks), equipment);
  assert.deepEqual(requested(h).sort(), ['manifest', ...foundation].sort());
});

test('already loaded foundation still fetches exactly the two equipment chunks', async () => {
  const h = harness();
  await h.context.loadOptimizerRuntime({ profile: 'optimizer-foundation' });
  h.load('optimizer.js');
  await hydrate(h);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, true);
  assert.equal(h.run('state.equipmentRuntime.weapons.length'), 1);
  assert.equal(h.run('state.equipmentRuntime.accessories.length'), 1);
  assert.deepEqual(requested(h).sort(), ['manifest', ...foundation, ...equipment].sort());
  assert.match(h.status.textContent, /weapons 1.*accessories 1/);
  const before = h.requests.length;
  await hydrate(h);
  assert.equal(h.requests.length, before);
});

test('concurrent overlapping profiles share each chunk request', async () => {
  const gate = deferred();
  const h = harness({ gates: { weapons: gate } });
  const loads = [
    h.context.loadOptimizerRuntime({ profile: 'optimizer-foundation' }),
    h.context.loadOptimizerRuntime({ profile: 'optimizer-equipment' }),
    h.context.loadOptimizerRuntime({ profile: 'optimizer-equipment' }),
    h.context.loadOptimizerRuntime({ profile: 'standard' }),
  ];
  await new Promise(resolve => setImmediate(resolve));
  gate.resolve();
  await Promise.all(loads);
  for (const key of ['manifest', ...foundation, ...equipment, 'bosses']) {
    assert.equal(requested(h).filter(value => value === key).length, 1, key);
  }
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerFoundationReady, true);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, true);
  assert.ok(!requested(h).includes('abilityGraph'));
  assert.ok(!requested(h).includes('characterEntries'));
});

test('DOMContentLoaded initializes teams and controls even while an equipment request never settles', async () => {
  const gate = deferred();
  const h = harness({ gates: { weapons: gate } });
  let characterLoads = 0;
  const events = [];
  const buildButton = { setAttribute() {}, addEventListener: type => events.push(type) };
  h.controls.set('buildBest', buildButton);
  const mainSlots = { innerHTML: '' };
  h.controls.set('storyMain', mainSlots);
  h.controls.set('storyBack', { innerHTML: '' });
  h.storage.set('evertale_owned_units_v1', JSON.stringify([unit.id]));
  h.storage.set('evertale_team_layout_v1', JSON.stringify({ storyMain: [unit.id, '', '', '', ''] }));
  h.storage.set('evertale_optimizer_slotLocks_v1', JSON.stringify({ storyMain: [true, false, false, false, false], storyBack: [false, false, false], platoons: Array.from({ length: 20 }, () => Array(5).fill(false)) }));
  h.context.EvertaleData = { loadCharactersMerged: async () => { characterLoads++; return [unit]; } };
  h.load('optimizerRuntimeBootstrap.js');
  h.load('optimizer.js');
  await h.context.__optimizerRuntimeReadyPromise;
  for (const listener of h.listeners.get('DOMContentLoaded') || []) listener({ type: 'DOMContentLoaded' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(characterLoads, 1);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerFoundationReady, true);
  assert.equal(h.run('state.ownedUnits.length'), 1);
  assert.equal(h.run('state.layout.storyMain.length'), 5);
  assert.equal(h.run('state.locks.storyMain.length'), 5);
  assert.equal(buildButton.disabled, false);
  assert.deepEqual(events, ['click']);
  assert.match(h.status.textContent, /Equipment: loading/);
  assert.equal(h.run('state.equipmentRuntime.weapons.length'), 0);
  assert.match(mainSlots.innerHTML, /Owned Unit/);
  assert.doesNotMatch(mainSlots.innerHTML, /equipment-weapon/);
  const coreState = h.run('JSON.stringify({owned:[...state.ownedIds],layout:state.layout,locks:state.locks})');
  // Release only after proving core initialization completed without equipment.
  gate.resolve();
  await h.run('equipmentLoadPromise');
  assert.equal(characterLoads, 1);
  assert.equal(h.run('state.all.length'), 1);
  assert.equal(h.run('state.equipmentRuntime.weapons.length'), 1);
  assert.equal(h.run('state.equipmentRuntime.accessories.length'), 1);
  assert.match(mainSlots.innerHTML, /equipment-weapon/);
  assert.match(mainSlots.innerHTML, /equipment-accessory/);
  assert.match(mainSlots.innerHTML, /class="slotLock"[^>]*checked/);
  assert.equal(h.run('JSON.stringify({owned:[...state.ownedIds],layout:state.layout,locks:state.locks})'), coreState);
});

test('partial equipment failure stays visible and retries only the failed request', async () => {
  const h = harness({ failures: { accessories: 1 } });
  h.load('optimizer.js');
  await hydrate(h);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerFoundationReady, true);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, false);
  assert.deepEqual(json(h.context.OptimizerRuntime.contracts.missingEquipmentChunks), ['accessories']);
  assert.match(h.status.textContent, /Equipment unavailable: accessories/);
  assert.equal(h.run('state.equipmentRuntime.weapons.length'), 1);
  assert.equal(h.run('state.equipmentRuntime.accessories.length'), 0);
  const before = h.requests.length;
  await hydrate(h);
  assert.deepEqual(requested(h).slice(before), ['accessories']);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, true);
  assert.equal(h.context.OptimizerRuntime.errors.accessories, undefined);
  assert.doesNotMatch(h.status.textContent, /unavailable/);
});

test('a failed manifest does not permanently poison a retry', async () => {
  const h = harness({ failures: { manifest: 1 } });
  h.load('optimizer.js');
  await hydrate(h);
  assert.match(h.status.textContent, /Equipment unavailable/);
  assert.match(h.status.textContent, /Character intelligence incomplete/);
  await hydrate(h);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, true);
  assert.equal(requested(h).filter(key => key === 'manifest').length, 2);
  assert.doesNotMatch(h.status.textContent, /unavailable|incomplete/);
});

test('a missing equipment manifest entry is not marked ready', async () => {
  const h = harness({ omit: ['accessories'] });
  await h.context.loadOptimizerRuntime({ profile: 'optimizer-equipment' });
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, false);
  assert.deepEqual(json(h.context.OptimizerRuntime.contracts.missingEquipmentChunks), ['accessories']);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerFoundationReady, false);
  assert.deepEqual(requested(h).sort(), ['manifest', 'weapons'].sort());
});

test('null equipment payload is a retryable failure, while empty equipment is valid', async () => {
  const payloads = { weapons: { data: null }, accessories: { data: {} } };
  const h = harness({ payloads });
  await h.context.loadOptimizerRuntime({ profile: 'optimizer-equipment' });
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, false);
  assert.deepEqual(json(h.context.OptimizerRuntime.contracts.missingEquipmentChunks), ['weapons']);
  payloads.weapons = { data: [] };
  await h.context.loadOptimizerRuntime({ profile: 'optimizer-equipment' });
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, true);
});

test('equipment readiness cannot conceal a failed foundation chunk', async () => {
  const h = harness({ failures: { skillProfiles: 1 } });
  h.load('optimizer.js');
  await hydrate(h);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerEquipmentReady, true);
  assert.equal(h.context.OptimizerRuntime.contracts.optimizerFoundationReady, false);
  assert.deepEqual(json(h.context.OptimizerRuntime.contracts.missingFoundationChunks), ['skillProfiles']);
  assert.match(h.status.textContent, /Character intelligence incomplete/);
});

test('hydration invalidates empty recommendation cache and preserves layout, locks and owned IDs', async () => {
  const h = harness();
  h.load('optimizer.js');
  h.context.fixtureUnit = unit;
  h.run(`state.ownedIds = new Set(['owned-unit']); state.layout = loadLayout(); state.layout.storyMain[0] = 'owned-unit'; state.locks = defaultLocks(); state.locks.storyMain[0] = true`);
  const before = h.run('JSON.stringify({owned:[...state.ownedIds],layout:state.layout,locks:state.locks})');
  assert.equal(h.run('recommendBestEquipment(fixtureUnit, "weapon")'), null);
  assert.equal(h.run('recommendBestEquipment(fixtureUnit, "accessory")'), null);
  await hydrate(h);
  assert.equal(h.run('recommendBestEquipment(fixtureUnit, "weapon").item.id'), weapon.id);
  assert.equal(h.run('recommendBestEquipment(fixtureUnit, "accessory").item.id'), accessory.id);
  const card = h.run('slotCardHTML("storyMain", 0, fixtureUnit.id, [fixtureUnit], true, state.ownedIds)');
  assert.match(card, /equipment-weapon/);
  assert.match(card, /equipment-accessory/);
  assert.match(card, /data-equipment-repeatable="true"/);
  assert.match(card, /class="slotLock"[^>]*checked/);
  assert.equal(h.run('JSON.stringify({owned:[...state.ownedIds],layout:state.layout,locks:state.locks})'), before);
});

for (const page of ['https://example.test/optimizer.html', 'https://example.test/Evertale-Optimizer/optimizer.html']) {
  test(`equipment URLs respect the page subpath: ${new URL(page).pathname}`, async () => {
    const h = harness({ page });
    await h.context.loadOptimizerRuntime({ profile: 'optimizer-equipment' });
    for (const request of h.requests) {
      const url = new URL(request.url);
      assert.equal(url.pathname, new URL(`./apkfiles/entries/runtime/${request.key === 'manifest' ? 'optimizer_runtime_manifest' : request.key}.json`, page).pathname);
      assert.equal(url.searchParams.get('v'), 'fixture version');
    }
  });
}

test('an explicit runtime base is respected and full loading remains available', async () => {
  const h = harness({ runtimeBase: '/custom/runtime' });
  await h.context.loadOptimizerRuntime({ profile: 'full' });
  assert.equal(h.context.OptimizerRuntime.loadedHeavy, true);
  assert.deepEqual(requested(h).sort(), ['manifest', ...allChunks].sort());
  assert.ok(h.requests.every(row => new URL(row.url).pathname.startsWith('/custom/runtime/')));
});

test('missing loader leaves unit loading available and clearly labels equipment failure', async () => {
  const h = harness();
  h.run('window.loadOptimizerRuntime = undefined');
  h.context.EvertaleData = { loadCharactersMerged: async () => [unit] };
  h.load('optimizer.js');
  await h.run('init()');
  assert.equal(h.run('state.all.length'), 1);
  assert.match(h.status.textContent, /Equipment unavailable/);
});
