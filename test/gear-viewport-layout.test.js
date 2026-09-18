const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('phone-density.css', 'utf8');

test('gear tab keeps character preview and fitting controls in one phone scene', () => {
  const gearScene = '.game-layout:has(.camp-tabs button.active[data-value="gear"])';
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.ok(css.includes(gearScene));
  assert.match(css, /\.exploration-atlas\s*\{\s*display:\s*none/);
  assert.match(css, /grid-template-rows:\s*minmax\(12rem, 34dvh\) minmax\(0, 1fr\)/);
  assert.match(css, /\.panel\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.gear-list\s*\{[\s\S]*?max-height:\s*12rem[\s\S]*?overflow-y:\s*auto/);
});

test('gear tab keeps the owned list compact and selected reinforce controls visible', () => {
  assert.match(css, /\.gear-list \.choice small\s*\{\s*display:\s*none/);
  assert.match(css, /\.gear-list \.choice\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(css, /\.rule-line\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:\s*0/);
});
