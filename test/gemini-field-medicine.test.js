const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/gemini-rpg-loop.js');

test('field medicine costs provisional loot and forces another wave', () => {
  const s = rules.create();
  rules.claimMaterial(s);
  rules.claimMaterial(s);
  rules.clearWave(s);
  const hp = rules.useFieldMedicine(s, 60, 140);
  assert.equal(hp, 95);
  assert.equal(s.unbanked, 1);
  assert.equal(s.phase, 'fight');
  assert.equal(rules.useFieldMedicine(s, 95, 140), null);
  rules.loseExpedition(s);
  assert.equal(s.unbanked, 0);
  assert.equal(s.banked, 0);
});

test('medicine cannot consume warehouse or heal at full health', () => {
  const s = rules.create();
  rules.claimMaterial(s);
  rules.clearWave(s);
  assert.equal(rules.useFieldMedicine(s, 140, 140), null);
  assert.equal(rules.useFieldMedicine(s, 0, 140), null);
  assert.equal(s.unbanked, 1);
  assert.equal(rules.returnAlive(s, 100), true);
  assert.equal(s.banked, 1);
  assert.equal(rules.useFieldMedicine(s, 50, 140), null);
  assert.equal(s.banked, 1);
});

test('healing clamps to max and leaves remaining loot returnable', () => {
  const s = rules.create();
  rules.claimMaterial(s);
  rules.claimMaterial(s);
  rules.clearWave(s);
  assert.equal(rules.useFieldMedicine(s, 130, 140), 140);
  rules.clearWave(s);
  assert.equal(rules.returnAlive(s, 140), true);
  assert.equal(s.banked, 1);
});

test('patrol diversion spends only unbanked loot and makes a new wave', () => {
  const s = rules.create();
  assert.equal(rules.lurePatrol(s), false);
  rules.claimMaterial(s);
  rules.claimMaterial(s);
  rules.clearWave(s);
  assert.equal(rules.lurePatrol(s), true);
  assert.equal(s.phase, 'fight');
  assert.equal(s.unbanked, 1);
  assert.equal(rules.lurePatrol(s), false);
  rules.loseExpedition(s);
  assert.equal(s.unbanked, 0);
  assert.equal(s.banked, 0);
});

test('diversion cannot spend warehouse loot', () => {
  const s = rules.create();
  rules.claimMaterial(s);
  rules.clearWave(s);
  rules.returnAlive(s, 50);
  assert.equal(s.banked, 1);
  assert.equal(rules.lurePatrol(s), false);
  assert.equal(s.banked, 1);
});
