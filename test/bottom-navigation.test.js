const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../src/bottom-navigation.js');

test('bottom navigation exposes short thumb-friendly labels', () => {
  assert.equal(nav.navLabel('explore'), '近所');
  assert.equal(nav.navLabel('home'), '拠点');
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
  assert.match(css, /flex:\s*1 1 0/);
  assert.match(css, /border-radius:\s*2px/);
  assert.match(css, /@media \(max-width:\s*480px\)[\s\S]*body:has\(\.bottom-navigation\)/);
  assert.match(css, /padding-bottom:/);
});


test('desktop living-map preview anchors the dock inside the phone frame', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'living-map-home.css'), 'utf8');
  assert.match(css, />\.camp-tabs\.bottom-navigation\{position:absolute/);
  assert.match(css, /atlas-home-caption\{display:none\}/);
});

test('sumi-e dock has equal columns even before its optional JS enhancer', () => {
  const app = fs.readFileSync(path.join(__dirname,'..','src','slice-app.js'),'utf8');
  const css = fs.readFileSync(path.join(__dirname,'..','neighborhood.css'),'utf8');
  assert.match(app,/class="camp-tabs bottom-navigation"/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css,/>button\{\s*\n  display:flex/);
  assert.match(css,/min-width:0;min-height:48px/);
});
