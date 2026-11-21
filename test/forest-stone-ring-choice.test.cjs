const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');

function atRing(){
  const state=E.initial();
  state.mode='demo';
  const started=E.start(state,'wood');
  assert.ok(started.expedition);
  started.expedition.field={...F.initial(),pos:F.GLADE,seen:2**F.COUNT-1,glade:true};
  assert.ok(F.valid(started.expedition.field));
  return started;
}

test('stone ring: risky excavation grants provisional fang once, costs health and banks only on return',()=>{
  const s=atRing(),before=s.expedition.hp;
  const a=E.act(s,'forest-glade-excavate');
  assert.equal(a.expedition.hp,before-5);
  assert.equal(a.expedition.materials.wolfFang,1);
  assert.equal(a.materials.wolfFang,0);
  assert.equal(a.expedition.field.gladeChoice,true);
  const repeat=E.act(a,'forest-glade-excavate');
  assert.equal(repeat.expedition.materials.wolfFang,1);
  const returned=E.act(a,'return');
  assert.equal(returned.materials.wolfFang,1);
});

test('stone ring: offering consumes carried scrap, heals and cannot be farmed',()=>{
  const s=atRing();
  s.expedition.scrap=5;
  s.expedition.hp-=14;
  const before=s.expedition.hp;
  const a=E.act(s,'forest-glade-rest');
  assert.equal(a.expedition.hp,before+12);
  assert.equal(a.expedition.scrap,2);
  assert.equal(a.expedition.field.gladeChoice,true);
  assert.equal(E.act(a,'forest-glade-rest').expedition.scrap,2);
});

test('stone ring: reject lethal excavation and unaffordable offering',()=>{
  const s=atRing();
  s.expedition.hp=5;
  assert.equal(E.act(s,'forest-glade-excavate').expedition.materials.wolfFang,0);
  assert.equal(E.act(s,'forest-glade-rest').expedition.field.gladeChoice,false);
});
