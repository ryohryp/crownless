const test = require('node:test');
const assert = require('node:assert/strict');
const Unknown = require('../src/unknown-quarter.js');

test('region key keeps only coarse 0.01 degree familiarity', () => {
  assert.equal(Unknown.regionKey({ latitude: 35.74567, longitude: 139.85678 }), '35.75,139.86');
  assert.equal(Unknown.regionKey(null), null);
});

test('first visit is unknown and one observation makes region familiar', () => {
  const key = '35.75,139.86';
  assert.equal(Unknown.isKnown([], key), false);
  const known = Unknown.markKnown([], key);
  assert.equal(Unknown.isKnown(known, key), true);
  assert.deepEqual(Unknown.markKnown(known, key), known);
});

test('unknown region hides actionable cue but familiar region keeps it', () => {
  const mood = { label: '獣のざわめき', text: '獣が同じ方角を避けている。', cue: '強敵の気配' };
  assert.deepEqual(Unknown.obscureMood(mood, true), mood);
  const hidden = Unknown.obscureMood(mood, false);
  assert.equal(hidden.label, '見知らぬ土地');
  assert.equal(hidden.cue, '危険度：不明');
  assert.notEqual(hidden.text, mood.text);
});

test('known region storage is bounded and rejects unrelated data', () => {
  const input = Array.from({ length: 30 }, (_, i) => `${35 + i / 100},139.8`).concat(['raw-gps-payload']);
  const known = Unknown.normalizeKnownRegions(input);
  assert.equal(known.length, 24);
  assert.equal(known.includes('raw-gps-payload'), false);
});