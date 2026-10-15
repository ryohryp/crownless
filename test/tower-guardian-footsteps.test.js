'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

test('tower guardian footsteps offer a safe-return choice before combat', () => {
  let s = E.start(E.discover({...E.initial(), mode:'demo'}, 'tower'), 'tower');
  for (const tile of [21, 22, 23, 18, 13]) s = E.act(s, 'tower-step:' + tile);
  s = E.act(s, 'tower-cache-iron');
  assert.equal(s.expedition.materials.watchIron, 1);
  s = E.act(s, 'tower-step:14');
  assert.equal(s.expedition.tower.pos, 14);
  assert.equal(s.expedition.stage, 'path', 'footsteps are a warning, not forced combat');
  assert.equal(s.expedition.tower.guard, false);
  assert.match(s.expedition.log[0], /鎧が石床を打つ足音/);
  assert.match(s.expedition.log[0], /生還するか/);
  assert.match(s.expedition.log[0], /背嚢の鐘鉄 1・鉄片 0 を守って/,
    'guardian warning names the material that can be lost');
  const resumed = E.parse(E.serialize(s));
  assert.match(resumed.expedition.log[0], /鎧が石床を打つ足音/, 'warning survives reload');
  const challenge = E.act(resumed, 'tower-step:9');
  assert.equal(challenge.expedition.stage, 'fight', 'stepping toward the guardian remains a deliberate risk');
  const retreated = E.act(resumed, 'return');
  assert.equal(retreated.expedition, null, 'safe return closes the expedition');
  assert.equal(retreated.materials.watchIron, 1, 'retreat banks the carried material');
});

test('tower guardian warns without inventing carried loot when the bag is empty', () => {
  let s = E.start(E.discover({...E.initial(), mode:'demo'}, 'tower'), 'tower');
  for (const tile of [21, 22, 23, 18, 19, 14]) s = E.act(s, 'tower-step:' + tile);
  assert.equal(s.expedition.stage, 'path');
  assert.equal(s.expedition.materials.watchIron, 0);
  assert.equal(s.expedition.scrap, 0);
  assert.match(s.expedition.log[0], /背嚢はまだ空だ。生還するか/);
  assert.doesNotMatch(s.expedition.log[0], /鐘鉄 1/);
  assert.deepEqual(E.parse(E.serialize(s)), s, 'empty-bag warning survives resume');
});
