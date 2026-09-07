const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase3.css'), 'utf8');

test('desktop reboot stage places map and story side by side', () => {
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /grid-template-areas:\s*['"]header header['"]\s*['"]map story['"]/);
  assert.match(css, /\.living-map\s*\{\s*grid-area: map;/);
  assert.match(css, /\.story-panel\s*\{[\s\S]*?grid-area: story;[\s\S]*?margin: 0;[\s\S]*?max-height: calc\(100dvh - 150px\);/);
});

test('desktop side rail does not keep viewport-width two-column controls', () => {
  assert.match(css, /\.story-panel \.fate-choices,[\s\S]*?\.story-panel \.next-place-grid,[\s\S]*?\.story-panel \.location-actions\s*\{\s*grid-template-columns: 1fr;/);
});

test('mobile fork cards keep the existing single-column fallback', () => {
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.next-place-grid \{ grid-template-columns: 1fr; \}/);
});
