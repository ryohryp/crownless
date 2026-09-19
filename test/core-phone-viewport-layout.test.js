const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('phone-density.css', 'utf8');

test('primary phone gameplay uses a bounded viewport scene', () => {
  assert.match(css, /body\s*\{\s*height:\s*100dvh;\s*overflow:\s*hidden/);
  assert.match(css, /\.app-shell\s*\{[\s\S]*?height:\s*100dvh[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.masthead,\s*\.footer\s*\{\s*display:\s*none/);
  assert.match(css, /#game\s*\{[\s\S]*?height:\s*100%[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /#game\s*>\s*\.game-layout\s*\{[\s\S]*?height:\s*100%[\s\S]*?grid-template-rows:[\s\S]*?overflow:\s*hidden/);
});

test('overflow is local to secondary phone content', () => {
  assert.match(css, /#game\s*>\s*\.game-layout\s+\.panel\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.exploration-atlas\s*\{[\s\S]*?max-height:\s*45%[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /#game\s*>\s*\.battle-layout\s*\{[\s\S]*?grid-template-rows:/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});


test('return result keeps its continuation action reachable on phone', () => {
  const app = fs.readFileSync('src/slice-app.js', 'utf8');
  assert.match(app, /game-layout report-layout/);
  assert.match(app, /panel report-panel/);
  assert.match(css, /\.report-layout\s*\{[\s\S]*?grid-template-rows:\s*minmax\(9rem, 31dvh\)\s+minmax\(0, 1fr\)/);
  assert.match(css, /\.report-panel\s*\{[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /\.report-panel\s*>\s*\.button-stack\s*\{[\s\S]*?position:\s*sticky[\s\S]*?order:\s*99/);
});
