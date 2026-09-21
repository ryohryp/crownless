const test = require('node:test');
const assert = require('node:assert/strict');
const feature = require('../src/one-more-door');

function state(overrides = {}) {
  return {
    owned: ['rust'],
    expedition: {
      place: 'wood', depth: 1, stage: 'cleared', hp: 20, scrap: 5,
      gear: ['fang'], seals: ['wood'], log: [], ...overrides,
    },
  };
}

test('offers the last door only after a cleared expedition with something at stake', () => {
  assert.equal(feature.available(state()), true);
  assert.equal(feature.available(state({ stage: 'path' })), false);
  assert.equal(feature.available(state({ hp: 6 })), false);
  assert.equal(feature.available(state({ scrap: 0, gear: [] })), false);
});

test('entering costs health, adds a small reward, and can happen only once', () => {
  const before = state();
  const after = feature.enter(before);
  assert.notEqual(after, before);
  assert.equal(after.expedition.hp, 14);
  assert.equal(after.expedition.scrap, 12);
  assert.match(after.expedition.log[0], /半開きの扉を調べた/);
  assert.equal(feature.available(after), false);
  assert.equal(feature.enter(after), after);
});

test('install keeps the normal safe return action delegated to the core engine', () => {
  let delegated = null;
  const engine = { act(s, action) { delegated = action; return { delegated: true }; } };
  feature.install(engine);
  assert.deepEqual(engine.act(state(), 'return'), { delegated: true });
  assert.equal(delegated, 'return');
  const tempted = engine.act(state(), 'last-door');
  assert.equal(tempted.expedition.hp, 14);
});
