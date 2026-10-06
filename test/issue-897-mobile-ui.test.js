const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const E = require('../src/slice-engine.js');
const appCode = fs.readFileSync(path.join(__dirname, '../src/slice-app.js'), 'utf8');
const phoneCss = fs.readFileSync(path.join(__dirname, '../phone-density.css'), 'utf8');
const sliceCss = fs.readFileSync(path.join(__dirname, '../slice.css'), 'utf8');

function mockBrowser(seed = {}) {
  const store = new Map(Object.entries(seed)), callbacks = {}, elements = {};
  for (const id of ['#game', '#save-status', '#save-label', '#help-toggle', '#help', '#home-name']) {
    elements[id] = { innerHTML: '', hidden: true, textContent: '', value: '', addEventListener(t, fn) { this[t] = fn; }, setAttribute() {} };
  }
  const context = {
    CrownlessSlice: E,
    CrownlessNeighborhood: require('../src/neighborhood.js'),
    CrownlessArt: { scene: () => '<svg></svg>', icon: () => '<svg></svg>' },
    isSecureContext: true,
    document: { querySelector: sel => elements[sel] || null },
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    navigator: { geolocation: { getCurrentPosition() {} } },
    addEventListener: (name, fn) => { callbacks[name] = fn; },
    location: { reload() {} }
  };
  context.window = context;
  vm.runInNewContext(appCode, context);
  return {
    elements,
    click(action, value) {
      elements['#game'].click({ target: { closest: () => ({ dataset: { action, value }, disabled: false }) } });
    },
    html: () => elements['#game'].innerHTML
  };
}

test('issue #897: scene includes scene-top-actions with scene-settings button', () => {
  const b = mockBrowser();
  b.click('mode', 'demo');
  assert.match(b.html(), /class="scene-top-actions"/);
  assert.match(b.html(), /class="scene-settings"\s+data-action="settings"/);
  assert.match(b.html(), /⚙ 設定/);
});

test('issue #897: clicking settings from scene opens help modal without changing screen', () => {
  const s = E.act(E.start({ ...E.initial(), mode: 'demo' }, 'wood'), 'careful');
  const key = 'crownless-expedition-v1-demo';
  const b = mockBrowser({ 'crownless-expedition-mode': 'demo', [key]: E.serialize(s) });
  assert.equal(b.elements['#help'].hidden, true);
  b.click('settings');
  assert.equal(b.elements['#help'].hidden, false);
});

test('issue #897: phone density css shows tactical cues and wraps intent text', () => {
  // Choice button small text must be displayed on phones, not hidden
  assert.match(phoneCss, /\.combat-choice-grid \.choice small\s*\{[\s\S]*?display:\s*block/);
  assert.doesNotMatch(phoneCss, /\.combat-choice-grid \.choice small\s*\{\s*display:\s*none/);

  // Foot button small text must be displayed on phones
  assert.match(phoneCss, /\.combat-foot \.choice small\s*\{[\s\S]*?display:\s*block/);
  assert.doesNotMatch(phoneCss, /\.combat-foot \.choice small\s*\{\s*display:\s*none/);

  // Intent text must support multiline clamp instead of single-line truncation
  assert.match(phoneCss, /\.intent small\s*\{[\s\S]*?-webkit-line-clamp:\s*2/);

  // Scene settings styles exist in phone density and slice css
  assert.match(phoneCss, /\.scene-settings/);
  assert.match(sliceCss, /\.scene-settings/);
  assert.match(sliceCss, /\.scene-top-actions/);
});
