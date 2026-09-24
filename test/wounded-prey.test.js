const test = require('node:test');
const assert = require('node:assert/strict');
const Wounded = require('../src/wounded-prey');

test('elite can flee wounded once and be chased with hp and combat turn preserved', () => {
  const E = {
    act(state) {
      const next = structuredClone(state);
      next.expedition.enemy.hp = 3;
      next.expedition.enemy.turn++;
      return next;
    },
    start: s => s,
    parse: s => s,
  };
  Wounded.wrapEngine(E);
  const state = { expedition: { stage: 'fight', scrap: 4, enemy: { kind: 'wolf', hp: 10, maxHp: 16, depth: 1, turn: 2, elite: true } } };
  const escaped = E.act(state, 'strike');
  assert.equal(escaped.expedition.stage, 'wounded-prey');
  assert.equal(escaped.expedition.enemy, null);
  assert.equal(escaped.expedition.woundedPrey.hp, 3);
  assert.equal(escaped.expedition.woundedPrey.turn, 3);
  assert.match(Wounded.chaseMarkup(escaped), /血の跡を追う/);

  const chased = E.act(escaped, 'chase');
  assert.equal(chased.expedition.stage, 'fight');
  assert.equal(chased.expedition.enemy.hp, 3);
  assert.equal(chased.expedition.enemy.turn, 3);
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

test('wounded prey choice and chased fight survive real engine save reload', () => {
  const E = require('../src/slice-engine');
  Wounded.wrapEngine(E);
  const base = E.initial();
  base.mode = 'demo';
  const started = E.start(base, 'wood');

  const escaped = structuredClone(started);
  escaped.expedition.stage = 'wounded-prey';
  escaped.expedition.woundedPrey = { kind: 'wolf', hp: 6, maxHp: 24, depth: 1, turn: 3 };
  const restoredChoice = E.parse(E.serialize(escaped));
  assert.ok(restoredChoice);
  assert.equal(restoredChoice.expedition.stage, 'wounded-prey');
  assert.equal(restoredChoice.expedition.woundedPrey.hp, 6);
  assert.equal(restoredChoice.expedition.woundedPrey.turn, 3);

  const chased = E.act(restoredChoice, 'chase');
  const restoredFight = E.parse(E.serialize(chased));
  assert.ok(restoredFight);
  assert.equal(restoredFight.expedition.stage, 'fight');
  assert.equal(restoredFight.expedition.enemy.hp, 6);
  assert.equal(restoredFight.expedition.enemy.turn, 3);
  assert.equal(restoredFight.expedition.enemy.woundedChase, true);
});
