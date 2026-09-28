const test = require('node:test');
const assert = require('node:assert/strict');
const Save = require('../src/save-data.js');
const Engine = require('../src/slice-engine.js');

function memory(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { getItem:k => data.has(k) ? data.get(k) : null, setItem:(k,v) => data.set(k,String(v)), removeItem:k => data.delete(k), data };
}

test('backup moves validated saves but not the walk anchor', () => {
  const demo = Engine.initial(); demo.mode = 'demo'; demo.scrap = 12;
  const walk = Engine.initial(); walk.mode = 'walk'; walk.victories = 3;
  const source = memory({
    'crownless-expedition-v1-demo': Engine.serialize(demo),
    'crownless-expedition-v1-walk': Engine.serialize(walk),
    'crownless-expedition-mode': 'walk',
    'crownless-expedition-v1-walk-anchor': JSON.stringify({ latitude: 35.1, longitude: 139.1 })
  });
  const backup = Save.exportBackup(source);
  assert.doesNotMatch(backup, /latitude|longitude/);
  const target = memory();
  Save.importBackup(target, backup, Engine.parse);
  assert.equal(Engine.parse(target.getItem('crownless-expedition-v1-demo')).scrap, 12);
  assert.equal(Engine.parse(target.getItem('crownless-expedition-v1-walk')).victories, 3);
  assert.equal(target.getItem('crownless-expedition-mode'), 'walk');
});

test('invalid backup is rejected before writes', () => {
  const target = memory();
  const demo = Engine.initial(); demo.mode = 'walk';
  const bad = JSON.stringify({ kind:'crownless-save', version:1, saves:{ 'crownless-expedition-v1-demo': demo } });
  assert.throws(() => Save.importBackup(target, bad, Engine.parse));
  assert.equal(target.data.size, 0);
});

test('reset clears saves, selected mode and walk anchor', () => {
  const target = memory(Object.fromEntries([...Save.SAVE_KEYS, 'crownless-expedition-mode', 'crownless-expedition-v1-walk-anchor'].map(k => [k,'x'])));
  Save.resetJourney(target);
  assert.equal(target.data.size, 0);
});
