const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');

const walk=(state,positions)=>positions.reduce((s,pos)=>E.act(s,'field-step:'+pos),state);
function returnWithForestTreasure(){
  let s={...E.initial(),mode:'demo'};
  s=E.start(s,'wood');
  s=walk(s,[21,22,23,18,17]);
  assert.equal(s.expedition.stage,'path','gathering does not force a fight');
  assert.equal(s.expedition.enemy,null,'wolf remains unengaged');
  assert.equal(s.expedition.materials.wolfFang,1);
  assert.equal(s.expedition.scrap,6);
  assert.equal(s.materials.wolfFang,0,'unreturned loot cannot be spent');
  s=E.act(s,'return');
  assert.equal(s.expedition,null);
  assert.equal(s.report.died,false);
  assert.equal(s.materials.wolfFang,1);
  assert.equal(s.scrap,6);
  return s;
}

test('no-combat chest -> safe return -> once-only smith craft -> save and role-switch',()=>{
  const lamp=E.SCOUT_LANTERN;
  let s=returnWithForestTreasure();
  assert.equal(lamp.count,1);
  assert.equal(lamp.scrap,4);
  assert.equal(E.craftScoutLantern(s),s,'cannot craft while reviewing return');
  s={...s,report:null};
  assert.equal(E.craftScoutLantern(s),s,'adventurer cannot fabricate');
  s=E.switchCharacter(s,1);
  assert.equal(E.canCraftScoutLantern(s),true);
  s=E.craftScoutLantern(s);
  assert.deepEqual(s.ownedTools,[lamp.id]);
  assert.equal(s.scrap,2);
  assert.equal(s.materials.wolfFang,0);
  assert.equal(s.characters[1].experience,1);
  assert.equal(E.craftScoutLantern(s),s,'double tap must not double-spend');
  s=E.parse(E.serialize(s));
  assert.ok(s,'crafted lantern survives reload');
  s=E.switchCharacter(s,0);
  assert.equal(s.ownedTools.includes(lamp.id),true);
  assert.equal(E.canCraftScoutLantern(s),false);
});

test('without lantern there is no free clue, then with lantern a deliberate clue changes expedition state only',()=>{
  let plain={...E.initial(),mode:'demo'};
  plain=walk(E.start(plain,'wood'),[21,22,23,18]);
  assert.equal(F.visible(plain.expedition.field,F.SECRET),false);
  assert.equal(E.act(plain,'lantern-examine'),plain,'no lamp means no action');
  let s=returnWithForestTreasure();
  s=E.switchCharacter({...s,report:null},1);
  s=E.switchCharacter(E.craftScoutLantern(s),0);
  s=walk(E.start(s,'wood'),[21,22,23,18]);
  assert.equal(s.expedition.field.lanternClue,false);
  const observed=E.act(s,'lantern-examine');
  assert.equal(observed.expedition.field.lanternClue,true,'lantern reveals a clue only after inspection');
  assert.match(observed.expedition.log[0],/斥候の灯/);
  assert.equal(observed.expedition.field.pos,F.TRACKS,'examination does not teleport');
  assert.equal(observed.expedition.field.secret,false,'the hidden trail stays closed');
  assert.equal(F.visible(observed.expedition.field,F.SECRET),false,'exact secret tile remains veiled');
  assert.equal(E.act(observed,'lantern-examine'),observed,'no repeated clue farming');
  const reloaded=E.parse(E.serialize(observed));
  assert.ok(reloaded);
  assert.equal(reloaded.expedition.field.lanternClue,true);
  const atTreasure=E.act(reloaded,'field-step:'+F.TREASURE);
  const discovered=E.act(atTreasure,'field-step:'+F.SECRET);
  assert.equal(discovered.expedition.field.secret,true,'only real adjacent investigation opens vines');
  assert.equal(discovered.expedition.field.pos,F.TREASURE,'investigation is not movement');
});

test('failure and old saves cannot mint a lantern or duplicate its payment',()=>{
  let s={...E.initial(),mode:'demo'};
  s=E.start(s,'wood');
  s=walk(s,[21,22,23,18,17]);
  s=E.act(s,'return');
  const clean=JSON.parse(E.serialize({...s,report:null}));
  delete clean.ownedTools;
  const legacy=E.parse(JSON.stringify(clean));
  assert.ok(legacy,'existing saves lacking tool list remain readable');
  assert.deepEqual(legacy.ownedTools,[]);
  assert.equal(E.craftScoutLantern(legacy),legacy,'not smith');
  const invalid={...legacy,ownedTools:['scout_lantern','scout_lantern']};
  assert.equal(E.parse(JSON.stringify(invalid)),null,'duplicate tool IDs rejected');
  const defeated={...E.initial(),mode:'demo'};
  assert.equal(E.canCraftScoutLantern(defeated),false);
});

test('phone recipe card and forest clue use only real saved craft/expedition state',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  const css=fs.readFileSync('editorial-loop.css','utf8');
  assert.match(app,/const lanternSpec=/);
  assert.match(app,/E\.canCraftScoutLantern\(state\)/);
  assert.match(app,/data-action="craft-tool"|button\('craft-tool'/);
  assert.match(app,/state = E\.craftScoutLantern\(state\)/);
  assert.match(app,/action === 'lantern-examine'/);
  assert.match(app,/state = E\.act\(state,'lantern-examine'\)/);
  assert.match(app,/argon-tool-materials/);
  assert.match(css,/\.argon-tool-spec/);
  assert.match(css,/min-height:48px/);
  assert.match(css,/\.scout-lantern-clue/);
});
