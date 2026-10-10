const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');

const read = path => fs.readFileSync(require('node:path').join(__dirname, '..', path), 'utf8');
const context = { window: {} };
vm.runInNewContext(read('src/slice-art.js'), context);
const art = context.window.CrownlessArt;

test('each of four regions has distinct ink POI stamps for its shop and event', () => {
  const all = [];
  for (const biome of ['wood', 'tower', 'fen', 'crypt']) {
    for (const family of ['shop', 'event']) {
      const stamp = art.poiStamp(biome, family);
      assert.match(stamp, /<svg class="district-poi-stamp"[^>]*viewBox="0 0 32 32"/);
      assert.match(stamp, /stroke="currentColor"/);
      assert.match(stamp, /aria-hidden="true"/);
      assert.doesNotMatch(stamp, /<text\b|<script\b|<image\b|<foreignObject\b|#[0-9a-fA-F]{3,8}/);
      all.push(stamp);
    }
  }
  assert.equal(new Set(all).size, 8, 'places have distinct silhouettes, not generic shop/event glyphs');
  assert.equal(art.poiStamp('unknown', 'shop'), '');
  assert.equal(art.poiStamp('wood', '__proto__'), '');
});

test('map pixel signs and expanded ink POI detail use the same canonical district state', () => {
  let s = {...E.initial(), mode: 'demo'};
  for (const district of [
    N.cell(0, -800), N.cell(400, 0), N.cell(800, 0),
    N.cell(0, 400), N.cell(0, 800), N.cell(-400, 0), N.cell(-800, 0)
  ]) s = E.discoverDistrict(s, district);
  assert.ok(E.parse(E.serialize(s)), 'ordinary save shape remains valid');
  const store = new Map([
    ['crownless-expedition-mode', 'demo'],
    ['crownless-expedition-v1-demo', E.serialize(s)]
  ]);
  const elements = {};
  for (const id of ['#game', '#save-status', '#save-label', '#help-toggle', '#help']) {
    elements[id] = {innerHTML:'', hidden:true, textContent:'', setAttribute(){}, addEventListener(){}, querySelector(){return null;}};
  }
  const window = {
    CrownlessArt: art, CrownlessNeighborhood: N, CrownlessSlice: E,
    CrownlessMapPixelArt: require('../src/map-pixel-art.js'),
    addEventListener(){}, isSecureContext:true
  };
  window.window = window;
  window.document = {querySelector: selector => elements[selector] || null};
  window.localStorage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value)};
  window.navigator = {geolocation: null};
  vm.runInNewContext(read('src/slice-app.js'), window);
  const html = elements['#game'].innerHTML;
  assert.equal((html.match(/class="district-pixel-art"/g) || []).length, 8);
  assert.equal((html.match(/class="district-poi-stamp"/g) || []).length, 1);
  assert.match(html, /aria-label="西の木立：異変・囁き樹の噂"/);
  assert.match(html, /class="district-poi-mark" aria-hidden="true"><svg class="district-pixel-art"/);
  assert.match(html, /class="district-poi-icon" aria-hidden="true"><svg class="district-poi-stamp"/);
  assert.match(html, /data-action="district"/);
  assert.match(html, /data-action="poi"/);
});

test('map POI stamps keep crisp bounds and minimum tappable map marker', () => {
  const css = read('neighborhood.css');
  assert.match(css, /\.district-poi-mark\{[^}]*width:24px;height:24px/);
  assert.match(css, /\.district-poi-stamp\{[^}]*width:20px;height:20px/);
  assert.match(css, /\.district-poi-icon \.district-poi-stamp\{width:24px;height:24px\}/);
  assert.match(css, /\.district-poi-card>summary\{[^}]*min-height:48px/);
});
