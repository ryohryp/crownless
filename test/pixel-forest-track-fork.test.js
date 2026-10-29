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
    x >= 710 && x < 900 && z >= 270 && z <= 360 && w <= 8 && h <= 7
  ), 'both leads end before either uninspected site; no route overlay');
  assert.deepEqual(trackMarks(found), marks, 'the clue is stable, not a flashing nav arrow');
  assert.deepEqual([...found], ['traces'], 'rendering cannot discover a site or claim loot');
  assert.deepEqual(trackMarks(new Set(['traces', 'hollow'])), marks,
    'site rewards and discoveries never rewrite the physical tracks');
});

test('fork signs differ by environmental evidence, not destination labels or arrows', () => {
  const marks = trackMarks(new Set(['traces']));
  const moss = marks.filter(mark => mark.ink === '#a2c087');
  const thorns = marks.filter(mark => mark.ink === '#c78b67');
  assert.equal(moss.length, 4, 'the left lead carries two small moss flecks');
  assert.equal(thorns.length, 4, 'the right lead carries two snapped-thorn marks');
  assert(moss.every(({rect:[x]}) => x < 800), 'moss stays on the left branch');
  assert(thorns.every(({rect:[x]}) => x > 800), 'thorn signs stay on the right branch');
  assert(moss.every(({rect:[, , w, h]}) => w <= 6 && h <= 5),
    'moss clues stay small enough not to read as path arrows');
  assert(thorns.every(({rect:[, , w, h]}) => w <= 8 && h <= 7),
    'thorn clues stay small enough not to read as path arrows');
  assert(moss.some(({rect:[, , w, h]}) => w >= 6 && h >= 4),
    'moss must be large enough to notice on a phone, not a 2px fleck');
  assert(thorns.some(({rect:[, , w]}) => w >= 8),
    'snapped thorns must remain distinct from moss at phone scale');
  assert.deepEqual(trackMarks(new Set()), [], 'unread tracks reveal neither branch sign');
});

test('the live post-track HUD asks for observation, not a prescribed gate route', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const label=guardian\\n'.replace('\\n', '\n'));
  const end = html.indexOf('    if(hint.textContent!==label)', start);
  assert(start >= 0 && end > start, 'evaluate the real forest HUD label expression');
  const label = vm.runInNewContext(html.slice(start, end) + '\nlabel', {
    guardian: null,
    near: null,
    state: { forestFinds: new Set(['traces']) },
    rpg: { crafted: false, phase: 'return', unbanked: 2 }
  });
  assert.match(label, /二手に分かれ/);
  assert.match(label, /負傷 -3/, 'earned footing bonus remains legible');
  assert.doesNotMatch(label, /石門|祠|右|左|茨を調べ|新しい剣/,
    'the HUD must not preselect the destination or spoil either branch');
});
