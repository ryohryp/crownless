
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('../src/slice-engine.js');
const F=require('../src/expedition-field.js');

const walk=(s,steps)=>steps.reduce((state,pos)=>E.act(state,'field-step:'+pos),s);
const tracks=s=>walk(E.start(s,'wood'),[21,22,23,F.TRACKS]);

test('a nearby rustle invites discovery before the forest fork, without awarding loot',()=>{
  const start=E.start({...E.initial(),mode:'demo'},'wood');
  const far=walk(start,[21,22]);
  assert.doesNotMatch(far.expedition.log[0],/爪跡/,'clue only appears beside the tracks');
  const before=E.act(far,'field-step:23');
  assert.match(before.expedition.log[0],/爪跡/);
  assert.equal(before.expedition.field.tracks,false,'tracks require a deliberate step');
  assert.equal(before.expedition.field.secret,false,'no hidden path reveal');
  assert.equal(before.expedition.materials.wolfFang,0,'no free material');
  const discovered=E.act(before,'field-step:'+F.TRACKS);
  assert.equal(discovered.expedition.field.tracks,true);
  assert.doesNotMatch(discovered.expedition.log[0],/爪跡/,'discovery has its own message');
  const away=E.act(discovered,'field-step:23');
  assert.doesNotMatch(away.expedition.log[0],/爪跡/,'cue does not repeat after discovery');
});

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

test('choice hints disclose cost but not exact rewards',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/体力 −4 · 獣骨を調べる/);
  assert.match(app,/体力消費なし · 手掛かりを探す/);
  assert.doesNotMatch(app,/体力 −4 · 狼牙 \+1/);
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

test('forest safe-return text remains truthful across reload and after banking loot',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  const source=app.slice(app.indexOf('function fieldDecision(x){'),app.indexOf('const logs = x =>'));
  assert.match(source,/x\.materials\?\.wolfFang>0\?'狼牙を持って生還':x\.scrap>0\?'鉄片を持って生還':'ここで生還する'/);
  const found=E.act(tracks({...E.initial(),mode:'demo'}),'forest-tracks-risk');
  const restored=E.parse(E.serialize(found));
  assert.equal(restored.expedition.materials.wolfFang,1,'unbanked fang survives current save format');
  assert.equal(restored.materials.wolfFang,0,'the camp does not own the fang before return');
  const safe=E.act(restored,'return');
  assert.equal(safe.expedition,null);
  assert.equal(safe.materials.wolfFang,1,'return banks the item exactly once');
  assert.equal(E.act(safe,'return'),safe,'no second return can duplicate the fang');
});

test('forest safe-return cue follows carried fang regardless of discovery route',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/button\('return',x\.materials\?\.wolfFang>0\?'狼牙を持って生還':x\.scrap>0\?'鉄片を持って生還':'ここで生還する'/,
    'the return cue must depend on carried loot, not tracksRisk (wolf combat also awards fangs)');
});