const test = require('node:test');
const assert = require('node:assert/strict');
const Wounded = require('../src/wounded-prey');

test('elite can flee wounded once and be chased with hp preserved', () => {
  const E = {
    act(state) {
      const next = structuredClone(state);
      next.expedition.enemy.hp = 3;
      return next;
    },
    start: s => s,
    parse: s => s,
  };
  Wounded.wrapEngine(E);
  const state = { expedition: { stage: 'fight', scrap: 4, enemy: { kind: 'wolf', hp: 10, maxHp: 16, depth: 1, elite: true } } };
  const escaped = E.act(state, 'strike');
  assert.equal(escaped.expedition.stage, 'wounded-prey');
  assert.equal(escaped.expedition.enemy, null);
  assert.equal(escaped.expedition.woundedPrey.hp, 3);
  assert.match(Wounded.chaseMarkup(escaped), /血の跡を追う/);

  const chased = E.act(escaped, 'chase');
  assert.equal(chased.expedition.stage, 'fight');
  assert.equal(chased.expedition.enemy.hp, 3);
  assert.equal(chased.expedition.enemy.woundedChase, true);
});

test('non-elite enemies never enter wounded prey chase', () => {
  const E = {
    act(state) { const next = structuredClone(state); next.expedition.enemy.hp = 2; return next; },
    start: s => s,
    parse: s => s,
  };
  Wounded.wrapEngine(E);
  const state = { expedition: { stage: 'fight', enemy: { kind: 'wolf', hp: 5, maxHp: 16, depth: 1, elite: false } } };
  const next = E.act(state, 'strike');
  assert.equal(next.expedition.stage, 'fight');
  assert.equal(next.expedition.woundedPrey, undefined);
});
