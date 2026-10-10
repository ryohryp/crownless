const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../src/travel-footprints.js');
const tower={latitude:35.658656,longitude:139.745364,accuracy:8,speed:0};
const skytree={latitude:35.7101,longitude:139.8107,accuracy:8,speed:0};
const osaka={latitude:34.68734,longitude:135.526,accuracy:8,speed:0};
const other={latitude:35.7521,longitude:139.8623,accuracy:8,speed:0};
const day='2026-10-10';

test('Tokyo Tower reveals named fantasy tower rather than random grid cell',()=>{
  const found=T.locate(tower);
  assert.equal(found.status,'ok');
  assert.equal(found.place.realName,'東京タワー');
  assert.equal(found.place.name,'紅蓮の望楼');
  assert.equal(found.place.biome,'tower');
  assert.equal(T.locate({...tower,latitude:tower.latitude+0.001}).status,'ok');
});
test('first nearby visit earns one permanent seal, repeated same day does not farm stamps',()=>{
  const first=T.record(T.initial(),tower,day);
  assert.equal(first.status,'first');
  assert.equal(first.place.seal,'紅蓮の塔印');
  assert.equal(first.journal.places.length,1);
  assert.deepEqual(first.place.visits,[day]);
  const twice=T.record(first.journal,tower,day);
  assert.equal(twice.status,'same-day');
  assert.equal(twice.journal,first.journal);
  const again=T.record(first.journal,tower,'2026-10-12');
  assert.equal(again.status,'revisited');
  assert.equal(again.journal.places.length,1);
  assert.deepEqual(again.journal.places[0].visits,[day,'2026-10-12']);
});
test('different landmarks create distinct fantasy pins including remote travel',()=>{
  const a=T.record(T.initial(),tower,day);
  const b=T.record(a.journal,skytree,day);
  const c=T.record(b.journal,osaka,day);
  const names=T.discovered(c.journal).map(p=>p.name);
  assert.equal(c.journal.places.length,3);
  assert.ok(names.includes('紅蓮の望楼'));
  assert.ok(names.includes('天穿つ白塔'));
  assert.ok(names.includes('翠冠の王城'));
});
test('no known landmark means no invented generic stamp',()=>{
  const empty=T.initial();
  assert.equal(T.record(empty,other,day).status,'no-landmark');
  assert.equal(T.record(empty,other,day).journal,empty);
});
test('quality, motion and incorrect GPS are rejected',()=>{
  const base=T.initial();
  for(const fix of [{...tower,accuracy:90},{...tower,speed:3},{...tower,latitude:Infinity},{...tower,longitude:999}]) {
    const result=T.record(base,fix,day);
    assert.equal(result.journal,base);
    assert.notEqual(result.status,'first');
  }
});
test('only earned landmark IDs and visit days are stored, no notes or precise GPS',()=>{
  const saved=JSON.stringify(T.record(T.initial(),tower,day).journal);
  assert.deepEqual(Object.keys(T.parse(saved).places[0]).sort(),['firstDate','id','visits']);
  for(const forbidden of ['latitude','longitude','accuracy','note','label','東京タワー','35.658656','139.745364'])
    assert.ok(!saved.includes(forbidden),forbidden);
  assert.deepEqual(T.parse(saved),T.record(T.initial(),tower,day).journal);
});
test('legacy diary saves are deliberately rejected and start a new game journal',()=>{
  assert.deepEqual(T.parse('oops'),T.initial());
  assert.deepEqual(T.parse('{"version":1,"places":[]}'),T.initial());
  assert.deepEqual(T.parse('{"version":2,"places":[]}'),T.initial());
  assert.deepEqual(T.parse(JSON.stringify({version:3,places:[{id:'<script>',visits:[]}]})),T.initial());
});
