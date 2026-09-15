const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

const fresh = () => ({ ...E.initial(), mode: 'demo' });

function heavyIntentState(gear = 'rust') {
  let s = fresh();
  if (gear !== 'rust') {
    s.owned.push(gear);
    s = E.equip(s, gear);
  }
  s = E.start(s, 'wood');
  s = E.act(s, 'careful');
  s.expedition.enemy.turn = 1; // wolf depth 1: heavy
  assert.equal(E.intent(s.expedition.enemy).id, 'heavy');
  return s;
}

test('heavy intent offers a real guard-vs-dodge tradeoff instead of one safe answer', () => {
  const before = heavyIntentState();
  const guarded = E.act(before, 'guard');
  const dodged = E.act(before, 'dodge');

  assert.equal(guarded.expedition.hp, 27, 'guard accepts chip damage');
  assert.equal(guarded.expedition.stamina, 3, 'guard preserves/refills stamina');
  assert.equal(dodged.expedition.hp, 30, 'dodge avoids the hit');
  assert.equal(dodged.expedition.stamina, 2, 'dodge spends stamina');
  assert.equal(dodged.expedition.focus, 3, 'dodge creates an offensive follow-up');
});

test('shield changes the value of guarding the same heavy intent', () => {
  const before = heavyIntentState('shield');
  const guarded = E.act(before, 'guard');

  assert.equal(guarded.expedition.hp, 30, 'shield can fully absorb the shallow heavy');
  assert.equal(guarded.expedition.stamina, 3);
  assert.ok(guarded.expedition.enemy.hp < before.expedition.enemy.hp, 'shield counterattacks');
});
