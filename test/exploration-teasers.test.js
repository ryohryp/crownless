const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const engine = fs.readFileSync('src/slice-engine.js', 'utf8');
const app = fs.readFileSync('src/slice-app.js', 'utf8');
const html = fs.readFileSync('expedition.html', 'utf8');

test('undiscovered locations have identity-safe world teasers in the main render path', () => {
  for (const id of ['wood', 'tower', 'fen', 'crypt']) {
    assert.match(engine, new RegExp(`id: '${id}'[^\\n]+teaser:`));
  }
  assert.match(app, /予兆あり/);
  assert.match(app, /selectedPlace\.teaser/);
  assert.doesNotMatch(engine.match(/teaser: '[^']+'/g).join('\n'), /番人の盾|牙の短剣|灰の王冠/);
});

test('teasers render without the obsolete mutation-observer bootstrap', () => {
  assert.match(app, /atlas-marker .*unknown/);
  assert.match(app, /atlas-memory unknown teaser/);
  assert.doesNotMatch(html, /src\/exploration-teasers\.js/);
  assert.doesNotMatch(app, /MutationObserver/);
});
