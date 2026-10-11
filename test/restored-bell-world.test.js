const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const N=require('../src/neighborhood.js');
const towerEvent=N.cell(400,0); // 0,1
const towerShop=N.cell(800,0); // 0,2
const anotherTowerEvent=N.cell(1200,0); // 0,3
const demo=()=>({...E.initial(),mode:'demo'});
const discoverEvent=()=>E.discoverDistrict(demo(),towerEvent);
function solveEvent(){
  let fought=E.startWithLocalClue(discoverEvent());
  fought.expedition.enemy.hp=1; // Shortened combat, normal victory and safe return.
  return E.act(E.act(fought,'strike'),'return');
}

test('only safe return changes this tower; ordinary battle and incomplete expedition do not',()=>{
  const discovered=discoverEvent();
  assert.equal(E.startWithBellSignal(discovered),discovered,'mere discovery is not restoration');
  let ordinary=E.act(E.start(discovered,'tower'),'careful');
  ordinary.expedition.enemy.hp=1;
  const ordinaryWon=E.act(ordinary,'strike');
  const ordinarySafe=E.act(ordinaryWon,'return');
  assert.deepEqual(ordinarySafe.designs,{});
  const plainReady={...ordinarySafe,report:null};
  assert.equal(E.startWithBellSignal(plainReady),plainReady,'ordinary battle never creates NPC');
  let clue=E.startWithLocalClue(discovered);
  assert.equal(E.startWithBellSignal(clue),clue,'no service mid-battle');
  clue.expedition.enemy.hp=1;
  const found=E.act(clue,'strike');
  assert.equal(E.startWithBellSignal(found),found,'unbanked design is not restored');
  const completed=E.act(found,'return');
  assert.equal(completed.designs.shield_thorn,'0,1','original coarse district is persistent');
  assert.equal(completed.report.newDesign,'shield_thorn');
  assert.deepEqual(E.parse(E.serialize(completed)),completed);
});

test('bell keeper appears only at the solved exact location, not another tower or a shop',()=>{
  let safe=solveEvent();
  safe={...safe,report:null};
  const elsewhere=E.discoverDistrict(safe,anotherTowerEvent);
  assert.equal(N.pointOfInterest(N.get(elsewhere.neighborhood)).family,'event');
  assert.equal(E.startWithBellSignal(elsewhere),elsewhere,'different event of same biome cannot use bell');
  const shop=E.discoverDistrict(safe,towerShop);
  assert.equal(E.startWithBellSignal(shop),shop,'different tower shop cannot use bell');
  const back=E.selectDistrict(elsewhere,towerEvent.id);
  const smith=E.switchCharacter(back,1);
  assert.equal(E.startWithBellSignal(smith),smith,'non-adventurers cannot start local expedition');
  const inactive={...back,mode:null};
  assert.equal(E.startWithBellSignal(inactive),inactive,'cannot start without an active mode');
});

test('a returned player can revisit the changed tower and receive first-attack focus from Yuno',()=>{
  const safe=solveEvent();
  const ready={...safe,report:null};
  const normal=E.act(E.start(ready,'tower'),'careful');
  const blessed=E.startWithBellSignal(ready);
  assert.notEqual(blessed,ready,'original event grants an optional route');
  assert.equal(blessed.expedition.place,'tower');
  assert.equal(blessed.expedition.focus,3);
  assert.match(blessed.expedition.log.join(' '),/鐘守の弟子・ユノ/);
  assert.deepEqual(E.parse(E.serialize(blessed)),blessed,'signal survives save reload');
  const encounter=E.act(blessed,'careful');
  assert.equal(encounter.expedition.stage,'fight');
  assert.equal(E.attackPreview(encounter,'strike'),E.attackPreview(normal,'strike')+3);
  const struck=E.act(encounter,'strike');
  assert.equal(struck.expedition.focus,0,'bonus is consumed by the first attack');
  assert.equal(struck.designs.shield_thorn,towerEvent.id,'no ownership change across combat');
  // This is a repeatable local assistance without a daily timer or check-in.
  const again=E.startWithBellSignal(ready);
  assert.equal(again.expedition.focus,3);
});
