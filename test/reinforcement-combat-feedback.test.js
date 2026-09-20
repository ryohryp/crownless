const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

function reinforced(gear, level) {
  const state = E.initial();
  state.owned = [...new Set([...state.owned, gear])];
  state.equipped = gear;
  state.upgrades[gear] = level;
  return state;
}

test('dagger reinforcement makes a successful dodge counter more valuable', () => {
  const base = reinforced('fang', 0);
  const improved = reinforced('fang', 2);
  assert.equal(E.combatProfile(base).dodgeFocus, 5);
  assert.equal(E.combatProfile(improved).dodgeFocus, 7);
  assert.match(E.gearText(improved, 'fang'), /追撃 \+7/);
});

test('shield reinforcement changes the guard trade-off', () => {
  const base = E.combatProfile(reinforced('shield', 0));
  const improved = E.combatProfile(reinforced('shield', 3));
  assert.ok(improved.block > base.block, 'reinforcement should absorb more damage');
  assert.ok(improved.counter > base.counter, 'reinforcement should improve the counter payoff');
});

test('bow reinforcement makes heavy attacks hit harder without changing their role', () => {
  const baseState = reinforced('bow', 0);
  const improvedState = reinforced('bow', 3);
  const base = E.combatProfile(baseState);
  const improved = E.combatProfile(improvedState);
  assert.equal(improved.heavyCost, base.heavyCost);
  assert.equal(improved.pierce, true);
  assert.ok(improved.heavyBonus > base.heavyBonus);
  assert.match(E.gearText(improvedState, 'bow'), /守りを貫通/);
});

test('reinforcement remains per-weapon instead of becoming a global stat bonus', () => {
  const state = E.initial();
  state.owned.push('fang', 'shield');
  state.upgrades.fang = 3;
  state.upgrades.shield = 0;
  assert.equal(E.weaponLevel(state, 'fang'), 3);
  assert.equal(E.weaponLevel(state, 'shield'), 0);
});
