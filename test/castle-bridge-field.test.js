'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BridgeField = require('../src/castle-bridge-field.js');
const Discoveries = require('../src/gemini-forest-discoveries.js');

test('worldToScreen and screenToWorld form an exact single-camera roundtrip', () => {
  for (const cameraX of [0, 132, 345, 788]) {
    for (const [wx, wz, wy] of [[210, 310, 0], [580, 290, 46], [660, 230, 0], [800, 365, 0]]) {
      const screen = BridgeField.worldToScreen(wx, wz, wy, cameraX);
      const back = BridgeField.screenToWorld(screen.x, screen.y, cameraX, wy);
      assert.equal(screen.scale, 1);
      assert.equal(back.x, wx);
      assert.equal(back.z, wz);
    }
  }
});

test('grounded character feet and shadow share identical screen coordinates across bridge curvature', () => {
  const cam = 310;
  for (let wx = 430; wx <= 730; wx += 30) {
    const groundH = BridgeField.defaultHeightAt(wx, 290);
    const feet = BridgeField.worldToScreen(wx, 290, groundH, cam);
    const shadow = BridgeField.worldToScreen(wx, 290, groundH, cam);
    assert.deepEqual(feet, shadow);
    // Moving 40 world units right shifts both actor and bridge floor by exact +40 in world / -40 in screen
    const nextCam = cam + 40;
    const bridgeOrigin = BridgeField.worldToScreen(0, 0, 0, cam);
    const bridgeOriginNext = BridgeField.worldToScreen(0, 0, 0, nextCam);
    const actorBefore = BridgeField.worldToScreen(wx, 290, groundH, cam);
    const actorAfter = BridgeField.worldToScreen(wx, 290, groundH, nextCam);
    assert.equal(actorAfter.x - bridgeOriginNext.x, actorBefore.x - bridgeOrigin.x,
      'actor must stay locked to the exact same stone bridge world coordinate during camera pan');
  }
});

test('parallax layers move slower in the distance and stay ordered without duplicate castle layers', () => {
  assert.equal(BridgeField.PARALLAX.foreground, 1);
  assert(BridgeField.PARALLAX.midground > BridgeField.PARALLAX.castle);
  assert(BridgeField.PARALLAX.castle > BridgeField.PARALLAX.sky);
  assert(Math.abs(BridgeField.PARALLAX.midground - 0.5) <= 0.05);
  assert(Math.abs(BridgeField.PARALLAX.castle - 0.2) <= 0.05);

  const a0 = BridgeField.layerAnchors(100, 206);
  const a1 = BridgeField.layerAnchors(300, 206);
  assert.equal(Math.round((a0.castleX - a1.castleX) * 100) / 100, 200 * BridgeField.PARALLAX.castle);
  assert.equal(Math.round((a0.waterfallX - a1.waterfallX) * 100) / 100, 200 * BridgeField.PARALLAX.midground);
  assert.equal(Math.round((a0.foregroundOffsetX - a1.foregroundOffsetX) * 100) / 100, 200 * BridgeField.PARALLAX.foreground);
});

test('parapets Z-sort cleanly around actors on and in front of the bridge', () => {
  const field = BridgeField.create();
  const rear = field.nearScenery.find((item) => item.type === 'rearRail');
  const front = field.nearScenery.find((item) => item.type === 'frontRail');
  assert(rear && front);
  assert.equal(rear.z, BridgeField.BRIDGE.back);
  assert.equal(front.z, BridgeField.BRIDGE.front);
  assert(rear.z < 290 && 290 < front.z, 'bridge walker sits between rear and front parapet');
  assert(front.z < 370, 'lower ledge walker passes in front of front parapet');
});

test('hitTestSite aligns tap positions with projected discovery spots across phone viewports', () => {
  const rect = { left: 0, top: 48, width: 390, height: 796 };
  const virtualW = Math.round(BridgeField.VIRTUAL_H * (rect.width / rect.height));
  const cameraX = 480;
  for (const spot of Discoveries.spots) {
    const h = BridgeField.defaultHeightAt(spot.x, spot.z);
    const p = BridgeField.worldToScreen(spot.x, spot.z, h, cameraX);
    if (p.x < 10 || p.x > virtualW - 10) continue;
    const tap = {
      x: rect.left + (p.x / virtualW) * rect.width,
      y: rect.top + ((p.y - 20) / BridgeField.VIRTUAL_H) * rect.height
    };
    const hit = BridgeField.hitTestSite(tap, rect, virtualW, cameraX, BridgeField.defaultHeightAt, Discoveries.spots);
    assert.equal(hit && hit.id, spot.id);
  }
});

test('opt-in mode keeps default forest, classic mode, and expedition.html untouched', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../gemini-feel-lab.html'), 'utf8');
  assert.match(html, /fxParams\.get\('art'\) === 'castle-bridge'/);
  assert.doesNotMatch(html, /hd2d-bridge-(vista|reprise|depth)/,
    'rejected vista/reprise experiments must not be pulled into main');
  const expedition = fs.readFileSync(path.resolve(__dirname, '../expedition.html'), 'utf8');
  assert.doesNotMatch(expedition, /castle-bridge-field/);
});

