const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('src/upgrade-visual.js', 'utf8');
const html = fs.readFileSync('expedition.html', 'utf8');

test('reinforcement visual is loaded after the playable slice renderer', () => {
  assert.match(html, /src\/slice-app\.js[\s\S]*src\/upgrade-visual\.js/);
});

test('reinforcement marker scales with the equipped weapon level and avoids duplicate marks', () => {
  assert.match(source, /E\.weaponLevel\(state, state\.equipped\)/);
  assert.match(source, /Array\.from\(\{ length: level \}/);
  assert.match(source, /svg:not\(\[data-reinforced\]\)/);
  assert.match(source, /data-upgrade-mark/);
});

test('unreinforced equipment receives no visual marker', () => {
  assert.match(source, /if \(!level\) return;/);
});