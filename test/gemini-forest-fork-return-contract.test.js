'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const discoveries = require('../src/gemini-forest-discoveries.js');
const loop = require('../src/gemini-rpg-loop.js');

function inspect(found, spot, hp, choice) {
  const player = { x: spot.x, z: spot.z, state: 'IDLE' };
  return discoveries.uncover(player, found, 'return', hp, 140, false, choice);
}

function startClearedExpedition() {
  const run = loop.create();
  for (let i = 0; i < 3; i++) assert.equal(loop.claimMaterial(run), true);
  assert.equal(loop.clearWave(run), true);
  return run;
}

test('gate-first cautious detour makes the first sword possible only after a living return', () => {
  const run = startClearedExpedition();
  const found = new Set();
  const tracks = inspect(found, discoveries.spots[0], 140, 'auto');
  assert.equal(tracks.ok, true);
  assert.equal(tracks.material, 1);
  assert.equal(loop.claimMaterial(run), true);
  assert.equal(discoveries.guardianOpeningSeconds(found), 1.8,
    'tracks alone earn the shorter warning');

  const gate = inspect(found, discoveries.spots[2], 140, 'cautious');
  assert.equal(gate.ok, true);
  assert.equal(gate.damage, 6);
  assert.equal(gate.material, 1);
  assert.equal(gate.heal, 0);
  assert.equal(loop.claimMaterial(run), true);
  assert.equal(discoveries.guardianOpeningSeconds(found), 2.4,
    'the costly gate-first detour earns a real later tactical consequence');
  assert.equal(inspect(found, discoveries.spots[2], 134, 'heal').ok, false,
    'the same gate cannot also provide healing');
  assert.equal(run.unbanked, 5);
  assert.equal(run.banked, 0);
  assert.equal(loop.forge(run), false, 'provisional loot cannot be spent at the smith');

  assert.equal(loop.returnAlive(run, 134), true);
  assert.equal(run.unbanked, 0);
  assert.equal(run.banked, 5);
  assert.equal(loop.forge(run), true);
  assert.equal(run.crafted, true);
  assert.equal(run.banked, 2);
  assert.equal(loop.depart(run), true, 'the new sword creates a concrete next expedition');
  assert.equal(run.crafted, true);
});

test('the same gate-first loot is lost on defeat, without removing a previously forged sword', () => {
  const run = startClearedExpedition();
  assert.equal(loop.returnAlive(run, 100), true);
  assert.equal(loop.forge(run), true);
  assert.equal(loop.depart(run), true);
  for (let i = 0; i < 3; i++) assert.equal(loop.claimMaterial(run), true);
  assert.equal(loop.clearWave(run), true);
  const found = new Set();
  for (const [spot, choice] of [[discoveries.spots[0], 'auto'], [discoveries.spots[2], 'cautious']]) {
    const result = inspect(found, spot, 140, choice);
    assert.equal(result.ok, true);
    assert.equal(result.material, 1);
    assert.equal(loop.claimMaterial(run), true);
  }
  assert.equal(run.unbanked, 5);
  assert.equal(loop.loseExpedition(run), true);
  assert.equal(run.unbanked, 0);
  assert.equal(run.banked, 0);
  assert.equal(run.crafted, true, 'previously earned equipment survives the failed run');
  assert.equal(loop.returnAlive(run, 140), false, 'defeat cannot bank the lost materials');
});
