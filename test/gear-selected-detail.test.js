const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('gear fitting view loads selected gear detail enhancement', () => {
  const html = fs.readFileSync('expedition.html', 'utf8');
  const script = fs.readFileSync('src/gear-selected-detail.js', 'utf8');
  assert.match(html, /src\/gear-selected-detail\.js/);
  assert.match(script, /active\[data-value="gear"\]/);
  assert.match(script, /E\.gearText\(state, state\.equipped\)/);
  assert.match(script, /data-selected-gear-detail/);
  assert.match(script, /role', 'status'/);
});
