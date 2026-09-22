const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/expedition-supplies.js');

test('bandage adds exactly one starting herb and stays capped', () => {
  const expedition = { potions: 2 };
  S.applyStart(expedition, 'bandage');
  assert.equal(expedition.potions, 3);
  S.applyStart(expedition, 'bandage');
  assert.equal(expedition.potions, 3);
});

test('ration grants its rest bonus once', () => {
  const expedition = { potions: 2 };
  S.applyStart(expedition, 'ration');
  assert.equal(S.restBonus(expedition), 4);
  assert.equal(S.restBonus(expedition), 0);
});

test('torch enriches only its loot cue', () => {
  assert.match(S.cueSuffix({ supply: 'torch' }), /松明/);
  assert.equal(S.cueSuffix({ supply: 'bandage' }), '');
});

test('invalid supply leaves expedition unchanged', () => {
  const expedition = { potions: 2 };
  S.applyStart(expedition, 'unknown');
  assert.deepEqual(expedition, { potions: 2 });
});
