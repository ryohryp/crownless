const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

const fresh = () => ({ ...E.initial(), mode: 'demo' });

test('open intent gives a decisive heavy punish window', () => {
  let s = E.act(E.start(fresh(), 'wood'), 'careful');
  s.expedition.enemy.turn = 2;
  assert.equal(E.intent(s.expedition.enemy).id, 'open');
  assert.equal(E.attackPreview(s, 'strike'), 4);
  assert.equal(E.attackPreview(s, 'heavy'), 13);
});

test('deep guardian health grows without recreating the old pacing wall', () => {
  let s = E.start(fresh(), 'wood');
  s.expedition.depth = 2;
  s.expedition.room = 4;
  s = E.act(s, 'careful');
  assert.equal(s.expedition.enemy.elite, true);
  assert.equal(s.expedition.enemy.maxHp, 27);
});
