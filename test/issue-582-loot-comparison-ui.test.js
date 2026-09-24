const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('loot comparison reads the explicit current-equipment ledger line', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'loot-comparison-ui.js'), 'utf8');
  assert.match(source, /startsWith\('現在装備：'\)/);
  assert.match(source, /slice\('現在装備：'\.length\)/);
  assert.doesNotMatch(source, /ledger\.querySelector\('small'\)\?\.textContent/);
});
