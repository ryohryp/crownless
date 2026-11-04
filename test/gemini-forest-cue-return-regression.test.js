'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/gemini-forest-discoveries.js');
const R = require('../src/gemini-rpg-loop.js');

test('a sensory lead never reveals or consumes a site, and its fang banks only after a living return', () => {
  const found = new Set(['traces']);
  const run = R.create();
  assert.equal(R.clearWave(run), true);
  const position = {x:850,z:270};
  assert.equal(D.cueNear(position, found)?.id, 'hollow');
  assert.equal(D.near(position, found), null, 'a distant sound cannot enable inspection');
  assert.equal(found.has('hollow'), false, 'hearing a clue does not discover a hidden site');
  assert.equal(R.claimMaterial(run), true);
  assert.equal(run.unbanked, 1);
  assert.equal(R.returnAlive(run, 1), true);
  assert.equal(run.banked, 1, 'only a living return secures the fang');
  assert.equal(run.unbanked, 0);
  assert.equal(R.depart(run), true);
  assert.equal(run.banked, 1, 'a new expedition preserves previously banked materials');
  assert.equal(run.unbanked, 0);
  assert.equal(R.claimMaterial(run), true);
  assert.equal(R.loseExpedition(run), true);
  assert.equal(run.banked, 1, 'defeat loses only the current expedition reward');
  assert.equal(run.unbanked, 0);
  assert.equal(found.has('hollow'), false, 'a hint cannot silently mark the gate discovered');
});

test('a nonliving return cannot bank provisional fangs or reopen a departed run', () => {
  const run = R.create();
  assert.equal(R.claimMaterial(run), true);
  assert.equal(R.clearWave(run), true);
  assert.equal(R.returnAlive(run, 0), false, 'zero HP is not a living return');
  assert.equal(R.returnAlive(run, -1), false, 'negative HP is not a living return');
  assert.equal(run.phase, 'return', 'a rejected return must not enter camp');
  assert.equal(run.banked, 0, 'a rejected return must not secure loot');
  assert.equal(run.unbanked, 1, 'provisional loot remains at risk');
  assert.equal(R.depart(run), false, 'cannot depart again before reaching camp');
  assert.equal(R.loseExpedition(run), true);
  assert.equal(run.phase, 'camp');
  assert.equal(run.banked, 0);
  assert.equal(run.unbanked, 0, 'defeat clears only provisional loot');
});

test('a shrine-first explorer senses tracks earlier but still must approach to discover them', () => {
  const found = new Set(['shrine']);
  const distant = {x:800,z:440}; // 75 units from tracks: cue-only, not inspectable.
  assert.equal(D.cueNear(distant, found)?.id, 'traces');
  assert.equal(D.near(distant, found), null);
  assert.equal(found.has('traces'), false);
  const close = {x:800,z:400}; // 35 units: deliberate inspection becomes possible.
  assert.equal(D.near(close, found)?.id, 'traces');
  assert.equal(found.has('traces'), false, 'proximity alone must not auto-discover tracks');
});
