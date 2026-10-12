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

test('wolf reveals itself nearby and player can either engage or escape its den',()=>{
  const start=wood();
  assert.equal(F.wolfAwareness(start.expedition.field),'hidden','do not expose secret den initially');
  const tracks=walk(start,21,22,23,18);
  assert.equal(F.wolfAwareness(tracks.expedition.field),'hidden');
  const sighted=walk(tracks,13);
  assert.equal(F.wolfAwareness(sighted.expedition.field),'alert');
  assert.match(sighted.expedition.log[0],/狼が現れた|狼.*気づ/);
  assert.equal(sighted.expedition.stage,'path','sighting must not auto-start battle');
  assert.equal(E.parse(E.serialize(sighted)).expedition.field.pos,13,
    'warning and character position survive reload');
  const fought=walk(sighted,8);
  assert.equal(fought.expedition.stage,'fight');
  assert.equal(fought.expedition.enemy.risky,true,'entering the den deliberately starts a stronger encounter');
  assert.match(fought.expedition.log[0],/狼/);
  const escaped=walk(sighted,14);
  assert.equal(escaped.expedition.stage,'path','stepping away must not trigger combat');
  assert.equal(F.wolfAwareness(escaped.expedition.field),'watching');
  assert.match(escaped.expedition.log[0],/狼の視線を振り切った/);
  const around=walk(escaped,9,4);
  assert.equal(around.expedition,null,'the stone gate allows a safe escape');
  assert.equal(around.report.died,false);
  assert.equal(around.materials.wolfFang,0,'avoiding the den does not fake a wolf kill');
});

test('careful bypass reaches the stone gate without a forced second wolf fight',()=>{
  const s=walk(wood(),21,22,23,24,19,14,9,4);
  assert.equal(s.expedition,null,'stone gate banks loot and returns the player');
  assert.equal(s.report.died,false);
  assert.equal(s.report.scrap,0);
  assert.equal(s.runs,1);
  assert.equal(s.materials.wolfFang,0,'no phantom wolf drops when the player avoids combat');
});


test('a hidden chest can be discovered once, carried through a reload, and banked for smithing',()=>{
  const start=wood();
  assert.equal(start.expedition.field.treasure,false);
  assert(!F.visible(start.expedition.field,F.TREASURE),'the chest is initially under fog');
  let s=walk(start,21,22,17);
  assert.equal(s.expedition.field.treasure,true);
  assert.equal(s.expedition.scrap,6);
  assert.equal(s.expedition.materials.wolfFang,1);
  assert.match(s.expedition.log[0],/宝箱を発見/);
  s=E.parse(E.serialize(s));
  assert.equal(s.expedition.field.treasure,true);
  s=walk(s,22,17);
  assert.equal(s.expedition.scrap,6,'opened chest cannot be looted repeatedly');
  assert.equal(s.expedition.materials.wolfFang,1);
  const banked=E.act(s,'return');
  assert.equal(banked.expedition,null);
  assert.equal(banked.scrap,6);
  assert.equal(banked.materials.wolfFang,1,'smith receives a REAL banked raw material');
});

test('one wolf battle returns to the exact same explored forest with loot and no respawn',()=>{
  let s=walk(wood(),21,22,17,18,13,8);
  assert.equal(s.expedition.stage,'fight');
  const seen=s.expedition.field.seen;
  const scrap=s.expedition.scrap;
  const won=E.resolveFight(s);
  assert.equal(won.expedition?.stage,'path','battle returns to forest exploration');
  assert.equal(won.expedition?.room,0,'no five-room fight corridor');
  assert.equal(won.expedition.field.pos,F.DEN);
  assert.equal(won.expedition.field.seen,seen,'fog and position persist');
  assert.equal(won.expedition.field.treasure,true,'opened chest stays open');
  assert.equal(won.expedition.field.wolf,true,'defeated wolf is persisted');
  assert(won.expedition.scrap>scrap);
  assert(won.expedition.materials.wolfFang>=2,'treasure and wolf reward are carried together');
  assert.equal(F.wolfAwareness(won.expedition.field),'defeated');
  const restored=E.parse(E.serialize(won));
  assert.equal(restored.expedition.field.wolf,true);
  const revisited=walk(restored,13,8);
  assert.equal(revisited.expedition.stage,'path','the dead wolf never starts another fight');
  assert.equal(revisited.expedition.scrap,won.expedition.scrap);
  assert.equal(revisited.expedition.materials.wolfFang,won.expedition.materials.wolfFang);
  const home=walk(revisited,9,4);
  assert.equal(home.expedition,null,'reaching the stone gate finishes the single-field expedition');
  assert(home.report.scrap>=8);
  assert(home.materials.wolfFang>=2);
});

test('legacy forest saves without new fields remain accepted',()=>{
  let s=walk(wood(),21,22);
  delete s.expedition.field.treasure;
  delete s.expedition.field.wolf;
  assert(F.valid(s.expedition.field));
  const restored=E.parse(E.serialize(s));
  const opened=E.act(restored,'field-step:17');
  assert.equal(opened.expedition.field.treasure,true);
  assert.equal(opened.expedition.field.wolf,undefined);
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
