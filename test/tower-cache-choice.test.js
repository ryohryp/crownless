'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const T=require('../src/tower-field.js');

const atCache=()=>{
  let s=E.start(E.discover({...E.initial(),mode:'demo'},'tower'),'tower');
  for(const to of [21,22,23,18,T.CACHE])s=E.act(s,'tower-step:'+to);
  assert.equal(s.expedition.tower.pos,T.CACHE);
  return s;
};

test('collapsed tower stairs offer a one-time material-versus-focus choice',()=>{
  const before=atCache();
  assert.equal(before.expedition.tower.cache,false);
  assert.equal(before.expedition.materials.watchIron,0);
  const mined=E.act(before,'tower-cache-iron');
  assert.equal(mined.expedition.hp,before.expedition.hp-2);
  assert.equal(mined.expedition.materials.watchIron,1);
  assert.equal(mined.materials.watchIron,0,'material stays at risk');
  assert.equal(mined.expedition.tower.cache,true);
  assert.equal(E.act(mined,'tower-cache-iron'),mined,'cannot farm the cache');
  assert.equal(E.act(mined,'tower-cache-focus'),mined,'cannot take both rewards');
  assert.deepEqual(E.parse(E.serialize(mined)),mined);
  const returned=E.act(mined,'return');
  assert.equal(returned.materials.watchIron,1,'only safe return banks material');
  assert.deepEqual(E.parse(E.serialize(returned)),returned);
});

test('reading the inscription keeps HP and awards focus instead of iron',()=>{
  const before=atCache();
  const prepared=E.act(before,'tower-cache-focus');
  assert.equal(prepared.expedition.hp,before.expedition.hp);
  assert.equal(prepared.expedition.focus,3);
  assert.equal(prepared.expedition.materials.watchIron,0);
  assert.equal(prepared.expedition.tower.cache,true);
  assert.equal(E.act(prepared,'tower-cache-iron'),prepared);
  assert.equal(E.act(before,'return').materials.watchIron,0,'skipping the cache grants nothing');
});

test('low-HP traveler cannot take a fatal cache injury',()=>{
  const before=atCache();
  before.expedition.hp=2;
  assert.equal(E.act(before,'tower-cache-iron'),before);
  assert.equal(E.act(before,'tower-cache-focus').expedition.tower.cache,true);
});
