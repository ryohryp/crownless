const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');

test('bell relic changes the real fork into bank-now or risk-the-guardian without granting a blueprint', () => {
  const event = N.cell(400, 0);
  let state = E.startWithLocalClue(E.discoverDistrict({...E.initial(), mode:'demo'}, event));
  assert.equal(state.expedition.stage, 'path');
  assert.equal(state.expedition.tower.rumor, true);
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
  const safe = E.act(restored, 'return');
  assert.equal(safe.expedition, null);
  assert.equal(safe.report.died, false);
  assert.equal(safe.materials.watchIron, 1);
  assert.equal(safe.scrap, 4);
  assert.equal(safe.designs.shield_thorn, undefined, 'non-combat discovery cannot counterfeit the guardian recipe');
});
