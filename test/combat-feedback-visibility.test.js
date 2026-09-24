const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('combat feedback stays brief but visibly distinct', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'combat-feedback.css'), 'utf8');
  assert.match(css, /combat-feedback-hit \.scene\{animation:crownless-enemy-hit \.24s/);
  assert.match(css, /combat-feedback-hurt \.scene\{animation:crownless-player-hurt-scene \.28s/);
  assert.match(css, /translateX\(-10px\)/);
  assert.match(css, /box-shadow:inset 0 0 0 4px #e9826d/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /animation:none!important/);
});
