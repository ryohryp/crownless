const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('expedition.html', 'utf8');
const ui = fs.readFileSync('src/hidden-shortcut-ui.js', 'utf8');

test('expedition loads shortcut primitive before its departure UI', () => {
  const primitive = html.indexOf('src/hidden-shortcut.js');
  const app = html.indexOf('src/slice-app.js');
  const choiceUi = html.indexOf('src/hidden-shortcut-ui.js');
  assert.ok(primitive >= 0);
  assert.ok(app > primitive);
  assert.ok(choiceUi > app);
});

test('departure UI keeps normal route default and exposes shortcut tradeoff', () => {
  assert.match(ui, /let routeChoice = 'normal'/);
  assert.match(ui, /通常ルート/);
  assert.match(ui, /浅層の戦利品機会を残す/);
  assert.match(ui, /近道を使う/);
  assert.match(ui, /浅層1区画を飛ばす · 戦利品機会を失う/);
  assert.match(ui, /Shortcut\.applyToExpedition\(next, 'shortcut'\)/);
});