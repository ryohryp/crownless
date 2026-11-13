const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const bridge = require('../src/hd2d-bridge-scene.js');

test('candidate bridge artwork tracks real world coordinates while the camera moves', () => {
  const first = bridge.composition(0, 390);
  const next = bridge.composition(200, 390);
  assert.ok(first.x === 0);
  assert.equal(next.x, -200);
  assert.equal(first.width, bridge.WORLD_WIDTH);
  assert.equal(first.height, bridge.DRAW_HEIGHT);
  assert.equal(next.visibleWidth, 390);
});

test('HD-2D preview is opt-in and uses original playable forest engine', () => {
  const html = fs.readFileSync(path.join(__dirname, '../gemini-feel-lab.html'), 'utf8');
  assert.match(html, /fxParams\.get\('art'\) === 'bridge'/);
  assert.match(html, /bridgeArt\.background/);
  assert.match(html, /bridgeArt\.foreground/);
  assert.match(html, /forestArt\.trail\(ctx,state\.forestFinds\)/);
  assert.match(html, /getGroundHeightAt\(f\.x, f\.z\)/);
  assert.ok(fs.statSync(path.join(__dirname, '../assets/action-forest/bridge-hd2d-candidate-v1.webp')).size > 10000);
});
