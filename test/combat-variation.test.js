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


test('#906: seeded encounters generate varied deterministic sequences without unfair repeats', () => {
  const sequence = seed => Array.from({ length: 12 }, (_, turn) =>
    E.intent({ kind: 'wolf', hp: 16, maxHp: 16, turn, depth: 2, elite: false, risky: false, seed }).id
  );
  const a = sequence(101), again = sequence(101), b = sequence(102);
  assert.deepEqual(a, again, 'same encounter seed must restore the same future');
  assert.notDeepEqual(a, b, 'different encounters should not collapse to one loop');
  assert.notEqual(a[0], 'open');
  for (let i = 1; i < a.length; i++) {
    assert.ok(!(a[i] === 'open' && a[i - 1] === 'open'), 'open cannot repeat');
    assert.ok(!(a[i] === 'heavy' && a[i - 1] === 'heavy'), 'heavy cannot repeat');
    if (i >= 2) assert.ok(!(a[i] === a[i - 1] && a[i] === a[i - 2]), 'same action cannot repeat three times');
  }
});

test('#906: only the first fight of the first expedition keeps the authored loop; boss keeps only its opener', () => {
  let first = E.start(demo(), 'wood');
  first = E.act(first, 'careful');
  assert.equal(first.expedition.enemy.seed, undefined);

  let laterRun = E.start(demo(4), 'wood');
  laterRun = E.act(laterRun, 'careful');
  assert.ok(Number.isInteger(laterRun.expedition.enemy.seed));

  let boss = E.start(demo(2), 'wood');
  boss.expedition.room = 4;
  boss = E.act(boss, 'careful');
  assert.equal(E.intent(boss.expedition.enemy).id, E.ENEMIES.wolf.elitePatterns[0][0]);
  boss.expedition.enemy.turn = 1;
  assert.ok(E.INTENTS[E.intent(boss.expedition.enemy).id]);
  assert.ok(E.parse(E.serialize(boss)), 'generated boss encounter must round-trip through save');
});
