const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const F=require('../src/travel-footprints.js');
const code=fs.readFileSync(path.join(__dirname,'../src/travel-chronicle-ui.js'),'utf8');
function setup(seed={},fails=false) {
  const values=new Map(Object.entries(seed));
  const context={
    CrownlessTravelFootprints:F,
    localStorage:{
      getItem:k=>{if(fails)throw Error('blocked');return values.get(k)||null;},
      setItem:(k,v)=>{if(fails)throw Error('blocked');values.set(k,v);}
    }
  };
  context.window=context;
  vm.runInNewContext(code,context);
  return {values,ui:context.CrownlessTravelChronicleUI};
}
const near={latitude:35.7521,longitude:139.8623,accuracy:8,speed:0};
const distant={latitude:34.7123,longitude:135.4872,accuracy:8,speed:0};
test('explicit GPS visit is persisted to private walk book, not game state',()=>{
  const b=setup();
  const r=b.ui.recordFootprint(near,'walk','2026-10-10');
  assert.equal(r.status,'first');
  const raw=b.values.get('crownless-travel-footprints-v1-walk');
  assert.ok(raw);
  assert.equal(F.parse(raw).places.length,1);
  assert.ok(!raw.includes('latitude')&&!raw.includes('longitude'));
  assert.equal(b.values.get('crownless-expedition-v1-walk'),undefined);
});
test('remote travel and repeat visit survive reopening',()=>{
  const b=setup();
  b.ui.recordFootprint(near,'walk','2026-10-10');
  assert.equal(b.ui.recordFootprint(distant,'walk','2026-10-10').status,'first');
  const reload=setup(Object.fromEntries(b.values));
  assert.equal(reload.ui.recordFootprint(near,'walk','2026-10-12').status,'revisited');
  const places=reload.ui.getFootprints('walk').places;
  assert.equal(places.length,2);
  assert.equal(places.find(p=>p.id===F.locate(near).id).visits.length,2);
  assert.equal(reload.ui.recordFootprint(near,'walk','2026-10-12').status,'same-day');
});
test('demo visits are isolated from the real travel journal',()=>{
  const b=setup({'crownless-expedition-mode':'demo'});
  b.ui.recordFootprint(near,'demo','2026-10-10');
  assert.equal(b.ui.getFootprints('demo').places.length,1);
  assert.equal(b.ui.getFootprints('walk').places.length,0);
});
test('failed storage never claims a stamp has been saved',()=>{
  const b=setup({},true);
  assert.equal(b.ui.recordFootprint(near,'walk','2026-10-10').status,'save-failed');
  assert.equal(b.ui.getFootprints('walk').places.length,0);
});
