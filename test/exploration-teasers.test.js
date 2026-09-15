const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/exploration-teasers.js', 'utf8');
const html = fs.readFileSync('expedition.html', 'utf8');

test('undiscovered locations have identity-safe world teasers', () => {
  for (const id of ['wood', 'tower', 'fen', 'crypt']) {
    assert.match(source, new RegExp(`${id}:`));
  }
  assert.match(source, /未知の予兆/);
  assert.doesNotMatch(source, /番人の盾|牙の短剣|灰の王冠/);
});

test('teasers only target unknown markers and are loaded after the map renderer', () => {
  assert.match(source, /atlas-marker\.unknown/);
  assert.match(source, /atlas-memory\.unknown/);
  assert.ok(html.indexOf('src/slice-app.js') < html.indexOf('src/exploration-teasers.js'));
});
