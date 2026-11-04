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
