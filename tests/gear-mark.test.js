const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/gear-mark.js', 'utf8');
const html = fs.readFileSync('expedition.html', 'utf8');

test('gear mark personalization loads after reinforcement rendering', () => {
  assert.match(html, /src\/upgrade-visual\.js[\s\S]*src\/gear-mark\.js/);
});

test('only reinforced equipped gear offers a cosmetic mark choice', () => {
  assert.match(source, /E\.weaponLevel\(state, gear\)/);
  assert.match(source, /if \(!level\) return/);
  assert.match(source, /性能は変わらない/);
  assert.match(source, /data-mark=\"diamond\"/);
  assert.match(source, /data-mark=\"notch\"/);
});

test('mark preference is scoped to mode and gear and persists separately from game state', () => {
  assert.match(source, /crownless-gear-mark-v1-\$\{mode\}-\$\{gear\}/);
  assert.match(source, /localStorage\.setItem\(key\(mode, gear\), mark\)/);
  assert.doesNotMatch(source, /E\.serialize/);
});
