const test=require('node:test');
const assert=require('node:assert/strict');
const forage=require('../src/expedition-foraging.js');
test('safe gathering and dangerous deeper extraction offer different rewards',()=>{
  const start=forage.initial();
  assert.deepEqual(forage.options(start),['gather','press','retreat']);
  const safe=forage.choose(start,'gather');
  assert.equal(safe.herbs,2);
  assert.equal(safe.health,10);
  assert.deepEqual(forage.options(safe),[]);
  const deep=forage.choose(forage.choose(start,'press'),'press');
  assert.equal(deep.ore,2);
  assert.equal(deep.health,4);
  assert.equal(deep.finished,true);
});
test('retreat preserves gathered materials; invalid repeat cannot duplicate rewards',()=>{
  const start=forage.initial();
  const retreat=forage.choose(forage.choose(start,'press'),'retreat');
  assert.equal(retreat.health,7);
  assert.equal(retreat.retreated,true);
  assert.equal(forage.choose(retreat,'extract'),null);
  assert.equal(forage.choose(start,'extract'),null);
});
