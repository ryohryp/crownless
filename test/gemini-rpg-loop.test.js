'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const loop = require('../src/gemini-rpg-loop.js');

function winFirstRun() {
  const s = loop.create();
  for (let i = 0; i < 3; i++) assert.equal(loop.claimMaterial(s), true);
  assert.equal(loop.clearWave(s), true);
  return s;
}

test('a finished three-goblin expedition banks only after explicit safe return', () => {
  const s = winFirstRun();
  assert.equal(s.unbanked, 3);
  assert.equal(s.banked, 0, 'defeating monsters alone cannot create owned material');
  assert.equal(loop.forge(s), false);
  assert.equal(loop.returnAlive(s, 60), true);
  assert.equal(s.unbanked, 0);
  assert.equal(s.banked, 3);
  assert.equal(s.phase, 'camp');
  assert.equal(loop.returnAlive(s, 60), false, 'repeated return cannot duplicate materials');
});

test('the smith alone crafts one weapon that remains equipped on subsequent excursions', () => {
  const s = winFirstRun();
  loop.returnAlive(s, 1);
  assert.equal(loop.forge(s), true);
  assert.equal(s.crafted, true);
  assert.equal(s.banked, 0);
  assert.equal(loop.forge(s), false, 'no second duplicate weapon');
  assert.equal(loop.depart(s), true);
  assert.equal(s.phase, 'fight');
  assert.equal(s.crafted, true);
});

test('pushing deeper keeps unbanked materials at risk and defeat loses this run only', () => {
  const s = winFirstRun();
  assert.equal(loop.pushDeeper(s), true);
  loop.claimMaterial(s);
  assert.equal(s.unbanked, 4);
  assert.equal(loop.loseExpedition(s), true);
  assert.equal(s.unbanked, 0);
  assert.equal(s.banked, 0);
  assert.equal(loop.returnAlive(s, 80), false, 'dead run cannot deposit material');
});

test('banked materials and crafted equipment survive a later defeat', () => {
  const s = winFirstRun();
  loop.returnAlive(s, 70);
  loop.forge(s);
  loop.depart(s);
  loop.claimMaterial(s);
  loop.loseExpedition(s);
  assert.equal(s.banked, 0);
  assert.equal(s.crafted, true);
});

test('invalid actions and zero-health returns never change the model', () => {
  const s = loop.create();
  assert.equal(loop.forge(s), false);
  assert.equal(loop.returnAlive(s, 140), false);
  assert.equal(loop.pushDeeper(s), false);
  assert.equal(loop.clearWave(s), true);
  assert.equal(loop.returnAlive(s, 0), false);
  assert.equal(loop.claimMaterial(s), true, 'finds remain collectible while roaming after victory');
  assert.equal(s.unbanked,1);
  assert.equal(s.phase, 'return');
});

test('the RPG progression model is intentionally session-only and location-free', () => {
  const s = loop.create();
  assert.deepEqual(Object.keys(s).some(key=>/latitude|longitude|gps|coordinate|storage|save/i.test(key)),false);
  assert.equal(loop.COST, 3);
});
