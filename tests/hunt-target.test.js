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

test('crafting-material target adds a regional material only after a deep victory', () => {
  Hunt.setTarget('gear');
  let s = E.start(ready(), 'wood');
  assert.match(s.expedition.log[0], /鍛冶素材を探す/);
  s.expedition.depth = 2;
  s = E.act(s, 'careful');
  assert.equal(s.expedition.enemy.risky, false);
  const before = s.expedition.materials.wolfFang;
  s.expedition.enemy.hp = 1;
  s = E.act(s, 'strike');
  assert.equal(s.expedition.materials.wolfFang, before + 2);
  assert.match(s.expedition.log.join(' '), /地域素材をもう1つ/);
});

test('danger target makes the encounter tougher and reward-eligible', () => {
  Hunt.setTarget('danger');
  let s = E.start(ready(), 'wood');
  s = E.act(s, 'careful');
  assert.equal(s.expedition.enemy.risky, true);
  assert.equal(s.expedition.enemy.maxHp, 19);
});
