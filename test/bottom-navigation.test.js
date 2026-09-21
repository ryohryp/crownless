const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../src/bottom-navigation.js');

test('bottom navigation exposes short thumb-friendly labels', () => {
  assert.equal(nav.navLabel('explore'), '遠征');
  assert.equal(nav.navLabel('gear'), '装備');
});

test('expedition page loads bottom navigation assets', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'expedition.html'), 'utf8');
  assert.match(html, /bottom-navigation\.css/);
  assert.match(html, /src\/bottom-navigation\.js/);
});

test('bottom navigation is fixed and reserves iOS safe area', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'bottom-navigation.css'), 'utf8');
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /min-height:\s*46px/);
  assert.match(css, /padding-bottom:/);
});
