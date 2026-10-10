const test=require('node:test');
const assert=require('node:assert/strict');
const T=require('../src/travel-footprints.js');
const home={latitude:35.7521,longitude:139.8623,accuracy:8,speed:0};
const far={latitude:34.7123,longitude:135.4872,accuracy:8,speed:0};
const day='2026-10-10';
test('first footprint, same-day idempotency and later revisit share a single stamp',()=>{
  const first=T.record(T.initial(),home,day);
  assert.equal(first.status,'first');
  assert.equal(first.journal.places.length,1);
  assert.equal(first.place.visits[0].date,day);
  const duplicate=T.record(first.journal,home,day);
  assert.equal(duplicate.status,'same-day');
  assert.equal(duplicate.journal,first.journal);
  const later=T.record(first.journal,home,'2027-03-12');
  assert.equal(later.status,'revisited');
  assert.equal(later.journal.places.length,1);
  assert.equal(later.place.visits.length,2);
  assert.equal(later.place.firstDate,day);
});
test('distant journey creates a second stable land without an anchor',()=>{
  const a=T.record(T.initial(),home,day);
  assert.equal(a.status,'first');
  const b=T.record(a.journal,far,day);
  assert.equal(b.status,'first');
  assert.equal(b.journal.places.length,2);
  assert.notEqual(a.place.id,b.place.id);
  assert.equal(T.record(b.journal,home,'2026-10-11').status,'revisited');
});
test('visit notes and labels are private user-entered annotations',()=>{
  const a=T.record(T.initial(),home,day);
  const b=T.rename(T.annotate(a.journal,a.place.id,day,'家族の旅行'),a.place.id,'旅先の港');
  assert.equal(b.places[0].label,'旅先の港');
  assert.equal(b.places[0].visits[0].note,'家族の旅行');
  assert.equal(a.journal.places[0].visits[0].note,'');
  assert.deepEqual(T.parse(JSON.stringify(b)),b);
});
test('inaccurate, moving and boundary observations cannot record',()=>{
  const base=T.initial();
  for(const fix of [{...home,accuracy:90},{...home,speed:3},{...home,latitude:Infinity},{...home,longitude:999}]){
    const r=T.record(base,fix,day);
    assert.equal(r.journal,base);
    assert.notEqual(r.status,'first');
  }
  const nearGrid={latitude:0,longitude:0,accuracy:10,speed:0};
  assert.equal(T.record(base,nearGrid,day).status,'boundary');
});
test('stored record has no raw coordinates, route or time-of-day',()=>{
  const saved=JSON.stringify(T.record(T.initial(),home,day).journal);
  assert.ok(!saved.includes('latitude')&&!saved.includes('longitude')&&!saved.includes('accuracy'));
  assert.ok(!saved.includes('35.7521')&&!saved.includes('139.8623'));
  assert.ok(!saved.includes('speed')&&!saved.includes('route'));
});
test('malformed stored data resets safely',()=>{
  assert.deepEqual(T.parse('oops'),T.initial());
  assert.deepEqual(T.parse(JSON.stringify({version:1,places:[{id:'<img src=x>',visits:[]}]})),T.initial());
});
