const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const Escape = require('../src/emergency-escape.js');

function fightingState() {
  let s = E.initial();
  s.mode = 'demo';
  s = E.start(s, 'wood');
  s = E.act(s, 'risky');
  return s;
}

test('safe escape sacrifices newest unreturned gear and avoids enemy damage', () => {
  const s = fightingState();
  s.expedition.hp = 5;
  s.expedition.gear = ['fang_moon'];
  s.expedition.scrap = 7;
  const n = Escape.safeEscape(s);
  assert.equal(n.expedition, null);
  assert.equal(n.report.died, false);
  assert.equal(n.report.hp, 5);
  assert.deepEqual(n.report.gear, []);
  assert.equal(n.scrap, 7);
  assert.ok(!n.owned.includes('fang_moon'));
});

test('safe escape sacrifices all unreturned scrap when no gear is carried', () => {
  const s = fightingState();
  s.expedition.hp = 5;
  s.expedition.scrap = 9;
  const n = Escape.safeEscape(s);
  assert.equal(n.report.died, false);
  assert.equal(n.report.hp, 5);
  assert.equal(n.report.scrap, 0);
  assert.equal(n.scrap, 0);
});

test('safe escape is unavailable with nothing to sacrifice', () => {
  const s = fightingState();
  s.expedition.gear = [];
  s.expedition.scrap = 0;
  assert.equal(Escape.escapeCost(s), null);
  assert.equal(Escape.safeEscape(s), s);
});

test('installed action keeps existing risky flee and adds sacrifice flee', () => {
  const engine = { ...E };
  Escape.install(engine);
  const s = fightingState();
  s.expedition.hp = 20;
  s.expedition.scrap = 4;
  const risky = engine.act(s, 'flee');
  const safe = engine.act(s, 'flee-drop');
  assert.ok(risky.report.hp < 20);
  assert.equal(risky.scrap, 4);
  assert.equal(safe.report.hp, 20);
  assert.equal(safe.scrap, 0);
});

test('safe escape output remains compatible with existing save parser', () => {
  const s = fightingState();
  s.expedition.scrap = 3;
  const n = Escape.safeEscape(s);
  const parsed = E.parse(E.serialize(n));
  assert.ok(parsed);
  assert.equal(parsed.report.died, false);
});
