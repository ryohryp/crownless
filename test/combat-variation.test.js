const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

const demo = (runs = 0) => ({ ...E.initial(), mode: 'demo', runs });
const firstIntent = (kind, seed, depth = 1) => E.intent({ kind, hp: 10, maxHp: 10, turn: 0, depth, elite: false, risky: false, seed }).id;

test('#904: first room stays canonical, later encounters start at varied points', () => {
  let s = E.start(demo(), 'wood');
  s = E.act(s, 'careful');
  assert.equal(s.expedition.enemy.seed, undefined);
  assert.equal(E.intent(s.expedition.enemy).id, 'quick');

  const starts = new Set([0, 1, 2, 3, 4, 5].map(seed => firstIntent('wolf', seed)));
  assert.ok(starts.size >= 2, 'wolf loop start must vary');
  for (let seed = 0; seed < 12; seed++) {
    for (const kind of ['wolf', 'knight', 'wraith', 'king']) assert.notEqual(firstIntent(kind, seed), 'open');
  }
});

test('#904: wounded enemy fakes one opening with a telegraphed counter, dodge avoids it', () => {
  let s = E.start(demo(), 'wood');
  s = E.act(s, 'careful');
  s.expedition.enemy.hp = 9; // above half
  s = E.act(s, 'guard');
  s.expedition.enemy.hp = 7;
  s.expedition.enemy.turn = 0;
  s = E.act(s, 'guard'); // wolf slips below half on its own? force via strike instead
  const e = s.expedition.enemy;
  e.hp = 7; e.frenzy = true; e.wounded = true; e.turn = 2; // open slot of base wolf loop
  assert.equal(E.intent(e).id, 'frenzy');
  assert.ok(E.intent(e).damage > 0);
  const before = s.expedition.hp;
  const after = E.act(s, 'dodge');
  assert.equal(after.expedition.hp, before);
  assert.equal(after.expedition.enemy.frenzy, false);
  assert.equal(after.expedition.stagger, false);
  assert.ok(after.expedition.focus > 0);
});

test('#904: crossing half HP arms frenzy exactly once and the save round-trips', () => {
  let s = E.start(demo(), 'wood');
  s = E.act(s, 'careful');
  s.expedition.enemy.hp = 9;
  s = E.act(s, 'strike'); // 9 - 4 = 5 <= 8
  assert.equal(s.expedition.enemy.wounded, true);
  assert.equal(s.expedition.enemy.frenzy, true);
  assert.ok(E.parse(E.serialize(s)), 'frenzy state must be a valid save');
  const seeded = E.start(demo(3), 'wood');
  seeded.expedition.room = 2;
  const fight = E.act(seeded, 'careful');
  assert.ok(Number.isInteger(fight.expedition.enemy.seed));
  assert.ok(E.parse(E.serialize(fight)));
});
