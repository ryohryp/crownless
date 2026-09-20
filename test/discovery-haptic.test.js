const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../src/discovery-haptic.js'), 'utf8');
const html = fs.readFileSync(require.resolve('../expedition.html'), 'utf8');

test('discovery haptic is loaded after the game app', () => {
  assert.ok(html.indexOf('src/slice-app.js') < html.indexOf('src/discovery-haptic.js'));
});

test('cue reacts to saved discovery count and stays optional', () => {
  assert.match(source, /save\.unlocked/);
  assert.match(source, /current > previous/);
  assert.match(source, /typeof navigator\.vibrate !== 'function'/);
  assert.match(source, /navigator\.vibrate\(70\)/);
});

test('cue does not add background geolocation or continuous movement tracking', () => {
  assert.doesNotMatch(source, /geolocation|watchPosition|getCurrentPosition|setInterval|setTimeout/);
  assert.match(source, /MutationObserver/);
});
