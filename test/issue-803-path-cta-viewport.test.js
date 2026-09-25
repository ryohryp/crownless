const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/slice-app.js', 'utf8');
const css = fs.readFileSync('phone-density.css', 'utf8');

test('phone path keeps status/copy separate from the primary action row', () => {
  assert.match(app, /class="path-decision"[\s\S]*class="path-scroll"[\s\S]*class="path-mobile-status"[\s\S]*class="path-copy"[\s\S]*class="path-actions"/);
  assert.match(css, /\.path-decision\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)\s+auto;[\s\S]*overflow:\s*hidden/);
  assert.match(css, /\.path-scroll\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0, 1fr\);[\s\S]*overflow:\s*hidden/);
});

test('only path copy scrolls while CTA remains a reserved viewport row', () => {
  assert.match(css, /\.path-copy\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /\.path-actions\s*\{[\s\S]*min-height:\s*0;[\s\S]*border-top:/);
});
