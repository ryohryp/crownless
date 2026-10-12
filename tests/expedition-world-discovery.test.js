const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

function startWood() {
  const state = E.initial();
  state.mode = 'demo';
  return E.start(state, 'wood');
}

test('one deliberate discovery: unsafe cache yields bankable scrap, only once', () => {
  const start = startWood();
  const found = E.act(start, 'scout-cache');
  assert.notEqual(found, start);
  assert.equal(found.expedition.discovery, 'cache');
  assert.equal(found.expedition.hp, start.expedition.hp - 3);
  assert.equal(found.expedition.scrap, 3);
  assert.equal(E.act(found, 'scout-cache'), found, 'cannot farm the same clue');
  assert.equal(E.act(found, 'scout-tracks'), found, 'cannot collect both discovery choices');
  const loaded = E.parse(E.serialize(found));
  assert.equal(loaded.expedition.discovery, 'cache', 'the find survives normal save validation');
  assert.equal(E.act(loaded, 'scout-tracks'), loaded, 'the other choice is still locked after reload');
  const returned = E.act(loaded, 'return');
  assert.equal(returned.expedition, null);
  assert.equal(returned.report.scrap, 3);
  assert.equal(returned.scrap, 3, 'actual carried iron arrives only on safe return');
});

test('studying tracks makes the next real attack stronger instead of giving scrap', () => {
  const start = startWood();
  const studied = E.act(start, 'scout-tracks');
  assert.equal(studied.expedition.discovery, 'tracks');
  assert.equal(studied.expedition.focus, 3);
  assert.equal(studied.expedition.scrap, 0);
  assert.equal(studied.expedition.hp, start.expedition.hp);
  assert.equal(E.act(studied, 'scout-cache'), studied);
  const fight = E.act(studied, 'careful');
  const baseline = E.act(start, 'careful');
  assert.equal(fight.expedition.stage, 'fight');
  assert.equal(E.attackPreview(fight,'strike') - E.attackPreview(baseline,'strike'),3,
    'the examined ground actually informs combat damage');
  assert.equal(E.parse(E.serialize(fight)).expedition.discovery,'tracks');
});

test('a discovery cannot be triggered during combat, after walking on or in deeper floors', () => {
  const start = startWood();
  const fighting = E.act(start,'careful');
  assert.equal(E.act(fighting,'scout-cache'),fighting);
  const atNextRoom = startWood();
  atNextRoom.expedition.room = 2;
  assert.equal(E.act(atNextRoom,'scout-tracks'),atNextRoom);
  const deep = startWood();
  deep.expedition.depth = 2;
  assert.equal(E.act(deep,'scout-cache'),deep);
  const lowHp = startWood();
  lowHp.expedition.hp = 3;
  assert.equal(E.act(lowHp,'scout-cache'),lowHp,'no lethal investigation');
});

test('old expedition saves without a discovery field hydrate safely', () => {
  const s = startWood();
  delete s.expedition.discovery;
  const hydrated = E.parse(E.serialize(s));
  assert.equal(hydrated.expedition.discovery,null);
  assert.equal(E.act(hydrated,'scout-cache').expedition.scrap,3);
});
