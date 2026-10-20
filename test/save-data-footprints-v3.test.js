const test = require('node:test');
const assert = require('node:assert/strict');
const Save = require('../src/save-data.js');
const Engine = require('../src/slice-engine.js');
const Footprints = require('../src/travel-footprints.js');

const key = 'crownless-travel-footprints-v1-walk';
const demoKey = 'crownless-travel-footprints-v1-demo';
const saveKey = 'crownless-expedition-v1-walk';
const tower = {latitude:35.658656,longitude:139.745364,accuracy:8,speed:0};
const skytree = {latitude:35.7101,longitude:139.8107,accuracy:8,speed:0};
const found = (fix, date='2026-10-20') => Footprints.record(Footprints.initial(),fix,date).journal;
function storage(seed={}, failOnceKey=null) {
  const data = new Map(Object.entries(seed));
  let didFail = false;
  return {
    data,
    getItem: k => data.has(k) ? data.get(k) : null,
    setItem: (k,v) => {
      if (k===failOnceKey && !didFail) { didFail=true; throw new Error('quota exceeded'); }
      data.set(k,String(v));
    },
    removeItem: k => data.delete(k)
  };
}

test('current v3 landmark journal survives export, restore, reset without GPS', () => {
  const journal=found(tower);
  const source=storage({[key]:JSON.stringify(journal),[demoKey]:JSON.stringify(found(skytree))});
  const backup=Save.exportBackup(source);
  assert.doesNotMatch(backup,/latitude|longitude|accuracy|speed/);
  assert.deepEqual(Object.keys(JSON.parse(backup).footprints).sort(),[demoKey,key].sort());
  const target=storage();
  Save.importBackup(target,backup,Engine.parse);
  assert.deepEqual(JSON.parse(target.getItem(key)),journal);
  assert.deepEqual(JSON.parse(target.getItem(demoKey)),found(skytree));
  Save.resetJourney(target);
  assert.equal(target.getItem(key),null);
  assert.equal(target.getItem(demoKey),null);
});

test('legacy save-only backups remain importable without deleting an existing landmark journal', () => {
  const game=Engine.initial(); game.mode='walk'; game.scrap=5;
  const old=JSON.stringify({kind:'crownless-save',version:1,mode:'walk',
    saves:{[saveKey]:game}});
  const existing=JSON.stringify(found(tower));
  const target=storage({[key]:existing});
  Save.importBackup(target,old,Engine.parse);
  assert.equal(target.getItem(key),existing);
  assert.equal(Engine.parse(target.getItem(saveKey)).scrap,5);
});

test('reject legacy diary shapes and unknown POI IDs before any writes', () => {
  const original=JSON.stringify(found(tower));
  const target=storage({[key]:original});
  const bads=[
    {version:1,places:[]},
    {version:3,places:[{id:'unknown',firstDate:'2026-10-20',visits:['2026-10-20']}]},
    {...found(tower),latitude:35.658656},
    {...found(tower),places:[{...found(tower).places[0],note:'private'}]},
    {...found(tower),places:[{...found(tower).places[0],visits:['2026-10-20','2026-10-20']}]}
  ];
  for (const journal of bads) {
    const backup=JSON.stringify({kind:'crownless-save',version:1,saves:{},footprints:{[key]:journal}});
    assert.throws(()=>Save.importBackup(target,backup,Engine.parse),/invalid footprints/);
    assert.equal(target.getItem(key),original);
  }
});

test('reject corrupt stored journal rather than quietly exporting an empty one', () => {
  assert.throws(()=>Save.exportBackup(storage({[key]:'{"version":1,"places":[]}' })),/invalid footprints/);
  assert.throws(()=>Save.exportBackup(storage({[key]:'{bad-json' })),SyntaxError);
});

test('rollback restored save if writing landmark record fails', () => {
  const before=Engine.initial();before.mode='walk';before.scrap=2;
  const after=Engine.initial();after.mode='walk';after.scrap=20;
  const originalSave=Engine.serialize(before), originalFootprints=JSON.stringify(found(tower));
  const target=storage({[saveKey]:originalSave,[key]:originalFootprints},key);
  const backup=JSON.stringify({kind:'crownless-save',version:1,mode:'walk',
    saves:{[saveKey]:after},footprints:{[key]:found(skytree)}});
  assert.throws(()=>Save.importBackup(target,backup,Engine.parse),/quota exceeded/);
  assert.equal(target.getItem(saveKey),originalSave);
  assert.equal(target.getItem(key),originalFootprints);
});

test('old root save format exports no walk anchor and never imports unknown footprint keys', () => {
  const before=Engine.initial();before.mode='walk';
  const anchor='crownless-expedition-v1-walk-anchor';
  const backup=Save.exportBackup(storage({[saveKey]:Engine.serialize(before),[anchor]:'{"latitude":35.1}'}));
  assert.doesNotMatch(backup,/latitude/);
  const bad=JSON.parse(backup);bad.footprints={'crownless-not-a-journal':'x'};
  assert.throws(()=>Save.parseBackup(JSON.stringify(bad),Engine.parse),/invalid footprints/);
});
