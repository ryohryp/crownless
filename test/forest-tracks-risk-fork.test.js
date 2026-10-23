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

test('a full scrap bag cannot waste the one-time lantern clue for zero loot',()=>{
  const before=tracks(lanternOwner());
  const full={...before,expedition:{...before.expedition,scrap:1000}};
  assert.equal(E.act(full,'lantern-examine'),full,'full bag must preserve the unused choice');
  assert.equal(full.expedition.field.lanternClue,false);
  const almost={...before,expedition:{...before.expedition,scrap:999}};
  const taken=E.act(almost,'lantern-examine');
  assert.equal(taken.expedition.scrap,1000,'partial capacity grants only what fits');
  assert.equal(taken.expedition.field.lanternClue,true);
  assert.equal(E.act(taken,'lantern-examine'),taken,'repeat tap cannot farm');
  const restored=E.parse(E.serialize(taken));
  assert.ok(restored);
  assert.equal(E.act(restored,'return').scrap,1000,'reward remains provisional until return');
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/背嚢が満杯 · 生還して空きを作ろう/);
  assert.match(app,/disabled:x\.scrap>=1000/);
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

test('forest safe-return cue follows carried fang regardless of discovery route',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/button\('return',x\.materials\?\.wolfFang>0\?'狼牙を持って生還':x\.scrap>0\?'鉄片を持って生還':'ここで生還する'/,
    'the return cue must depend on carried loot, not tracksRisk (wolf combat also awards fangs)');
});

test('treasure hints at vines without revealing or navigating the secret passage',()=>{
  const found=walk(E.start({...E.initial(),mode:'demo'},'wood'),[21,22,23,F.TRACKS,F.TREASURE]);
  assert.match(found.expedition.log[0],/宝箱の背後でツタが擦れる音/);
  assert.equal(found.expedition.field.secret,false);
  assert.equal(F.visible(found.expedition.field,F.SECRET),false);
  assert.equal(F.canMove(found.expedition.field,F.SECRET),false);
  const opened=E.act(found,'field-step:'+F.SECRET);
  assert.equal(opened.expedition.field.pos,F.TREASURE,'inspection does not teleport');
  assert.equal(opened.expedition.field.secret,true,'only deliberate inspection opens secret');
  const entered=E.act(opened,'field-step:'+F.SECRET);
  assert.equal(entered.expedition.field.pos,F.SECRET);
  const returned=E.act(found,'return');
  assert.equal(returned.expedition,null);
  assert.equal(returned.materials.wolfFang,found.materials.wolfFang+1,'loot banks on safe return');
});

test('cache-side rustle invites a later discovery without opening secret or banking loot',()=>{
  const start=E.start({...E.initial(),mode:'demo'},'wood');
  const approach=walk(start,[21,F.CACHE]);
  assert.match(approach.expedition.log[0],/乾いた葉を擦るような音/);
  assert.equal(approach.expedition.field.treasure,false);
  assert.equal(approach.expedition.field.secret,false);
  assert.equal(F.visible(approach.expedition.field,F.SECRET),false);
  assert.equal(approach.materials.wolfFang,0,'the clue does not bank materials');
  const restored=E.parse(E.serialize(approach));
  assert.ok(restored,'approach remains saveable');
  const found=E.act(restored,'field-step:'+F.TREASURE);
  assert.match(found.expedition.log[0],/宝箱の背後でツタが擦れる音/);
  assert.equal(found.expedition.field.secret,false,'treasure still requires manual vine inspection');
  assert.equal(found.materials.wolfFang,0,'chest loot remains provisional');
  const returned=E.act(found,'return');
  assert.equal(returned.materials.wolfFang,1,'loot banks only after safe return');
});

test('the unknown vine location is not an exact map button before chest-side investigation',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.doesNotMatch(app,/const inspectVines=/,'hidden vines must not reveal their cell before discovery');
  assert.match(app,/if\(passable\)return/,'only walkable visible cells are map buttons');
  assert.match(app,/x\.field\.pos===window\.CrownlessField\.TREASURE&&!x\.field\.secret/);
  assert.match(app,/button\('field-step','宝箱の背後を調べる'/);
});


test('forest cache offers a real opt-in HP-for-scrap choice, not forced damage',()=>{
  const start=E.start({...E.initial(),mode:'demo'},'wood');
  const atCache=walk(start,[21,F.CACHE]);
  assert.equal(atCache.expedition.field.pos,F.CACHE);
  assert.equal(atCache.expedition.field.cache,false,'stepping on cache is not collecting');
  assert.equal(atCache.expedition.hp,start.expedition.hp,'no automatic wound');
  assert.equal(atCache.expedition.scrap,0,'no automatic loot');
  const declined=E.act(atCache,'return');
  assert.equal(declined.scrap,0,'declining leaves no loot');
  const taken=E.act(atCache,'forest-cache-search');
  assert.equal(taken.expedition.hp,start.expedition.hp-3);
  assert.equal(taken.expedition.scrap,4);
  assert.equal(taken.expedition.field.cache,true);
  assert.equal(taken.scrap,0,'unreturned iron is not banked');
  assert.equal(E.act(taken,'forest-cache-search'),taken,'cannot collect twice');
  const restored=E.parse(E.serialize(taken));
  assert.ok(restored,'the current expedition survives reload');
  assert.equal(restored.expedition.field.cache,true);
  assert.equal(E.act(restored,'return').scrap,4,'safe return banks the iron');
  const low={...atCache,expedition:{...atCache.expedition,hp:3}};
  assert.equal(E.act(low,'forest-cache-search'),low,'low HP cannot be spent');
});

test('safe cache salvage yields less iron without HP loss and cannot be combined with risky salvage',()=>{
  const start=E.start({...E.initial(),mode:'demo'},'wood');
  const atCache=walk(start,[21,F.CACHE]);
  const skimmed=E.act(atCache,'forest-cache-skim');
  assert.equal(skimmed.expedition.hp,start.expedition.hp,'safe salvage costs no HP');
  assert.equal(skimmed.expedition.scrap,1,'safe salvage trades quantity for safety');
  assert.equal(skimmed.expedition.field.cache,true);
  assert.equal(E.act(skimmed,'forest-cache-search'),skimmed,'cannot take risky loot after safe choice');
  assert.equal(E.act(skimmed,'forest-cache-skim'),skimmed,'cannot repeat safe loot');
  assert.equal(skimmed.scrap,0,'no materials banked before returning alive');
  const restored=E.parse(E.serialize(skimmed));
  assert.ok(restored,'safe choice survives save/reload');
  assert.equal(E.act(restored,'return').scrap,1,'safe return banks only chosen iron');
  const low={...atCache,expedition:{...atCache.expedition,hp:3}};
  assert.equal(E.act(low,'forest-cache-search'),low,'dangerous search blocked at low HP');
  assert.equal(E.act(low,'forest-cache-skim').expedition.scrap,1,'safe option remains available at low HP');
  const full={...atCache,expedition:{...atCache.expedition,scrap:1000}};
  assert.equal(E.act(full,'forest-cache-skim'),full,'no inventory overflow');
});

test('cache risk is a reachable deliberate choice on the forest mobile panel',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/x\.field\.pos===window\.CrownlessField\.CACHE && !x\.field\.cache/);
  assert.match(app,/button\('forest-cache-skim','手前の鉄片だけ拾う'/);
  assert.match(app,/button\('forest-cache-search','棘を越えて奥を探る'/);
  assert.match(app,/x\.hp<=3\|\|x\.scrap>996/);
});

test("new tracks discovery survives losing the wolf's attention",()=>{
  // Reach the wolf's sightline by a different path, without visiting tracks.
  const near=walk(E.start({...E.initial(),mode:'demo'},'wood'),[21,22,23,24,19,14,13]);
  assert.equal(F.wolfAwareness(near.expedition.field),'alert');
  assert.equal(near.expedition.field.tracks,false);
  const found=E.act(near,'field-step:'+F.TRACKS);
  assert.equal(found.expedition.field.tracks,true);
  assert.equal(F.wolfAwareness(found.expedition.field),'watching');
  assert.match(found.expedition.log[0],/無事に生還すると.*獣道読み/,
    'first discovery and the new skill motivation must not be replaced by a generic escape cue');
  assert.equal(found.expedition.field.secret,false,'the clue cannot reveal the hidden passage');
  const resumed=E.parse(E.serialize(found));
  assert.ok(resumed,'discovered tracks survive current save/reload');
  assert.equal(resumed.expedition.field.tracks,true);
});

test('fox pouch explains why a choice is unavailable and what each reward enables',()=>{
  const app=fs.readFileSync('src/slice-app.js','utf8');
  assert.match(app,/薬草は3個で満杯 · 鉄片か生還を選ぶ/);
  assert.match(app,/背嚢が満杯 · 薬草か生還を選ぶ/);
  assert.match(app,/薬草 \+1（次の戦闘用）/);
  assert.match(app,/鉄片 \+3（鍛冶用）/);
  const atPouch=walk(E.start({...E.initial(),mode:'demo'},'wood'),[15,10,F.FOX,F.FOX_NEST]);
  assert.equal(atPouch.expedition.field.foxCache,false);
  const fullHerbs={...atPouch,expedition:{...atPouch.expedition,potions:3}};
  assert.equal(E.act(fullHerbs,'forest-fox-herb'),fullHerbs,'full herbs cannot be duplicated');
  const fullScrap={...atPouch,expedition:{...atPouch.expedition,scrap:998}};
  assert.equal(E.act(fullScrap,'forest-fox-scrap'),fullScrap,'full bag cannot overflow');
  const herb=E.act(atPouch,'forest-fox-herb');
  assert.equal(herb.expedition.potions,3);
  assert.equal(herb.expedition.scrap,0);
  assert.equal(E.act(herb,'forest-fox-scrap'),herb,'exclusive pouch choice stays consumed');
});
