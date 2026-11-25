import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../catalog-v2-lite.js',import.meta.url),'utf8');
const context=vm.createContext({document:{addEventListener(){}}});
context.window=context;
vm.runInContext(source,context);
const {filterRows}=context.EvertaleCatalogV2;
const rows=[
 {id:'fire',kind:'characters',element:'Fire',rarity:'SSR',order:10,name:'Fire'},
 {id:'storm',kind:'characters',element:'Thunder',rarity:'SR',order:20,name:'Storm'},
 {id:'water',kind:'characters',element:'Water',rarity:'SSR',order:30,name:'Water'},
 {id:'new',kind:'weapons',rarity:'SSR',order:90,name:'New'},
 {id:'old',kind:'weapons',rarity:'R',order:10,name:'Old'},
 {id:'test',kind:'weapons',rarity:'SSR',order:100,name:'Test Sword',testLike:true}
];
const ids=options=>Array.from(filterRows(rows,options),x=>x.id);
test('elements combine inclusively, rarity combines with elements, empty selection resets',()=>{
 assert.deepEqual(ids({type:'characters',elements:new Set(['fire','storm'])}),['storm','fire']);
 assert.deepEqual(ids({type:'characters',elements:new Set(['fire','storm']),rarities:new Set(['SSR'])}),['fire']);
 assert.deepEqual(ids({type:'characters'}),['water','storm','fire']);
 assert.deepEqual(ids({type:'characters',q:'storm'}),['storm']);
});
test('weapon sorting uses newest handles, keeps test weapons last, and ignores element selection',()=>{
 assert.deepEqual(ids({type:'weapons',elements:new Set(['fire'])}),['new','old','test']);
 assert.deepEqual(ids({type:'weapons',sort:'oldest'}),['old','new','test']);
 assert.deepEqual(ids({type:'weapons',rarities:new Set(['SSR'])}),['new','test']);
});
