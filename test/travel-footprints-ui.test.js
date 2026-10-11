const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const F=require('../src/travel-footprints.js');
const FO=require('../src/frontier-outpost.js');
const code=fs.readFileSync(path.join(__dirname,'../src/travel-chronicle-ui.js'),'utf8');
function setup(seed={},fails=false) {
  const values=new Map(Object.entries(seed));
  const context={
    CrownlessTravelFootprints:F,
    CrownlessFrontierOutpost:FO,
    localStorage:{
      getItem:k=>{if(fails)throw Error('blocked');return values.get(k)||null;},
      setItem:(k,v)=>{if(fails)throw Error('blocked');values.set(k,v);}
    }
  };
  context.window=context;
  vm.runInNewContext(code,context);
  const ui=context.CrownlessTravelChronicleUI;
  const render=()=>{
    const container={innerHTML:'',querySelectorAll:()=>[]};
    ui.renderChronicle(container);
    return container.innerHTML;
  };
  return {values,ui,render};
}
const tower={latitude:35.658656,longitude:139.745364,accuracy:8,speed:0};
const osaka={latitude:34.68734,longitude:135.526,accuracy:8,speed:0};
test('landmark discovery is saved in the private walk world and reflected on the map',()=>{
  const b=setup();
  const result=b.ui.recordFootprint(tower,'walk','2026-10-10');
  assert.equal(result.status,'first');
  const raw=b.values.get('crownless-travel-footprints-v1-walk');
  assert.ok(raw);
  assert.equal(F.parse(raw).places[0].id,'tokyo-tower');
  assert.equal(b.values.get('crownless-expedition-v1-walk'),undefined);
  b.ui.showFootprints('紅蓮の望楼を発見！');
  const html=b.render();
  assert.match(html,/fantasy-landmark-map-field/);
  assert.match(html,/紅蓮の望楼/);
  assert.match(html,/東京タワー/);
  assert.match(html,/発見済み/);
  assert.match(html,/👣/);
  assert.doesNotMatch(html,/<input|<textarea|旅の名前|この日の一言|思い出を保存/);
});
test('distant castle and return become two distinct discovery pins across reload',()=>{
  const b=setup();
  b.ui.recordFootprint(tower,'walk','2026-10-10');
  assert.equal(b.ui.recordFootprint(osaka,'walk','2026-10-10').status,'first');
  const reload=setup(Object.fromEntries(b.values));
  assert.equal(reload.ui.recordFootprint(tower,'walk','2026-10-12').status,'revisited');
  assert.equal(reload.ui.getFootprints('walk').places.length,2);
  const html=reload.render();
  assert.match(html,/紅蓮の望楼/);
  assert.match(html,/翠冠の王城/);
  assert.match(html,/再訪済み/);
  assert.equal(reload.ui.recordFootprint(tower,'walk','2026-10-12').status,'same-day');
});
test('unregistered locations cannot appear as arbitrary stamps',()=>{
  const b=setup();
  const result=b.ui.recordFootprint({latitude:35.7521,longitude:139.8623,accuracy:8,speed:0},'walk','2026-10-10');
  assert.equal(result.status,'no-landmark');
  assert.equal(b.ui.getFootprints('walk').places.length,0);
  assert.doesNotMatch(b.render(),/fantasy-landmark-map-field/);
});
test('demo discoveries are kept separate from real discoveries',()=>{
  const b=setup({'crownless-expedition-mode':'demo'});
  b.ui.recordFootprint(tower,'demo','2026-10-10');
  assert.equal(b.ui.getFootprints('demo').places.length,1);
  assert.equal(b.ui.getFootprints('walk').places.length,0);
});
test('failed storage does not claim earned stamps',()=>{
  const b=setup({},true);
  assert.equal(b.ui.recordFootprint(tower,'walk','2026-10-10').status,'save-failed');
  assert.equal(b.ui.getFootprints('walk').places.length,0);
});

test('opening the travel map does not create an unearned outpost or write to storage',()=>{
  const b=setup();
  const html=b.render();
  assert.equal(b.values.has('crownless-frontier-outposts-v1'),false);
  assert.equal(Object.keys(b.ui.getOutposts().outposts).length,0);
  assert.doesNotMatch(html,/囁きの森・前哨拠点/);
});
