const assert = require('node:assert/strict');
const test = require('node:test');
const shrine = require('../src/shrine-bargain.js');

function state(overrides = {}) {
  return {
    runs: 2,
    expedition: { stage: 'cleared', depth: 2, hp: 14, potions: 0, log: [], ...overrides }
  };
}

test('shrine appears only in a viable deep cleared expedition', () => {
  assert.equal(shrine.shouldAppear(state()), true);
  assert.equal(shrine.shouldAppear(state({ depth: 1 })), false);
  assert.equal(shrine.shouldAppear(state({ hp: 6 })), false);
});

test('offering clearly trades hp for capped herbs', () => {
  const seeded = shrine.seed(state({ potions: 2 }));
  const next = shrine.resolve(seeded, 'shrine-offer');
  assert.equal(next.expedition.hp, 9);
  assert.equal(next.expedition.potions, 3);
  assert.equal(next.expedition.shrineBargainPending, false);
});

test('declining costs nothing and resolves the choice', () => {
  const seeded = shrine.seed(state());
  const next = shrine.resolve(seeded, 'shrine-decline');
  assert.equal(next.expedition.hp, 14);
  assert.equal(next.expedition.potions, 0);
  assert.equal(next.expedition.shrineBargainPending, false);
});

test('resolved shrine cannot be applied twice', () => {
  const once = shrine.resolve(shrine.seed(state()), 'shrine-offer');
  assert.equal(shrine.resolve(once, 'shrine-offer'), once);
});
