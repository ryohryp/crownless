'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const T = require('../src/tower-field.js');

test('tile 18 hints at bell echo without revealing hidden stairs', () => {
  let state = E.start(E.discover({...E.initial(), mode:'demo'}, 'tower'), 'tower');
  for (const to of [21, 22, 23, 18]) state = E.act(state, 'tower-step:' + to);
  assert.equal(state.expedition.tower.pos, 18);
  assert.match(state.expedition.log[0], /鐘の余韻/);
  assert.equal(state.expedition.tower.echo, false);
  assert.equal(T.visible(state.expedition.tower, T.SECRET), false);
  state = E.parse(E.serialize(state));
  assert.equal(state.expedition.tower.pos, 18);
  assert.equal(T.visible(state.expedition.tower, T.SECRET), false);
  state = E.act(state, 'tower-step:' + T.ECHO);
  assert.equal(state.expedition.tower.echo, true);
  state = E.act(state, 'tower-step:18');
  assert.doesNotMatch(state.expedition.log[0], /鐘の余韻/);
});
