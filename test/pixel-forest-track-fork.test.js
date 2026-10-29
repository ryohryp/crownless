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
  const paint = {
    fillStyle: '',
    fillRect(...args) { marks.push({ rect: args, ink: this.fillStyle }); }
  };
  window.CrownlessPixelForest.create().trail(paint, found);
  return marks;
}

test('reading forest tracks reveals two broken visual leads, never an unearned destination', () => {
  assert.deepEqual(trackMarks(new Set()), [], 'undiscovered tracks cannot paint a route');
  assert.deepEqual(trackMarks(new Set(['shrine'])), [], 'other discoveries do not unlock footprints');
  const found = new Set(['traces']);
  const marks = trackMarks(found);
  assert.equal(marks.length, 36, 'two seven-step leads with sparse branch-specific signs');
  assert(marks.some(({rect:[x]}) => x < 750), 'one lead veers left');
  assert(marks.some(({rect:[x]}) => x > 850), 'another lead veers right');
  assert(marks.every(({rect:[x, z, w, h]}) =>
    x >= 710 && x < 900 && z >= 270 && z <= 360 && w <= 6 && h <= 4
  ), 'both leads end before either uninspected site; no route overlay');
  assert.deepEqual(trackMarks(found), marks, 'the clue is stable, not a flashing nav arrow');
  assert.deepEqual([...found], ['traces'], 'rendering cannot discover a site or claim loot');
  assert.deepEqual(trackMarks(new Set(['traces', 'hollow'])), marks,
    'site rewards and discoveries never rewrite the physical tracks');
});

test('fork signs differ by environmental evidence, not destination labels or arrows', () => {
  const marks = trackMarks(new Set(['traces']));
  const moss = marks.filter(mark => mark.ink === '#617459');
  const thorns = marks.filter(mark => mark.ink === '#6d5343');
  assert.equal(moss.length, 4, 'the left lead carries two small moss flecks');
  assert.equal(thorns.length, 4, 'the right lead carries two snapped-thorn marks');
  assert(moss.every(({rect:[x]}) => x < 800), 'moss stays on the left branch');
  assert(thorns.every(({rect:[x]}) => x > 800), 'thorn signs stay on the right branch');
  assert(moss.every(({rect:[, , w, h]}) => w <= 3 && h <= 3),
    'moss clues stay small enough not to read as path arrows');
  assert(thorns.every(({rect:[, , w, h]}) => w <= 5 && h <= 4),
    'thorn clues stay small enough not to read as path arrows');
  assert.deepEqual(trackMarks(new Set()), [], 'unread tracks reveal neither branch sign');
});
