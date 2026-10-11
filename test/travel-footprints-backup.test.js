const test = require('node:test');
const assert = require('node:assert/strict');
const Save = require('../src/save-data.js');
const Engine = require('../src/slice-engine.js');

function storage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),
    removeItem:k=>data.delete(k),data};
}
const key = 'crownless-travel-footprints-v1-walk';
const journal = {version:1,places:[{id:'f1:0:0',name:'森',label:'旅先',seal:'印',icon:'🌲',
  biome:'wood',firstDate:'2026-10-10',visits:[{date:'2026-10-10',note:'思い出'}]}]};

test('private travel book survives backup, restore and reset', () => {
  const source=storage({[key]:JSON.stringify(journal)});
  const backup=Save.exportBackup(source);
  const target=storage();
  Save.importBackup(target,backup,Engine.parse);
  assert.deepEqual(JSON.parse(target.getItem(key)),journal);
  Save.resetJourney(target);
  assert.equal(target.getItem(key),null);
});

test('malformed footprint backup cannot overwrite existing journal', () => {
  const target=storage({[key]:JSON.stringify(journal)});
  const bad=JSON.stringify({kind:'crownless-save',version:1,saves:{},
    footprints:{[key]:{version:1,places:[{id:'bad'}]}}});
  assert.throws(()=>Save.importBackup(target,bad,Engine.parse));
  assert.deepEqual(JSON.parse(target.getItem(key)),journal);
});
