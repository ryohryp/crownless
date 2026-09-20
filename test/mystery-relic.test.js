const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
require('../src/mystery-relic.js')(E, null);

const SEALED = 'relic_moon_shard';
const AWAKENED = 'relic_moon_shard_awakened';

function deepForestGuardian() {
  const s = E.initial();
  s.mode = 'demo';
  s.unlocked = ['wood', 'tower'];
  s.expedition = {
    place: 'wood', depth: 2, room: 4, hp: 30, stamina: 3, focus: 0,
    potions: 2, scrap: 0, gear: [], seals: [],
    enemy: { kind: 'wolf', hp: 1, maxHp: 30, turn: 2, depth: 2, elite: true, risky: false },
    stage: 'fight', log: [],
  };
  return s;
}

test('deep forest guardian can yield one unknown relic at risk', () => {
  const result = E.act(deepForestGuardian(), 'strike');
  assert.equal(result.expedition.stage, 'cleared');
  assert.ok(result.expedition.gear.includes(SEALED));
  assert.match(result.expedition.log.join(' '), /用途は分からない/);
});

test('the relic only becomes owned after a safe return', () => {
  let s = E.act(deepForestGuardian(), 'strike');
  assert.ok(!s.owned.includes(SEALED));
  s = E.act(s, 'return');
  assert.ok(s.owned.includes(SEALED));
  assert.match(E.gearText(s, SEALED), /用途不明/);
});

test('later tower exploration reveals meaning and a small at-risk reward', () => {
  const s = E.initial();
  s.mode = 'demo';
  s.unlocked = ['wood', 'tower'];
  s.owned.push(SEALED);
  s.expedition = {
    place: 'tower', depth: 1, room: 1, hp: 30, stamina: 3, focus: 0,
    potions: 2, scrap: 0, gear: [], seals: [], enemy: null, stage: 'path', log: [],
  };
  const result = E.act(s, 'search');
  assert.ok(!result.owned.includes(SEALED));
  assert.ok(result.owned.includes(AWAKENED));
  assert.equal(result.expedition.scrap, 11);
  assert.match(result.expedition.log.join(' '), /月鐘の欠片/);
});

test('save parser accepts both relic states once the experiment is installed', () => {
  const s = E.initial();
  s.mode = 'demo';
  s.owned.push(AWAKENED);
  const parsed = E.parse(E.serialize(s));
  assert.ok(parsed.owned.includes(AWAKENED));
});
