const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');

const walk=(s,steps)=>steps.reduce((state,pos)=>E.act(state,'field-step:'+pos),s);

test('wolf danger reveals the actual provisional stake without forcing combat',()=>{
  let s=walk(E.start({...E.initial(),mode:'demo'},'wood'),[21,F.CACHE]);
  s=E.act(s,'forest-cache-skim');
  s=walk(s,[F.TREASURE,F.TRACKS]);
  assert.equal(s.expedition.scrap,7);
  assert.equal(s.expedition.materials.wolfFang,1);
  assert.notEqual(F.wolfAwareness(s.expedition.field),'alert');

  const warned=E.act(s,'field-step:13');
  assert.equal(F.wolfAwareness(warned.expedition.field),'alert');
  assert.notEqual(warned.expedition.stage,'fight','wolf combat remains optional');
  assert.match(warned.expedition.log[0],/巣穴へ進めば戦闘、脇道へ戻れば避けられる/);
  assert.match(warned.expedition.log[0],/背嚢の狼牙 1・鉄片 7 は生還まで未確定/);
  assert.match(warned.expedition.log[0],/ここで倒れれば失う/);
  assert.equal(warned.scrap,0,'the warning does not bank iron');
  assert.equal(warned.materials.wolfFang,0,'the warning does not bank fang');
  assert.equal(warned.expedition.field.secret,false,'the warning reveals no secret');

  const resumed=E.parse(E.serialize(warned));
  assert.ok(resumed,'wolf warning survives current save/reload');
  assert.match(resumed.expedition.log[0],/狼牙 1・鉄片 7/);
  const retreat=E.act(resumed,'field-step:'+F.TRACKS);
  assert.notEqual(retreat.expedition.stage,'fight','walking away avoids combat');
  const returned=E.act(retreat,'return');
  assert.equal(returned.expedition,null);
  assert.equal(returned.scrap,7,'iron banks only after safe return');
  assert.equal(returned.materials.wolfFang,1,'fang banks only after safe return');
});

test('empty bag keeps a short wolf warning without invented stakes',()=>{
  const near=walk(E.start({...E.initial(),mode:'demo'},'wood'),[21,22,23,F.TRACKS,13]);
  assert.equal(F.wolfAwareness(near.expedition.field),'alert');
  assert.match(near.expedition.log[0],/巣穴へ進めば戦闘/);
  assert.doesNotMatch(near.expedition.log[0],/背嚢の狼牙/);
  assert.equal(near.expedition.scrap,0);
  assert.equal(near.expedition.materials.wolfFang,0);
});
