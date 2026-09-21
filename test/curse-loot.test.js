const test = require('node:test');
const assert = require('node:assert/strict');
const curse = require('../src/curse-loot');

function state(overrides = {}) {
  return {
    runs: 3,
    expedition: {
      stage: 'cleared', depth: 2, hp: 18, gear: ['fang_blood'], log: [],
      ...overrides,
    },
  };
}

test('curse loot only appears on a deep cleared run with gear and enough hp', () => {
  assert.equal(curse.shouldAppear(state()), true);
  assert.equal(curse.shouldAppear(state({ depth: 1 })), false);
  assert.equal(curse.shouldAppear(state({ gear: [] })), false);
  assert.equal(curse.shouldAppear(state({ hp: 4 })), false);
});

test('carrying the cursed gear costs hp but keeps the loot', () => {
  const seeded = curse.seed(state());
  const next = curse.resolve(seeded, 'curse-carry');
  assert.equal(next.expedition.hp, 14);
  assert.deepEqual(next.expedition.gear, ['fang_blood']);
  assert.equal(next.expedition.curseLootPending, false);
});

test('discarding protects hp but abandons the cursed gear', () => {
  const seeded = curse.seed(state());
  const next = curse.resolve(seeded, 'curse-discard');
  assert.equal(next.expedition.hp, 18);
  assert.deepEqual(next.expedition.gear, []);
  assert.equal(next.expedition.curseLootPending, false);
});

test('the encounter is bounded to once per expedition', () => {
  const seeded = curse.seed(state());
  assert.equal(curse.shouldAppear(seeded), false);
});
