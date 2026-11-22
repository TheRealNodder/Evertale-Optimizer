import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const accessories = Object.values(JSON.parse(read('apkfiles/entries/runtime/optimizer_runtime_accessories.json')).data);
const context = vm.createContext({ console, document: { addEventListener() {} } });
context.window = context;
for (const file of ['optimizer.js', 'runtime-stat-engine.js']) vm.runInContext(read(file), context, { filename: file });
const json = value => JSON.parse(JSON.stringify(value));

test('every runtime accessory exposes exact raw flat stats without changing roster math', () => {
  assert.equal(accessories.length, 111);
  for (const entry of accessories) {
    const { flatAttack: atk, flatMaxHp: hp, flatSpeed: spd } = entry.raw;
    assert.deepEqual(entry.stats, { atk, hp, spd, cost: entry.raw.cost ?? null }, entry.sourceId);
    assert.deepEqual(json(context.EvertaleRuntimeStatEngine.calculateAccessoryStats(entry)), { atk, hp, spd, power: 30 * atk + 6 * hp + 180 * spd }, entry.sourceId);
  }
});

test('normalized accessory stats activate only the existing positive-stat role bonuses', () => {
  const armor = accessories.find(entry => entry.sourceId === 'Armor01');
  assert.ok(armor);
  for (const [role, stats] of [['damage', { atk: 20 }], ['tank', { hp: 120 }], ['tempo', { spd: 4 }], ['unrelated', {}]]) {
    const unit = { id: 'probe', name: role };
    const masked = { ...armor, stats: { atk: null, hp: null, spd: null, cost: null } };
    const before = context.scoreEquipmentForUnit(masked, unit, 'accessory');
    const after = context.scoreEquipmentForUnit(armor, unit, 'accessory');
    assert.equal(after - before, Object.keys(stats).length ? 4 : 0, role);
    assert.deepEqual(json(context.EvertaleRuntimeStatEngine.calculateAccessoryStats(masked)), json(context.EvertaleRuntimeStatEngine.calculateAccessoryStats(armor)), role);
  }
});

test('flat-stat normalization is usable without the raw fallback and does not double count it', () => {
  const armor = accessories.find(entry => entry.sourceId === 'Armor01');
  const engine = context.EvertaleRuntimeStatEngine;
  assert.deepEqual(json(engine.calculateAccessoryStats(armor)), { atk: 20, hp: 120, spd: 4, power: 2040 });
  assert.deepEqual(json(engine.calculateAccessoryStats({ stats: armor.stats })), { atk: 20, hp: 120, spd: 4, power: 2040 });
});
