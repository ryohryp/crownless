const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('unbanked loot compares itself with the equipped weapon', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'slice-app.js'), 'utf8');
  assert.ok(source.includes('未帰還 · ${E.gearText(state,g)}'));
  assert.ok(source.includes('現在：${E.GEAR[state.equipped].name} · ${E.gearText(state,state.equipped)}'));
});
