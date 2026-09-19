const test = require('node:test');
const assert = require('node:assert/strict');
const Variety = require('../src/exploration-variety.js');

test('forest exposes at least three distinct moods with decision cues', () => {
  const moods = [0, 1, 2].map(i => Variety.moodFor('wood', i));
  assert.equal(new Set(moods.map(m => m.label)).size, 3);
  assert.ok(moods.every(m => m.text && m.cue));
});

test('revisiting a place rotates its expression deterministically', () => {
  assert.notDeepEqual(Variety.moodFor('wood', 0), Variety.moodFor('wood', 1));
  assert.deepEqual(Variety.moodFor('wood', 0), Variety.moodFor('wood', 3));
});

test('unsupported places keep existing exploration presentation', () => {
  assert.equal(Variety.moodFor('fen', 0), null);
});