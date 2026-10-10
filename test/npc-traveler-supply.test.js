const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');
const fresh = () => ({...E.initial(),mode:'demo'});
const tower = () => N.cell(400,0);

function smithSent(s) {
  s.materials.wolfFang = 2; s.scrap = 4;
  s = E.switchCharacter(s,1);
  s = E.supplyCommission(s,'wood');
  assert.equal(s.commission.pending,'wood');
  return E.switchCharacter(s,0);
}
function winAndReturn(s,place='wood') {
  let n = E.start(s,place);
  n = E.act(n,'careful');
  assert.equal(n.expedition.stage,'fight');
  n.expedition.enemy.hp = 1;
  n = E.act(n,'strike');
  assert.equal(n.expedition.stage,'path');
  return E.act(n,'return');
}
function delivered() {
  let s = E.discoverDistrict(fresh(),tower());
  s = E.selectDistrict(s,'-1,0');
  return winAndReturn(smithSent(s));
}

test('commissioned scout path brings another fictional traveler to a DIFFERENT known district',()=>{
  const s=delivered();
  assert.equal(s.commission.pending,null);
  assert.equal(N.get(s.neighborhood,'-1,0').aided,true);
  assert.equal(N.get(s.neighborhood,'-1,0').visitor,'none');
  assert.equal(N.get(s.neighborhood,'0,1').visitor,'supplies');
  assert.equal(s.neighborhood.result.visitorId,'0,1');
  assert.equal(N.traveler(N.get(s.neighborhood,'0,1')).name,'旅の薬師・イオ');
  assert.deepEqual(E.parse(E.serialize(s)),s);
  assert.equal(E.act(s,'return'),s,'duplicate report cannot create another parcel');
});

test('visiting wrong place does not consume NPC supplies; marked departure consumes exactly once',()=>{
  let s=delivered();
  s={...s,report:null};
  assert.equal(s.neighborhood.selected,'-1,0');
  const wrong=E.start(s,'wood');
  assert.equal(N.get(wrong.neighborhood,'0,1').visitor,'supplies');
  assert.equal(wrong.expedition.potions,3,'commission herb support belongs to original place');
  s=E.act(wrong,'return'); s={...s,report:null};
  s=E.selectDistrict(s,'0,1');
  const first=E.start(s,'tower');
  assert.equal(first.expedition.potions,3,'NPC parcel changes the next expedition');
  assert.equal(N.get(first.neighborhood,'0,1').visitor,'used');
  assert.match(first.expedition.log.join(' '),/架空NPC.*補給袋を受け取った/);
  assert.deepEqual(E.parse(E.serialize(first)),first);
  assert.equal(E.start(first,'tower'),first,'ongoing expedition never consumes twice');
  s=E.act(first,'return'); s={...s,report:null};
  const again=E.start(s,'tower');
  assert.equal(again.expedition.potions,2,'parcel cannot be farmed by repeat departure');
  assert.equal(N.get(again.neighborhood,'0,1').visitor,'used');
});

test('commission herb support does not waste a still-available overlapping NPC parcel',()=>{
  let s=delivered(); s={...s,report:null};
  s=E.selectDistrict(s,'0,1');
  // Emulate a separate NPC order yielding support in that exact region.
  s.commission.support='tower';
  const first=E.start(s,'tower');
  assert.equal(first.expedition.potions,3);
  assert.equal(N.get(first.neighborhood,'0,1').visitor,'supplies','already capped herb keeps parcel');
  s=E.act(first,'return');s={...s,report:null};
  const next=E.start(s,'tower');
  assert.equal(next.expedition.potions,3,'parcel can still be claimed exactly once');
  assert.equal(N.get(next.neighborhood,'0,1').visitor,'used');
  s=E.act(next,'return');s={...s,report:null};
  assert.equal(E.start(s,'tower').expedition.potions,2);
});

test('one known district defers fictional traveler until the next discovered district',()=>{
  let s=winAndReturn(smithSent(fresh()));
  assert.equal(s.neighborhood.result.visitorId,null);
  assert.equal(N.get(s.neighborhood,'-1,0').aided,true);
  s={...s,report:null};
  s=E.discoverDistrict(s,tower());
  assert.equal(N.get(s.neighborhood,'0,1').visitor,'supplies');
  assert.equal(N.get(s.neighborhood,'-1,0').visitor,'none');
  assert.deepEqual(E.parse(E.serialize(s)),s);
  // Discovering the same cell again cannot spawn another parcel.
  s=E.discoverDistrict(s,tower());
  assert.equal(s.neighborhood.districts.length,2);
  assert.equal(s.neighborhood.districts.filter(d=>d.visitor==='supplies').length,1);
});

test('zero-fight return and death cannot create traveler parcels',()=>{
  let s=smithSent(E.selectDistrict(E.discoverDistrict(fresh(),tower()),'-1,0'));
  const empty=E.act(E.start(s,'wood'),'return');
  assert.equal(N.get(empty.neighborhood,'0,1').visitor,'none');
  assert.equal(empty.neighborhood.result.visitorId,null);
  assert.equal(empty.commission.pending,'wood');
  let doomed=E.act(E.start(s,'wood'),'careful');
  doomed.expedition.hp=1;
  doomed=E.act(doomed,'strike');
  assert.equal(doomed.report.died,true);
  assert.equal(N.get(doomed.neighborhood,'0,1').visitor,'none');
  assert.equal(doomed.neighborhood.result.visitorId,null);
});

test('legacy visitor and return result migrate, and forged visitor state is rejected',()=>{
  const current=delivered();
  const old=JSON.parse(E.serialize(current));
  for(const d of old.neighborhood.districts) delete d.visitor;
  delete old.neighborhood.result.visitorId;
  const parsed=E.parse(JSON.stringify(old));
  assert.ok(parsed);
  assert.ok(parsed.neighborhood.districts.every(d=>d.visitor==='none'));
  assert.equal(parsed.neighborhood.result.visitorId,null);
  assert.deepEqual(E.parse(E.serialize(parsed)),parsed);
  for(const value of ['gift',null,1,{},false]) {
    const bad=JSON.parse(E.serialize(current));
    bad.neighborhood.districts[0].visitor=value;
    assert.equal(E.parse(JSON.stringify(bad)),null,'strict visitor enum');
  }
  const badResult=JSON.parse(E.serialize(current));
  badResult.neighborhood.result.visitorId='-1,0';
  assert.equal(E.parse(JSON.stringify(badResult)),null,'report cannot invent parcel on origin');
  const extra=JSON.parse(E.serialize(current));
  extra.neighborhood.districts[1].latitude=35;
  assert.equal(E.parse(JSON.stringify(extra)),null,'never store precise geolocation in trace');
});
