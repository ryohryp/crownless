const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const A = require('../src/enemy-adaptation.js');
require('../src/enemy-adaptation-runtime.js')(E, A);
const fresh = () => ({...E.initial(), mode:'demo'});

function fightAt(place='wood') {
  let s=fresh();
  if(place!=='wood') s=E.discover(s,place);
  s=E.start(s,place);
  return E.act(s,'careful');
}

test('two repeated actions create a telegraphed counter before the next choice', () => {
  let s=fightAt('wood');
  s=E.act(s,'dodge');
  s=E.act(s,'dodge');
  const next=E.intent(s.expedition.enemy);
  assert.equal(next.id,'feint');
  assert.equal(next.adaptive,true);
  assert.match(next.reason,/足運び/);
  assert.match(next.help,/防御|通常攻撃/);
});

test('feint makes a third dodge costly while switching to guard is a practical answer', () => {
  let s=fightAt('wood');
  s=E.act(E.act(s,'dodge'),'dodge');
  const hp=s.expedition.hp;
  const dodged=E.act(s,'dodge');
  assert.equal(dodged.expedition.hp,hp-4);
  assert.equal(dodged.expedition.focus,s.expedition.focus);
  const guarded=E.act(s,'guard');
  assert.equal(guarded.expedition.hp,hp);
});

test('combat action history survives save/load without relaxing normal save validation', () => {
  let s=fightAt('wood');
  s=E.act(s,'dodge');
  const loaded=E.parse(E.serialize(s));
  assert.deepEqual(loaded.expedition.enemy.history,['dodge']);
  const bad=JSON.parse(E.serialize(s)); bad.expedition.enemy.history=['dodge','hack'];
  assert.deepEqual(E.parse(JSON.stringify(bad)).expedition.enemy.history,['dodge']);
});
