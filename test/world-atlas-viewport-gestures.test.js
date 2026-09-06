const test = require("node:test");
const assert = require("node:assert/strict");

const Gestures = require("../src/world-atlas-viewport-gestures.js");

test("Atlas pan stays bounded so the parchment keeps covering the viewport", () => {
  assert.deepEqual(
    Gestures.clampTransform({ scale: 1, x: 100, y: -100 }, { width: 400, height: 300 }),
    { scale: 1, x: 0, y: 0 }
  );
  assert.deepEqual(
    Gestures.clampTransform({ scale: 2, x: 999, y: -999 }, { width: 400, height: 300 }),
    { scale: 2, x: 200, y: -150 }
  );
});

test("Atlas pinch zoom keeps the gesture midpoint anchored", () => {
  const next = Gestures.pinchTransform(
    { distance: 100, midpoint: { x: 300, y: 150 }, scale: 1, x: 0, y: 0 },
    { distance: 200, midpoint: { x: 300, y: 150 } },
    { width: 400, height: 300 }
  );

  assert.equal(next.scale, 2);
  assert.equal(next.x, -100);
  assert.equal(next.y, 0);
});

test("Atlas pinch zoom is limited to the supported 1x through 4x range", () => {
  const zoomedOut = Gestures.pinchTransform(
    { distance: 100, midpoint: { x: 200, y: 150 }, scale: 1, x: 0, y: 0 },
    { distance: 10, midpoint: { x: 200, y: 150 } },
    { width: 400, height: 300 }
  );
  const zoomedIn = Gestures.pinchTransform(
    { distance: 100, midpoint: { x: 200, y: 150 }, scale: 3, x: 0, y: 0 },
    { distance: 1000, midpoint: { x: 200, y: 150 } },
    { width: 400, height: 300 }
  );

  assert.equal(zoomedOut.scale, 1);
  assert.equal(zoomedIn.scale, 4);
});
