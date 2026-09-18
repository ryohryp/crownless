const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ui = fs.readFileSync('src/quick-re-expedition-ui.js', 'utf8');
const html = fs.readFileSync('expedition.html', 'utf8');

test('safe return offers an explicit same-place re-expedition path', () => {
  assert.match(ui, /SAFE RETURN/);
  assert.match(ui, /同じ土地へ、もう一度/);
  assert.match(ui, /data-action=\\?"depart/);
  assert.match(ui, /continueButton\.click\(\)/);
});

test('quick re-expedition adapter is loaded after the slice app', () => {
  const app = html.indexOf('src/slice-app.js');
  const quick = html.indexOf('src/quick-re-expedition-ui.js');
  assert.ok(app >= 0 && quick > app);
});
