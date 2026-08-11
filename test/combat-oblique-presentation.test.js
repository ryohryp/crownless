const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'combat-oblique.css'), 'utf8');

test('oblique combat presentation stylesheet loads after the shared layout styles', () => {
  const desktop = html.indexOf('desktop-layout.css');
  const oblique = html.indexOf('combat-oblique.css');
  assert.ok(desktop >= 0, 'desktop layout stylesheet should be present');
  assert.ok(oblique > desktop, 'combat presentation overrides should load last');
});

test('combat arena uses an oblique perspective without replacing the simulation controls', () => {
  assert.match(css, /\.combat-screen\.active #arena[\s\S]*perspective\(/);
  assert.match(css, /rotateX\(/);
  assert.match(css, /touch-action:\s*none/);

  assert.match(html, /id="touch-evade"/);
  assert.match(html, /id="touch-heavy"/);
  assert.doesNotMatch(html, /id="touch-light"/);
  assert.doesNotMatch(html, /class="dpad"/);
});

test('mobile combat keeps only two floating explicit action targets', () => {
  assert.match(css, /\.touch-controls\.simple-actions[\s\S]*position:\s*absolute/);
  assert.match(css, /\.simple-actions \.auto-control[\s\S]*display:\s*none/);
  assert.match(css, /\.simple-actions \.action-pad \.action[\s\S]*border-radius:\s*50%/);
  assert.match(css, /\.simple-actions \.action-pad \.technique[\s\S]*width:\s*78px/);
});
