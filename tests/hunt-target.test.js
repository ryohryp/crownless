const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const Hunt = require('../src/hunt-target.js');
Hunt.wrapEngine(E);

function ready() {
  const s = E.initial(); s.mode = 'demo'; return s;
}

test('hunt target stays outside persisted save schema', () => {
  Hunt.setTarget('scrap');
  const s = E.start(ready(), 'wood');
  assert.match(s.expedition.log[0], /鉄片を集める/);
  assert.equal(JSON.stringify(s).includes('__huntTarget'), false);
  assert.doesNotThrow(() => E.parse(E.serialize(s)));
});

test('gear target reuses risky loot path only in deeper encounters', () => {
  Hunt.setTarget('gear');
  let s = E.start(ready(), 'wood');
  s.expedition.depth = 2;
  s = E.act(s, 'careful');
  assert.equal(s.expedition.enemy.risky, true);
  assert.equal(s.expedition.enemy.maxHp, 21);
});

test('danger target makes the encounter tougher and reward-eligible', () => {
  Hunt.setTarget('danger');
  let s = E.start(ready(), 'wood');
  s = E.act(s, 'careful');
  assert.equal(s.expedition.enemy.risky, true);
  assert.equal(s.expedition.enemy.maxHp, 19);
});
