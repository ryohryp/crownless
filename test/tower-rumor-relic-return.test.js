const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');

test('bell relic changes the real fork into bank-now or risk-the-guardian without granting a blueprint', () => {
  const event = N.cell(400, 0);
  let state = E.startWithLocalClue(E.discoverDistrict({...E.initial(), mode:'demo'}, event));
  assert.equal(state.expedition.stage, 'path');
  assert.equal(state.expedition.tower.rumor, true);
  assert.doesNotMatch(state.expedition.log[0], /戦わず帰れる道/, 'the rumor must not spoil the noncombat discovery');
  for (const id of [21, 22, 17]) state = E.act(state, 'tower-step:' + id);
  const sealed = E.act(state, 'tower-step:7');
  assert.equal(sealed, state, 'relic cannot be entered before investigating the hidden stair');
  state = E.act(state, 'tower-step:12'); // Investigate; do not move or grant loot.
  assert.equal(state.expedition.tower.pos, 17);
  assert.equal(state.expedition.tower.open, true);
  for (const id of [12, 7]) state = E.act(state, 'tower-step:' + id);
  assert.equal(state.expedition.tower.relic, true);
  assert.equal(state.expedition.materials.watchIron, 1);
  assert.equal(state.expedition.scrap, 4);
  assert.equal(state.materials.watchIron, 0, 'loot is still carried at risk');
  for (const id of [12, 17, 18, 23, 22]) state = E.act(state, 'tower-step:' + id);
  assert.equal(state.expedition.tower.pos, 22, 'the player must actually backtrack to the fork');
  const restored = E.parse(E.serialize(state));
  assert.deepEqual(restored, state, 'discovery and carried loot survive reload');
  assert.equal(E.act(restored, 'tower-step:9'), restored, 'no non-adjacent guardian shortcut');
  const risk = E.act(restored, 'tower-step:23');
  assert.equal(risk.expedition.stage, 'path', 'following footsteps does not force immediate combat');
  assert.equal(risk.expedition.materials.watchIron, 1, 'choosing risk keeps carried loot at stake');
  let earned = risk;
  for (const id of [18, 19, 14, 9]) earned = E.act(earned, 'tower-step:' + id);
  assert.equal(earned.expedition.stage, 'fight');
  assert.equal(earned.expedition.focus, 1, 'relic resonance rewards choosing the risky second route');
  assert.match(earned.expedition.log[0], /鐘鉄.*集中 \+1/);
  assert.equal(E.parse(E.serialize(earned)).expedition.focus, 1, 'earned opening focus survives reload');
  let direct = E.startWithLocalClue(E.discoverDistrict({...E.initial(), mode:'demo'}, event));
  for (const id of [21, 22, 23, 18, 19, 14, 9]) direct = E.act(direct, 'tower-step:' + id);
  assert.equal(direct.expedition.stage, 'fight');
  assert.equal(direct.expedition.focus, 0, 'direct guardian route receives no free focus');
  assert.equal(E.attackPreview(earned, 'strike'), E.attackPreview(direct, 'strike') + 1,
    'the investigated bell changes a real combat choice, not just flavor text');
  const safe = E.act(restored, 'return');
  assert.equal(safe.expedition, null);
  assert.equal(safe.report.died, false);
  assert.equal(safe.materials.watchIron, 1);
  assert.equal(safe.scrap, 4);
  assert.equal(safe.designs.shield_thorn, undefined, 'non-combat discovery cannot counterfeit the guardian recipe');
});
