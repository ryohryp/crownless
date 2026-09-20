'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const F = require('../src/forked-depth.js');

function clearedAt(depth = 1) {
  const s = E.initial();
  s.mode = 'demo';
  s.expedition = { place:'wood', depth, room:4, hp:20, stamina:3, focus:0, potions:2, scrap:5, gear:[], seals:['wood'], enemy:null, stage:'cleared', log:[] };
  return s;
}

test('fork is offered only after first-depth clear', () => {
  assert.equal(F.canFork(clearedAt(1)), true);
  assert.equal(F.canFork(clearedAt(2)), false);
  const s = clearedAt(1); s.expedition.stage = 'path';
  assert.equal(F.canFork(s), false);
});

test('danger route enters depth 2 at a combat-bearing room', () => {
  const engine = { act: E.act };
  F.install(engine);
  const n = engine.act(clearedAt(1), 'fork-danger');
  assert.equal(n.expedition.depth, 2);
  assert.equal(n.expedition.room, 0);
  assert.equal(n.expedition.stage, 'path');
  assert.match(n.expedition.log[0], /敵の気配/);
});

test('mystery route enters depth 2 at an exploration room', () => {
  const engine = { act: E.act };
  F.install(engine);
  const n = engine.act(clearedAt(1), 'fork-mystery');
  assert.equal(n.expedition.depth, 2);
  assert.equal(n.expedition.room, 1);
  assert.equal(n.expedition.stage, 'path');
  assert.match(n.expedition.log[0], /調べる余地/);
});

test('invalid timing falls through without creating a fork', () => {
  const engine = { act: E.act };
  F.install(engine);
  const s = clearedAt(2);
  assert.deepEqual(engine.act(s, 'fork-danger'), s);
});
