'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('action scene CSS is local, precompiled, and served without runtime Tailwind', () => {
  const html = readFileSync(path.join(root, 'gemini-feel-lab.html'), 'utf8');
  const css = readFileSync(path.join(root, 'action-lab-utilities.css'), 'utf8');
  assert.match(html, /<link rel="stylesheet" href="action-lab-utilities\.css">/);
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com/);
  assert.match(css, /\.flex\{display:flex\}/);
  assert.match(css, /\.hidden\{display:none\}/);
  assert.match(css, /width:48%/);
});
