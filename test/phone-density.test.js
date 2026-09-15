const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('playable slice loads phone-only density guardrails', () => {
  const html = fs.readFileSync(path.join(root, 'expedition.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'phone-density.css'), 'utf8');
  assert.match(html, /phone-density\.css/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /max-width: 100%/);
});
