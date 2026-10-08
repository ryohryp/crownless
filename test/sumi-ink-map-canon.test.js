const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('living map ink-wash asset stays lightweight and text-free', () => {
  const svg = fs.readFileSync('assets/living-map-terrain.svg', 'utf8');
  assert.match(svg, /viewBox="0 0 430 700"/);
  assert.match(svg, /ink-wash river/i);
  assert.match(svg, /#34332f/);
  assert.doesNotMatch(svg, /<script\b|<text\b|<foreignObject\b/i);
});

test('map palette preserves paper, readable ink and rival vermilion', () => {
  const css = fs.readFileSync('neighborhood.css', 'utf8');
  assert.match(css, /background-color:#e8ddc7/);
  assert.match(css, /\.district-pin\.biome-wood>\.district-landmark\{color:#3d3b36/);
  assert.match(css, /data-stronghold-state="rival"/);
  assert.match(css, /\.district-poi-card>summary/);
});

test('active Visual Canon documents user-approved sumi-e and phone constraints', () => {
  const canon = fs.readFileSync('docs/visual-canon.md', 'utf8');
  assert.match(canon, /2026-10-08/);
  assert.match(canon, /sumi-e/i);
  assert.match(canon, /360–430/);
});
