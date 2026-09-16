const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const engine = fs.readFileSync('src/slice-engine.js', 'utf8');
const app = fs.readFileSync('src/slice-app.js', 'utf8');
const html = fs.readFileSync('expedition.html', 'utf8');

test('undiscovered locations keep identity-safe source teasers but render as blank map space', () => {
  for (const id of ['wood', 'tower', 'fen', 'crypt']) {
    assert.match(engine, new RegExp(`id: '${id}'[^\\n]+teaser:`));
  }
  assert.match(app, /atlas-region/);
  assert.match(app, /unseen/);
  assert.doesNotMatch(app, /予兆あり|selectedPlace\.teaser|未知の気配/);
  assert.doesNotMatch(engine.match(/teaser: '[^']+'/g).join('\n'), /番人の盾|牙の短剣|灰の王冠/);
});

test('map maturity renders without the obsolete teaser bootstrap', () => {
  assert.match(app, /未踏/);
  assert.match(app, /踏査/);
  assert.match(app, /探索/);
  assert.match(app, /発見/);
  assert.match(app, /調査済み/);
  assert.doesNotMatch(html, /src\/exploration-teasers\.js/);
  assert.doesNotMatch(app, /MutationObserver/);
});
