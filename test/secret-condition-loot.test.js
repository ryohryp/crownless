const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/secret-condition-loot.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../expedition.html'), 'utf8');

test('secret loot wrapper is wired before the app consumes combat actions', () => {
  assert.ok(html.indexOf('src/secret-condition-loot.js') > -1);
  assert.ok(html.indexOf('src/secret-condition-loot.js') < html.indexOf('src/slice-app.js'));
});

test('one readable clue points at the bounded forest-lord condition', () => {
  assert.match(source, /enemy\.kind === 'wolf'/);
  assert.match(source, /enemy\.elite/);
  assert.match(source, /enemy\.depth >= 2/);
  assert.match(source, /next\.id === 'open'/);
  assert.match(source, /月色の傷が開く/);
  assert.match(source, /強撃/);
});

test('bonus requires a heavy finishing blow during the opening and preserves normal victory', () => {
  assert.match(source, /action === 'heavy'/);
  assert.match(source, /E\.attackPreview\(state, action\) >= enemy\.hp/);
  assert.match(source, /const result = originalAct\(state, action\)/);
  assert.match(source, /after\.scrap \+= 8/);
  assert.match(source, /月牙の欠片/);
});
