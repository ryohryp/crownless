'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function trackMarks(found) {
  const window = {};
  const ground = {
    fillRect() {},
    createRadialGradient() { return { addColorStop() {} }; }
  };
  const context = {
    window,
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
    document: { createElement() { return { getContext() { return ground; } }; } }
  };
  vm.runInNewContext(fs.readFileSync('src/pixel-forest.js', 'utf8'), context);
  const marks = [];
  window.CrownlessPixelForest.create().trail(
    { fillRect(...args) { marks.push(args); } }, found
  );
  return marks;
}

test('reading forest tracks reveals two broken visual leads, never an unearned destination', () => {
  assert.deepEqual(trackMarks(new Set()), [], 'undiscovered tracks cannot paint a route');
  assert.deepEqual(trackMarks(new Set(['shrine'])), [], 'other discoveries do not unlock footprints');
  const found = new Set(['traces']);
  const marks = trackMarks(found);
  assert.equal(marks.length, 28, 'two seven-step leads, two marks per step');
  assert(marks.some(([x]) => x < 750), 'one lead veers left');
  assert(marks.some(([x]) => x > 850), 'another lead veers right');
  assert(marks.every(([x, z, w, h]) =>
    x >= 710 && x < 900 && z >= 270 && z <= 360 && w <= 6 && h <= 4
  ), 'both leads end before either uninspected site; no route overlay');
  assert.deepEqual(trackMarks(found), marks, 'the clue is stable, not a flashing nav arrow');
  assert.deepEqual([...found], ['traces'], 'rendering cannot discover a site or claim loot');
  assert.deepEqual(trackMarks(new Set(['traces', 'hollow'])), marks,
    'site rewards and discoveries never rewrite the physical tracks');
});
