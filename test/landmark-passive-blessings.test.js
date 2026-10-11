'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

function siege(id, biome) {
  let s = E.discover({...E.initial(), mode:'demo'}, biome);
  return E.startLandmark(s, biome, id);
}
function conquer(id, biome) {
  const s = siege(id, biome);
  s.expedition.room = 4;
  s.expedition.stage = 'cleared';
  s.expedition.seals = [biome];
  return E.act(s, 'return');
}
function fightInWood(s) {
  const n = E.act(E.start({...s, report:null}, 'wood'), 'careful');
  assert.equal(n.expedition.stage, 'fight');
  // Fixed wolf opening: do not let a procedural intent obscure damage math.
  delete n.expedition.enemy.seed;
  n.expedition.enemy.turn = 0;
  n.expedition.enemy.hp = 100;
  n.expedition.enemy.maxHp = 100;
  return n;
}

test('ADR0012: discovery, retreat and unverified state never grant combat buffs', () => {
  assert.deepEqual(E.landmarkBlessings(E.initial()), {attack:0, defense:0});
  const started = siege('tokyo-tower','tower');
  assert.deepEqual(E.landmarkBlessings(started), {attack:0, defense:0});
  const returned = E.act(started, 'return');
  assert.deepEqual(returned.claimedLandmarks, []);
  assert.deepEqual(E.landmarkBlessings(returned), {attack:0, defense:0});
  assert.deepEqual(E.landmarkBlessings(E.parse('{bad')), {attack:0, defense:0});
  assert.deepEqual(E.landmarkBlessings({claimedLandmarks:['unknown-landmark']}), {attack:0, defense:0});
});

test('ADR0012: earned Tokyo Tower attack +1 works in another biome and after reload', () => {
  const won = conquer('tokyo-tower','tower');
  assert.deepEqual(E.landmarkBlessings(won), {attack:1, defense:0});
  const saved = E.parse(E.serialize(won));
  assert.deepEqual(E.landmarkBlessings(saved), {attack:1, defense:0});
  const blessed = fightInWood(saved);
  const ordinary = fightInWood({...saved,claimedLandmarks:[]});
  assert.equal(E.attackPreview(blessed,'strike'), E.attackPreview(ordinary,'strike') + 1);
  assert.equal(E.attackPreview(blessed,'heavy'), E.attackPreview(ordinary,'heavy') + 1);
  const hit = E.act(blessed,'strike'), normal = E.act(ordinary,'strike');
  assert.equal(blessed.expedition.enemy.hp - hit.expedition.enemy.hp,
    ordinary.expedition.enemy.hp - normal.expedition.enemy.hp + 1);
});

test('ADR0012: earned Osaka Castle prevents one actual hit, but not full block or retreat penalty', () => {
  const won = conquer('osaka-castle','wood');
  assert.deepEqual(E.landmarkBlessings(E.parse(E.serialize(won))), {attack:0, defense:1});
  const blessed = fightInWood(won);
  const ordinary = fightInWood({...won,claimedLandmarks:[]});
  assert.equal(E.intent(blessed.expedition.enemy).id,'quick');
  const guarded = E.act(blessed,'guard'), plainGuard = E.act(ordinary,'guard');
  assert.equal(guarded.expedition.hp,plainGuard.expedition.hp,'zero damage stays zero');
  const dodged = E.act(blessed,'dodge'), plainDodge = E.act(ordinary,'dodge');
  assert.equal(dodged.expedition.hp,plainDodge.expedition.hp + 1);
  assert.match(dodged.expedition.log.join(' '),/体力 −2/);
  assert.equal(E.act(blessed,'flee').report.hp,E.act(ordinary,'flee').report.hp);
});

test('ADR0012: duplicate control cannot stack and losing control removes effects immediately', () => {
  const both = {...E.initial(),claimedLandmarks:['tokyo-tower','tokyo-tower','osaka-castle','osaka-castle']};
  assert.deepEqual(E.landmarkBlessings(both),{attack:1,defense:1});
  assert.deepEqual(E.landmarkBlessings({...both,claimedLandmarks:['osaka-castle']}),{attack:0,defense:1});
  assert.deepEqual(E.landmarkBlessings({...both,claimedLandmarks:[]}),{attack:0,defense:0});
  assert.deepEqual(E.landmarkBlessings({...E.initial(),mode:'walk'}),{attack:0,defense:0});
});
