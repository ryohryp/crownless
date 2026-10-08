const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../src/bottom-navigation.js');

test('bottom navigation exposes short thumb-friendly labels', () => {
  assert.equal(nav.navLabel('explore'), '近所');
  assert.equal(nav.navLabel('home'), '拠点');
  assert.equal(nav.navLabel('gear'), '装備');
  assert.equal(nav.navLabel('codex'), '手記');
  assert.equal(nav.navLabel('chronicle'), '冒険録');
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
  assert.match(css,/grid-template-columns:none;grid-auto-flow:column/);
  assert.match(css,/grid-auto-columns:minmax\(0,1fr\)/);
  assert.match(css,/>button\{\s*\n  display:flex/);
  assert.match(css,/min-width:0;min-height:48px/);
});


test('all six dock entries are declared in core and extensions never remove app layout', () => {
  const app=fs.readFileSync(path.join(__dirname,'..','src','slice-app.js'),'utf8');
  const codex=fs.readFileSync(path.join(__dirname,'..','src','codex-ui.js'),'utf8');
  const chronicle=fs.readFileSync(path.join(__dirname,'..','src','travel-chronicle-ui.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','neighborhood.css'),'utf8');

  for (const name of ['近所','拠点','装備','手記','冒険録']) {
    assert.match(app,new RegExp("button\\('tab','"+name+"'"));
  }
  assert.match(app,/button\('settings','設定'/);
  assert.match(app,/CrownlessCodexUI\?\.renderCodex/);
  assert.match(app,/CrownlessTravelChronicleUI\?\.renderChronicle/);
  assert.match(codex,/CrownlessCodexUI = \{ renderCodex \}/);
  assert.doesNotMatch(codex,/MutationObserver|nav\.insertBefore|x\.remove\(/);
  assert.doesNotMatch(chronicle,/new MutationObserver|nav\.insertBefore|x\.remove\(/);
  assert.match(css,/grid-auto-flow:column/);
  assert.match(css,/grid-auto-columns:minmax\(0,1fr\)/);
  assert.match(css,/#game>\.journal-home>\.visual-column\{display:none\}/);
  assert.match(css,/#game>\.journal-home>\.panel\{/);
});


test('dock enhancer keeps journal tabs distinct for screen readers', () => {
  const attributes = {};
  const button = value => ({
    dataset: { value },
    classList: { add() {}, contains() { return value === 'chronicle'; } },
    setAttribute(key, val) { attributes[value + ':' + key] = val; }
  });
  const tabs = {
    classList: { add() {} },
    setAttribute() {},
    querySelectorAll() { return [button('codex'), button('chronicle')]; }
  };
  assert.equal(nav.enhance({ querySelector() { return tabs; } }), true);
  assert.equal(attributes['codex:aria-label'], '手記');
  assert.equal(attributes['chronicle:aria-label'], '冒険録');
  assert.equal(attributes['chronicle:aria-current'], 'page');
});
