const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');

const walk=(s,steps)=>steps.reduce((state,pos)=>E.act(state,'field-step:'+pos),s);
const tracks=s=>walk(E.start(s,'wood'),[21,22,23,F.TRACKS]);

function lanternOwner(){
  let s={...E.initial(),mode:'demo'};
  s=walk(E.start(s,'wood'),[21,22,23,F.TRACKS,F.TREASURE]);
  s=E.act(s,'return');
  s=E.switchCharacter({...s,report:null},1);
  assert.equal(E.canCraftScoutLantern(s),true);
  s=E.craftScoutLantern(s);
  return E.switchCharacter(s,0);
}

test('without lantern, risky search costs HP and holds fang until safe return',()=>{
  const before=tracks({...E.initial(),mode:'demo'});
  assert.equal(before.expedition.field.tracks,true);
  assert.equal(before.expedition.field.tracksRisk,false);
  const after=E.act(before,'forest-tracks-risk');
  assert.equal(after.expedition.hp,before.expedition.hp-4);
  assert.equal(after.expedition.materials.wolfFang,1);
  assert.equal(after.materials.wolfFang,0);
  assert.equal(after.expedition.field.tracksRisk,true);
  assert.equal(E.act(after,'forest-tracks-risk'),after,'repeat taps cannot mint loot');
  assert.equal(E.act(after,'lantern-examine'),after,'risk excludes lantern route');
  const restored=E.parse(E.serialize(after));
  assert.ok(restored,'in-progress fork survives save/reload');
  assert.equal(restored.expedition.field.tracksRisk,true);
  const returned=E.act(restored,'return');
  assert.equal(returned.materials.wolfFang,1,'only safe return banks fang');
  assert.equal(returned.expedition,null);
});

test('lantern gives safe scrap alternative, not a secret shortcut',()=>{
  const before=tracks(lanternOwner());
  const after=E.act(before,'lantern-examine');
  assert.equal(after.expedition.hp,before.expedition.hp);
  assert.equal(after.expedition.scrap,before.expedition.scrap+2);
  assert.equal(after.expedition.field.lanternClue,true);
  assert.equal(after.expedition.field.secret,false);
  assert.equal(F.visible(after.expedition.field,F.SECRET),false);
  assert.equal(E.act(after,'forest-tracks-risk'),after,'lantern route excludes risky route');
  assert.equal(E.act(after,'lantern-examine'),after,'lantern loot cannot repeat');
  const restored=E.parse(E.serialize(after));
  assert.ok(restored);
  const returned=E.act(restored,'return');
  assert.equal(returned.scrap,before.scrap+2,'scrap banks only after safe return');
});

test('low HP blocks risk; controls use existing mobile choice area',()=>{
  const before=tracks({...E.initial(),mode:'demo'});
  const low={...before,expedition:{...before.expedition,hp:4}};
  assert.equal(E.act(low,'forest-tracks-risk'),low);
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/forest-tracks-risk/);
  assert.match(app,/x\.hp<=4/);
  assert.match(app,/data-action="field-step"/);
});
