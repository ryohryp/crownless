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
    cue: null,
    state: { forestFinds: new Set(['traces']) },
    rpg: { crafted: false, phase: 'return', unbanked: 2 }
  });
  assert.match(label, /二手に分かれ/);
  assert.match(label, /牙2個未帰還/, 'the fork decision must show unsecured loot at stake');
  assert.match(label, /足場を見切った。どちらを追う/, 'earned footing is acknowledged without naming either environmental branch');
  assert.doesNotMatch(label, /負傷を3軽減|HP -\d/, 'the surprise stays hidden until the actual choice');
  assert.doesNotMatch(label, /石門|祠|右|左|茨を調べ|新しい剣/,
    'the HUD must not preselect the destination or spoil either branch');
});

test('the field HUD keeps the unvisited fork visible after either first discovery', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const label=guardian' + String.fromCharCode(10));
  const end = html.indexOf('    if(hint.textContent!==label)', start);
  assert(start >= 0 && end > start, 'evaluate the live HUD, not a duplicate hint rule');
  const labelFor = (ids, cue = null, unbanked = 2) => vm.runInNewContext(html.slice(start, end) + String.fromCharCode(10) + 'label', {
    guardian: null,
    near: null,
    cue,
    ginji: { x: 790, z: 230 },
    state: { forestFinds: new Set(ids) },
    rpg: { crafted: false, phase: 'return', unbanked }
  });
  const breeze = labelFor(['traces', 'hollow', 'hollow-scout'], { id: 'shrine', x: 660, z: 230 });
  assert.match(breeze, /冷たい風が頬をかすめる/,
    'earned distant shrine air stays visible after the one-shot popup');
  assert.doesNotMatch(breeze, /苔むす祠|石門|祠|右|左|道順/,
    'distant air must not reveal a destination or route');
  const both = labelFor(['traces']);
  assert.match(both, /二手に分かれ/, 'both branches remain a player choice');
  assert.match(both, /牙2個未帰還/, 'a live bag makes the fork a return-or-risk decision');
  assert.doesNotMatch(labelFor(['traces'], null, 0), /未帰還/, 'an empty bag cannot imply loot at risk');
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
  assert.match(scoutedMoss, /探索か帰還か.*牙2個未帰還/,
    'after gate scouting, the player can weigh the unbanked bag against further risk');
  assert.doesNotMatch(labelFor(['traces', 'hollow', 'hollow-scout'], null, 0), /未帰還/,
    'an empty bag cannot suggest unsecured fangs');
  assert(labelFor(['traces', 'hollow', 'hollow-scout'], null, 12).length<=40,
    'the scouted risk/return cue remains compact for 360px phones');
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


test('completed forest discoveries never resurrect fork directions or unsecured loot', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const label=guardian' + String.fromCharCode(10));
  const end = html.indexOf('    if(hint.textContent!==label)', start);
  assert(start >= 0 && end > start, 'read the current HUD expression');
  const label = vm.runInNewContext(html.slice(start, end) + '\nlabel', {
    guardian: null, near: null, cue: null,
    state: { forestFinds: new Set(['traces', 'shrine', 'hollow']) },
    rpg: { crafted: false, phase: 'return', unbanked: 0 }
  });
  assert.doesNotMatch(label, /二手に分かれ|苔の湿り|茨が軋んで/,
    'a completed fork must not prompt another search');
  assert.doesNotMatch(label, /未帰還|石門|祠|右|左/,
    'an empty bag and fully inspected sites cannot imply risk or reveal a route');
});


test('guardian transition never falls through to undiscovered forest clues', () => {
  const html = fs.readFileSync('gemini-feel-lab.html', 'utf8');
  const start = html.indexOf('    const label=guardian' + String.fromCharCode(10));
  const end = html.indexOf('    if(hint.textContent!==label)', start);
  assert(start >= 0 && end > start, 'read live forest HUD expression');
  const label = vm.runInNewContext(html.slice(start, end) + '\nlabel', {
    guardian: null, rpg: { phase: 'fight', unbanked: 1, crafted: false },
    near: null, cue: null, state: { forestFinds: new Set(['traces']) }
  });
  assert.match(label, /戦闘中/);
  assert.doesNotMatch(label, /苔の湿り|茨|気になる地点|未帰還/);
});
