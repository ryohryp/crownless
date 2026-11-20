const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');

function reachTracks(){
  let s=E.start({...E.initial(),mode:'demo'},'wood');
  for(const pos of [21,22,23,F.TRACKS])s=E.act(s,'field-step:'+pos);
  return s;
}
test('noncombat foraging trades away the risky fang and lantern fork for one herb',()=>{
  const before=reachTracks();
  const after=E.act(before,'forest-tracks-forage');
  assert.equal(after.expedition.potions,before.expedition.potions+1);
  assert.equal(after.expedition.hp,before.expedition.hp);
  assert.equal(after.expedition.materials.wolfFang,0);
  assert.equal(after.expedition.field.tracksRisk,true);
  assert.equal(E.act(after,'forest-tracks-forage'),after);
  assert.equal(E.act(after,'forest-tracks-risk'),after);
  assert.equal(E.act(after,'lantern-examine'),after);
  const restored=E.parse(E.serialize(after));
  assert.equal(restored.expedition.field.tracksRisk,true);
  assert.equal(restored.expedition.potions,after.expedition.potions);
  assert.equal(E.act(restored,'return').expedition,null);
});
test('full herb pouch cannot forage; mobile choice shows the tradeoff',()=>{
  const before=reachTracks();
  const full={...before,expedition:{...before.expedition,potions:3}};
  assert.equal(E.act(full,'forest-tracks-forage'),full);
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/button\('forest-tracks-forage'/);
  assert.match(app,/disabled:x\.potions>=3/);
});

test('forest decision describes herb foraging rather than falsely claiming a fang',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/x\.field\.tracksRisk\?\(x\.materials\?\.wolfFang>0\?/);
  assert.match(app,/足跡の脇で薬草を採った。体力を回復して奥へ進むか/);
});
