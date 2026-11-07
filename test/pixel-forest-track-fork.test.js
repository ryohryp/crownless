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
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } addEventListener() {} },
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

test('the field HUD keeps the unvisited fork visible after either first discovery', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const label=guardian' + String.fromCharCode(10));
  const end = html.indexOf('    if(hint.textContent!==label)', start);
  assert(start >= 0 && end > start, 'evaluate the live HUD, not a duplicate hint rule');
  const labelFor = ids => vm.runInNewContext(html.slice(start, end) + String.fromCharCode(10) + 'label', {
    guardian: null,
    near: null,
    state: { forestFinds: new Set(ids) },
    rpg: { crafted: false, phase: 'return', unbanked: 2 }
  });
  const both = labelFor(['traces']);
  assert.match(both, /二手に分かれ/, 'both branches remain a player choice');
  assert(both.length<=40, 'fork HUD stays compact over a 360px phone scene');
  assert.doesNotMatch(both, /石門|祠|苔|茨|右|左/, 'fork HUD asks players to notice environmental signs themselves');
  const moss = labelFor(['traces', 'hollow']);
  assert.match(moss, /苔の湿り/, 'investigating the thorn side leaves the moss clue');
  assert.doesNotMatch(moss, /茨が軋んで/, 'do not repeat an already inspected lead');
  const scoutedMoss = labelFor(['traces', 'hollow', 'hollow-scout']);
  assert.match(scoutedMoss, /苔の湿り/,
    'gate-first scouting must not bury the remaining sensory clue');
  assert.match(scoutedMoss, /先手猶予 \+0\.6秒/,
    'the earned tactical payoff remains visible without naming the next site');
  assert.doesNotMatch(scoutedMoss, /石門|祠|右|左|道順/,
    'scouting does not grant navigation or reveal an uninspected location');
  const thorns = labelFor(['traces', 'shrine']);
  assert.match(thorns, /茨が軋んで/, 'investigating the moss side leaves the thorn clue');
  assert.doesNotMatch(thorns, /苔の湿り/, 'do not repeat an already inspected lead');
  for (const hint of [both, moss, thorns]) {
    assert.doesNotMatch(hint, /石門|祠|右|左/, 'no unearned site identity or route');
  }
  assert.match(labelFor(['traces', 'shrine', 'hollow']), /未帰還の牙 2個/,
    'after both inspections, the ordinary safe-return stakes resume');
});

test('bridge is safe before atlas load and rebakes its stone grain after load', () => {
  const images = [];
  const canvases = [];
  const drawCalls = [];
  class FakeImage {
    constructor() { this.complete = false; this.naturalWidth = 0; this.listeners = {}; images.push(this); }
    addEventListener(type, callback) { this.listeners[type] = callback; }
  }
  function surface() {
    const context = new Proxy({ drawImage(...args) { drawCalls.push(args); } }, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
        return () => {};
      }
    });
    const canvas = { width: 0, height: 0, getContext: () => context };
    canvases.push(canvas);
    return canvas;
  }
  const window = {};
  vm.runInNewContext(fs.readFileSync('src/pixel-forest.js', 'utf8'), {
    window, Image: FakeImage, document: { createElement: surface }
  });
  const scene = window.CrownlessPixelForest.create();
  const screen = surface().getContext('2d');
  const heightAt = () => 0;
  assert.doesNotThrow(() => scene.ground(screen, heightAt), 'unloaded atlas must not abort first paint');
  const firstBridge = canvases.find(canvas => canvas.width === 600);
  assert(firstBridge, 'first bridge fallback is baked');
  assert.equal(drawCalls.some(args => args[0] === images[1]), false,
    'unloaded atlas is never passed to drawImage');
  // Repeated frames before image load must reuse the fallback instead of
  // allocating a new bridge surface on every animation frame.
  scene.ground(screen, heightAt);
  assert.equal(canvases.filter(canvas => canvas.width === 600).length, 1,
    'pending atlas load keeps the same fallback bridge cache');
  // A broken image can be complete with zero intrinsic width. It must not
  // be treated as a loaded atlas or trigger an invalid canvas draw.
  images[1].complete = true;
  images[1].naturalWidth = 0;
  assert.doesNotThrow(() => scene.ground(screen, heightAt),
    'broken atlas remains on the safe fallback');
  assert.equal(canvases.filter(canvas => canvas.width === 600).length, 1,
    'broken atlas does not rebake the fallback every frame');
  assert.equal(drawCalls.some(args => args[0] === images[1]), false,
    'broken atlas is never passed to drawImage');
  images[1].naturalWidth = 1536;
  images[1].listeners.load();
  assert.doesNotThrow(() => scene.ground(screen, heightAt));
  const bridges = canvases.filter(canvas => canvas.width === 600);
  assert.equal(bridges.length, 2, 'atlas load invalidates exactly one bridge cache');
  assert.notEqual(bridges[0], bridges[1], 'the cached fallback must be replaced');
  assert(drawCalls.some(args => args[0] === images[1]),
    'rebaked bridge uses the now-loaded stone atlas');
  scene.ground(screen, heightAt);
  assert.equal(canvases.filter(canvas => canvas.width === 600).length, 2,
    'subsequent frames reuse the textured bridge without rebaking');
});
