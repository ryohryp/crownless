const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('src/slice-app.js', 'utf8');
const css = fs.readFileSync('phone-density.css', 'utf8');

test('expedition path uses a dedicated bounded decision surface on phone', () => {
  assert.match(app, /game-layout expedition-layout/);
  assert.match(app, /panel \$\{isFight \? 'combat-panel' : 'path-panel'\}/);
  assert.match(app, /class="path-mobile-status"/);
  assert.match(app, /class="path-actions"/);
  assert.match(css, /\.expedition-layout:not\(\.battle-layout\)[\s\S]*grid-template-rows:\s*minmax\(12\.5rem, 40dvh\)\s+minmax\(0, 1fr\)/);
  assert.match(css, /\.visual-column\s*>\s*\.vitals,[\s\S]*\.journey-note\s*\{\s*display:\s*none/);
  assert.match(css, /\.path-panel\s*\{[\s\S]*overflow:\s*hidden/);
});

test('mobile expedition keeps status and decisions visible without desktop prose stack', () => {
  assert.match(css, /\.path-mobile-status\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.path-desktop-details\s*\{\s*display:\s*none/);
  assert.match(css, /\.path-actions\s*\{[\s\S]*background:\s*var\(--bg\)/);
  assert.match(css, /\.path-actions \.button-stack\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
