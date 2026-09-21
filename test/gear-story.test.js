const test = require('node:test');
const assert = require('node:assert/strict');
const { storyFor } = require('../src/gear-story.js');

test('records a story only for newly returned gear', () => {
  const report = { died: false, place: 'wood', depth: 2, newGear: ['fang_moon'] };
  assert.equal(storyFor(report, 'fang_moon', '囁きの森'), '囁きの森・深層2から生還');
  assert.equal(storyFor(report, 'rust', '囁きの森'), null);
});

test('does not record lost gear from a failed expedition', () => {
  const report = { died: true, place: 'tower', depth: 3, newGear: ['shield_oath'] };
  assert.equal(storyFor(report, 'shield_oath', '鐘なき塔'), null);
});
