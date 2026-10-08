const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/social-stronghold.js');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function fixture(stronghold, selected) {
  const state = {
    neighborhood: {
      selected,
      districts: [{ id: '-1,0', x: -1, y: 0, biome: 'wood' }, { id: '0,1', x: 0, y: 1, biome: 'tower' }]
    }
  };
  const store = new Map([
    ['crownless-expedition-mode', 'demo'],
    ['crownless-expedition-v1-demo', JSON.stringify(state)],
    ['crownless-territory-v1-demo', JSON.stringify(stronghold)]
  ]);
  let card = null;
  let callback = null;
  const attributes = new Map();
  const small = { textContent: 'あなたの領域' };
  const pin = {
    dataset: {},
    querySelector: selector => selector === 'small' ? small : null,
    getAttribute: name => attributes.get(name) || null,
    setAttribute: (name, value) => attributes.set(name, value)
  };
  const detail = {
    querySelector: selector => selector === '.stronghold-status' ? card : null,
    prepend: element => { card = element; }
  };
  const root = {
    querySelector(selector) {
      if (selector === '.map-home-detail') return detail;
      if (selector.startsWith('.district-pin[')) return pin;
      return null;
    }
  };
  const document = {
    querySelector: selector => selector === '#game' ? root : null,
    createElement: () => ({ className: '', dataset: {}, innerHTML: '' })
  };
  class MutationObserver {
    constructor(fn) { callback = fn; }
    observe() {}
  }
  vm.runInNewContext(read('src/social-stronghold-ui.js'), {
    window: { CrownlessStronghold: { ...T, simulateRival: state => state } },
    document,
    localStorage: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value)
    },
    MutationObserver,
    CSS: { escape: value => value }
  });
  return { pin, small, card: () => card, rerender: () => callback(), attributes };
}

test('rival-held stronghold is marked on its map pin without a card for another selection', () => {
  const claimed = T.claim(T.fresh(), '-1,0', '西の木立');
  const rival = T.simulateRival(claimed, '西の木立');
  const view = fixture(rival, '0,1');
  assert.equal(view.pin.dataset.strongholdState, 'rival');
  assert.match(view.small.textContent, /占拠/);
  assert.match(view.attributes.get('aria-label'), /占拠/);
  assert.equal(view.card(), null);
  view.rerender();
  assert.equal(view.card(), null);
});

test('selected stronghold exposes control history but does not duplicate the card', () => {
  const claimed = T.claim(T.fresh(), '-1,0', '西の木立');
  const rival = T.simulateRival(claimed, '西の木立');
  const view = fixture(rival, '-1,0');
  const first = view.card();
  assert.ok(first);
  assert.match(first.innerHTML, /支配の記録/);
  assert.match(first.innerHTML, /奪われた砦/);
  view.rerender();
  assert.equal(view.card(), first);
});

test('scouted stronghold has a distinct marker without expanding history elsewhere', () => {
  const claimed = T.claim(T.fresh(), '-1,0', '西の木立');
  const view = fixture(claimed, '0,1');
  assert.equal(view.pin.dataset.strongholdState, 'scouted');
  assert.match(view.small.textContent, /偵察痕/);
  assert.equal(view.card(), null);
});

test('local POI starts as one-line native disclosure with actions behind expansion', () => {
  const app = read('src/slice-app.js');
  const css = read('neighborhood.css');
  assert.match(app, /<details class="district-poi-card"><summary>/);
  assert.match(app, /district-poi-content/);
  assert.match(app, /button\('poi',poi.actionLabel/);
  assert.match(css, /district-poi-card>summary\{[^}]*min-height:48px/);
  assert.match(css, /district-poi-card\[open\]/);
  assert.match(css, /data-stronghold-state="rival"/);
  assert.match(css, /data-stronghold-state="scouted"/);
});
