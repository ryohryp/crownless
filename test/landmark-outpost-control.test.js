const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const E=require('../src/slice-engine.js');
const F=require('../src/travel-footprints.js');

function start(id='tokyo-tower',biome='tower') {
  const ready=E.discover({...E.initial(),mode:'demo'},biome);
  return E.startLandmark(ready,biome,id);
}
function bossDefeated(s) {
  return {...s,expedition:{...s.expedition,room:4,stage:'cleared',seals:[s.expedition.place]}};
}
test('discovering a landmark does not grant control before a boss is defeated',()=>{
  const found=F.record(F.initial(),{latitude:35.658656,longitude:139.745364,accuracy:8,speed:0},'2026-10-10');
  assert.equal(found.status,'first');
  const siege=start();
  assert.equal(siege.expedition.landmarkId,'tokyo-tower');
  assert.deepEqual(siege.claimedLandmarks,[]);
  const retreated=E.act(siege,'return');
  assert.equal(retreated.report.died,false);
  assert.deepEqual(retreated.report.cleared,[]);
  assert.deepEqual(retreated.claimedLandmarks,[]);
});
test('safe return after the land boss creates an individually owned landmark outpost',()=>{
  const victory=E.act(bossDefeated(start()),'return');
  assert.equal(victory.expedition,null);
  assert.ok(victory.report.cleared.includes('tower'));
  assert.equal(victory.report.landmarkId,'tokyo-tower');
  assert.deepEqual(victory.claimedLandmarks,['tokyo-tower']);
  assert.deepEqual(E.parse(E.serialize(victory)),victory);
  // Re-do the same biome for another, unclaimed monument: ownership is distinct.
  const second=E.startLandmark({...victory,report:null},'tower','tokyo-skytree');
  assert.equal(second.expedition.potions,2);
  const after=E.act(second,'return');
  assert.deepEqual(after.claimedLandmarks,['tokyo-tower']);
});
test('claimed landmark supplies an extra herb on the next expedition only there',()=>{
  const victory=E.act(bossDefeated(start()),'return');
  const base={...victory,report:null};
  const fromTower=E.startLandmark(base,'tower','tokyo-tower');
  assert.equal(fromTower.expedition.potions,3);
  assert.match(fromTower.expedition.log[0],/支配拠点の補給路/);
  const fromSkytree=E.startLandmark(base,'tower','tokyo-skytree');
  assert.equal(fromSkytree.expedition.potions,2);
  assert.equal(E.startLandmark(base,'tower','<bad>'),base);
});
test('normal biome expedition boss victory is not an ownership claim',()=>{
  const base=E.discover({...E.initial(),mode:'demo'},'tower');
  const generic=E.start(base,'tower');
  const finished=E.act(bossDefeated(generic),'return');
  assert.deepEqual(finished.claimedLandmarks,[]);
  assert.equal(finished.report.landmarkId,undefined);
});
test('illustrated atlas shows earned flags and a siege button for each unique landmark',()=>{
  const date='2026-10-10', tower={latitude:35.658656,longitude:139.745364,accuracy:8,speed:0},
    skytree={latitude:35.7101,longitude:139.8107,accuracy:8,speed:0};
  let journal=F.record(F.initial(),tower,date).journal;
  journal=F.record(journal,skytree,date).journal;
  const saved=E.act(bossDefeated(start()),'return');
  const values=new Map([
    ['crownless-expedition-mode','demo'],
    ['crownless-travel-footprints-v1-demo',JSON.stringify(journal)],
    ['crownless-expedition-v1-demo',E.serialize(saved)],
  ]);
  const context={CrownlessSlice:E,CrownlessTravelFootprints:F,
    localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}};
  context.window=context;
  const script=fs.readFileSync(path.join(__dirname,'../src/travel-chronicle-ui.js'),'utf8');
  vm.runInNewContext(script,context);
  const container={innerHTML:'',querySelectorAll:()=>[]};
  context.CrownlessTravelChronicleUI.showFootprints();
  context.CrownlessTravelChronicleUI.renderChronicle(container);
  assert.match(container.innerHTML,/紅蓮の望楼/);
  assert.match(container.innerHTML,/天穿つ白塔/);
  assert.match(container.innerHTML,/⚑ あなたの支配拠点/);
  assert.match(container.innerHTML,/👣 発見済み・未支配/);
  assert.match(container.innerHTML,/data-action="landmark-siege" data-value="tokyo-tower"/);
  assert.match(container.innerHTML,/data-action="landmark-siege" data-value="tokyo-skytree"/);
  assert.match(container.innerHTML,/この支配拠点から再遠征/);
  assert.match(container.innerHTML,/このランドマークを攻略する/);
});
