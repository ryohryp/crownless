const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine');

test('walk location session can restore a persisted coarse anchor', () => {
  const session = E.locationSession({ latitude: 35.75, longitude: 139.85, accuracy: 60 });
  assert.deepEqual(session.anchor, { latitude: 35.75, longitude: 139.85, accuracy: 60 });

  const result = E.observe(session, { latitude: 35.753, longitude: 139.85, accuracy: 10, speed: 0 });
  assert.equal(result.status, 'discovered');
  assert.equal(result.place, 'tower');
});

test('walk location session rejects invalid restored anchors', () => {
  assert.equal(E.locationSession({ latitude: 999, longitude: 139, accuracy: 60 }).anchor, null);
  assert.equal(E.locationSession({ latitude: 35, longitude: 139, accuracy: NaN }).anchor, null);
});
