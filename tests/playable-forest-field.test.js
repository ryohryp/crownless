const test=require('node:test');
const assert=require('node:assert/strict');
const F=require('../src/expedition-field.js');
const E=require('../src/slice-engine.js');

function wood(){
  const s=E.initial();s.mode='demo';return E.start(s,'wood');
}
function walk(s,...points){
  return points.reduce((state,pos)=>E.act(state,'field-step:'+pos),s);
}

test('first forest expedition starts in genuinely hidden, bounded terrain',()=>{
  const s=wood(),f=s.expedition.field;
  assert.equal(f.pos,20);
  assert(F.valid(f));
  assert(!F.visible(f,4),'the gate must be discovered, not visible on start');
  assert(!F.visible(f,16),'the hidden cache is not shown at entry');
  assert(F.visible(f,21),'the first reachable east cell is revealed');
  assert.equal(E.parse(E.serialize(s)).expedition.field.pos,20);
  assert.equal(E.act(s,'field-step:4'),s,'no teleport');
  assert.equal(E.act(s,'field-step:abc'),s,'no malformed movement');
  assert.equal(E.act(s,'field-step:25'),s,'out of bounds');
  assert.equal(E.act(s,'field-step:15').expedition.field.pos,15,'north is a valid adjacent move');
});

test('turning toward an unknown cache yields carried material, at a real wound and only once',()=>{
  const initial=wood();
  let s=walk(initial,21,16);
  assert.equal(s.expedition.field.pos,16);
  assert.equal(s.expedition.field.cache,true);
  assert.equal(s.expedition.scrap,4);
  assert.equal(s.expedition.hp,initial.expedition.hp-3);
  assert.equal(E.act(s,'field-step:16'),s,'cannot trigger a repeat by tapping current tile');
  s=walk(s,21,16);
  assert.equal(s.expedition.scrap,4,'returning to already searched cache grants no extra scrap');
  assert.equal(s.expedition.hp,initial.expedition.hp-3);
  const recovered=E.parse(E.serialize(s));
  assert.equal(recovered.expedition.field.cache,true);
  assert.equal(recovered.expedition.field.pos,16);
  const home=E.act(recovered,'return');
  assert.equal(home.report.scrap,4);
  assert.equal(home.scrap,4);
  assert.equal(home.expedition,null);
});

test('tracks help in combat and a dangerous den is a real risky encounter',()=>{
  const s=walk(wood(),21,22,23,18);
  assert.equal(s.expedition.field.tracks,true);
  assert.equal(s.expedition.focus,3);
  const inFight=walk(s,13,8);
  assert.equal(inFight.expedition.stage,'fight');
  assert.equal(inFight.expedition.enemy.risky,true);
  assert.equal(inFight.expedition.field.pos,8);
  assert.equal(E.attackPreview(inFight,'strike')-E.attackPreview({...inFight,expedition:{...inFight.expedition,focus:0}},'strike'),3);
  assert.equal(E.parse(E.serialize(inFight)).expedition.field.tracks,true,'battle save remembers explored geography');
});

test('careful path around the den opens the same real combat system',()=>{
  const s=walk(wood(),21,22,23,24,19,14,9,4);
  assert.equal(s.expedition.stage,'fight');
  assert.equal(s.expedition.enemy.risky,false);
  assert.equal(s.expedition.field.pos,F.EXIT);
  assert(F.visible(s.expedition.field,4));
  assert.equal(E.parse(E.serialize(s)).expedition.field.pos,4);
  const win=E.resolveFight(s);
  assert.notEqual(win,s);
  assert.equal(win.expedition?.room,1,'victory uses normal expedition progression');
});

test('old saves and other regions keep their existing route',()=>{
  const s=wood();
  delete s.expedition.field;
  const restored=E.parse(E.serialize(s));
  assert(restored.expedition);
  assert.equal(restored.expedition.field,undefined,'existing active forest runs are not reset to the new board');
  assert.equal(E.act(restored,'careful').expedition.stage,'fight','old two-choice expedition can finish normally');
  const tower=E.start(E.discover(Object.assign(E.initial(),{mode:'demo'}),'tower'),'tower');
  assert.equal(tower.expedition.field,undefined);
});

test('tampered field state is rejected, never trusted for impossible travel',()=>{
  const s=wood();
  s.expedition.field.pos=99;
  assert.equal(E.parse(E.serialize(s)),null);
});
