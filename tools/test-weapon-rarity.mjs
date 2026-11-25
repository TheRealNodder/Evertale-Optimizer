import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../data-loader.js', import.meta.url), 'utf8');
test('weapon family tier ignores stale rarity and preserves current stars and stats', async () => {
  const cases = [[0,0,'N'], [3,3,'R'], [3,4,'R'], [4,4,'R'], [4,5,'SR'], [5,5,'SR'], [4,6,'SSR'], [5,6,'SSR'], [6,6,'SSR']];
  const entries = cases.map(([stars,evolvedStars],i) => ({
    id: 'weapon-'+i, name: 'Weapon '+i, rarity: 'SR', stars, evolvedStars,
    raw: { name: 'Weapon'+i, stars, evolvedStars }, stats: { atk: 123, hp: 456 }
  }));
  entries.push({ id:'explicit', name:'Explicit', rarity:'SR', raw:{rarity:'SR', stars:4,evolvedStars:6} });
  entries.push({ id:'missing', name:'Missing', rarity:'SR', raw:{stars:4} });
  const accessory = {id:'accessory',name:'Accessory',rarity:'SR',raw:{stars:4,evolvedStars:6}};
  const context = vm.createContext({console, fetch: async url => ({
    ok: true, json: async () => ({entries: String(url).includes('accessories.bundle') ? [accessory] : entries})
  })});
  context.window = context;
  vm.runInContext(source, context);
  const weapons = await context.EvertaleData.loadEntryCategory('weapons');
  assert.equal(weapons.length, entries.length);
  cases.forEach(([stars, maximum, rarity],i) => {
    assert.equal(weapons[i].rarity,rarity);
    assert.equal(weapons[i].stars,stars);
    assert.equal(weapons[i].evolvedStars,maximum);
    assert.equal(weapons[i].atk,123);
    assert.equal(weapons[i].hp,456);
  });
  assert.equal(weapons.at(-2).rarity,'SR');
  assert.equal(weapons.at(-1).rarity,'SR');
  const accessories = await context.EvertaleData.loadEntryCategory('accessories');
  assert.equal(accessories[0].rarity,'SR');
});
