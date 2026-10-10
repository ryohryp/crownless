const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const N = require('../src/neighborhood.js');
const fresh = () => ({...E.initial(),mode:'demo'});

function commissionAtSelectedWood() {
  let s=E.discoverDistrict(fresh(),N.cell(0,-800));
  assert.equal(s.neighborhood.selected,'-2,0');
  s.materials.wolfFang=2;
  s.scrap=4;
  s=E.switchCharacter(s,1);
  s=E.supplyCommission(s,'wood');
  assert.equal(s.commission.pending,'wood');
  return E.switchCharacter(s,0);
}
function winFirst(s) {
  let n=E.act(s,'careful');
  assert.equal(n.expedition.stage,'fight');
  n.expedition.enemy.hp=1;
  return E.act(n,'strike');
}
test('a completed smith commission leaves one named trace at the visited district',()=>{
  let s=commissionAtSelectedWood();
  s=E.start(s,'wood');
  assert.equal(s.neighborhood.active,'-2,0');
  s=winFirst(s);
  assert.equal(N.get(s.neighborhood,'-2,0').aided,false,'a fight alone does not secure a sign');
  s=E.act(s,'return');
  assert.equal(s.commission.pending,null);
  assert.equal(s.commission.completed,1);
  assert.equal(N.get(s.neighborhood,'-2,0').aided,true);
  assert.equal(N.get(s.neighborhood,'-1,0').aided,false,'other woodland district unchanged');
  assert.equal(N.trace(N.get(s.neighborhood,'-2,0')).name,'斥候の道標');
  assert.deepEqual(E.parse(E.serialize(s)),s);
  assert.equal(E.act(s,'return'),s,'cannot mint repeated progress via report');

  s={...s,report:null};
  s=E.start(s,'wood');
  const bonus=winFirst(s);
  assert.equal(bonus.expedition.materials.wolfFang,2,'1 fang from wolf + 1 from local trail');
  assert.equal(bonus.materials.wolfFang,1,'the extra resource stays inside the backpack');
  assert.match(bonus.expedition.log.join(' '),/斥候の道標.*狼牙 \+1/);
  assert.deepEqual(E.parse(E.serialize(bonus)),bonus);
  const settled=E.act(bonus,'return');
  assert.equal(settled.materials.wolfFang,3,'newly earned fang and local bonus are banked once');
  assert.equal(N.get(settled.neighborhood,'-2,0').aided,true,'trace remains on revisit');
});

test('a first-fight trail bonus is place-bound even for another district of same biome',()=>{
  let s=E.act(winFirst(E.start(commissionAtSelectedWood(),'wood')),'return');
  s={...s,report:null};
  s=E.selectDistrict(s,'-1,0');
  assert.equal(s.neighborhood.selected,'-1,0');
  s=winFirst(E.start(s,'wood'));
  assert.equal(s.expedition.materials.wolfFang,1);
  assert.equal(N.get(s.neighborhood,'-2,0').aided,true);
});

test('one aided district grants only one bonus fight each expedition',()=>{
  let s=E.act(winFirst(E.start(commissionAtSelectedWood(),'wood')),'return');
  s={...s,report:null};
  s=winFirst(E.start(s,'wood'));
  assert.equal(s.expedition.materials.wolfFang,2);
  const x=s.expedition;
  s=E.act(s,E.isRoadsideEvent(s,x) ? 'pray' : 'rest');
  assert.equal(s.expedition.room,2);
  s=winFirst(s);
  assert.equal(s.expedition.materials.wolfFang,3,'second kill yields only one fang');
});

test('zero-fight return and defeat do not write an NPC trace',()=>{
  const s=commissionAtSelectedWood();
  const empty=E.act(E.start(s,'wood'),'return');
  assert.equal(empty.commission.pending,'wood');
  assert.equal(N.get(empty.neighborhood,'-2,0').aided,false);
  let doomed=E.act(E.start(s,'wood'),'careful');
  doomed.expedition.hp=1;
  doomed=E.act(doomed,'strike');
  assert.equal(doomed.report.died,true);
  assert.equal(doomed.commission.pending,'wood');
  assert.equal(N.get(doomed.neighborhood,'-2,0').aided,false);
});

test('old district saves gain false trace; invalid and forged fields do not pass validation',()=>{
  let s=E.discoverDistrict(fresh(),N.cell(0,-800));
  const old=JSON.parse(E.serialize(s));
  for(const d of old.neighborhood.districts) delete d.aided;
  const migrated=E.parse(JSON.stringify(old));
  assert.ok(migrated);
  assert.equal(N.get(migrated.neighborhood,'-2,0').aided,false);
  assert.deepEqual(E.parse(E.serialize(migrated)),migrated);
  for(const invalid of [null,'yes',1,{},[]]) {
    const bad=JSON.parse(E.serialize(s));
    bad.neighborhood.districts[0].aided=invalid;
    assert.equal(E.parse(JSON.stringify(bad)),null);
  }
  const spoof=JSON.parse(E.serialize(s));
  spoof.neighborhood.districts[0].latitude=35;
  assert.equal(E.parse(JSON.stringify(spoof)),null,'no precise coordinates accepted');
});
