const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Memory = require('../src/region-memory.js');

test('remembers visits, deepest reach, discovery and representative loot', () => {
  let memory = Memory.remember([], '35.68,139.77', { depth: 1, place: '囁きの森', newGear: [{ name: '灰枝の剣' }] });
  memory = Memory.remember(memory, '35.68,139.77', { depth: 3, place: '囁きの森', newGear: [] });
  assert.equal(memory.length, 1);
  assert.deepEqual(memory[0], { region: '35.68,139.77', visits: 2, maxDepth: 3, discovery: '囁きの森', loot: '灰枝の剣' });
  assert.match(Memory.summary(memory, '35.68,139.77').title, /2回/);
  assert.match(Memory.summary(memory, '35.68,139.77').text, /最深部 3/);
});

test('keeps only the newest 24 coarse regions', () => {
  let memory = [];
  for (let i = 0; i < 30; i++) memory = Memory.remember(memory, `region-${i}`, { depth: 1 });
  assert.equal(memory.length, 24);
  assert.equal(memory[0].region, 'region-6');
  assert.equal(memory.at(-1).region, 'region-29');
});

test('playable slice loads persistence and player-facing wiring', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'expedition.html'), 'utf8');
  assert.match(html, /src\/region-memory\.js/);
  assert.match(html, /src\/region-memory-ui\.js/);
  assert.ok(html.indexOf('src/region-memory.js') < html.indexOf('src/region-memory-ui.js'));
});
