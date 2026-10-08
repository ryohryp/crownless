const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const fresh = () => ({...E.initial(),mode:'demo'});

function winOne(s,place) {
  let n=E.start(s,place);
  assert.notEqual(n,s,'the adventurer must be able to depart');
  n=E.act(n,'careful');
  assert.equal(n.expedition.stage,'fight');
  n.expedition.enemy.hp=1;
  n=E.act(n,'strike');
  assert.equal(n.expedition.stage,'path');
  return E.act(n,'return');
}
function prepared(place='wood') {
  const s=fresh();
  s.unlocked=[...new Set([...s.unlocked,place])];
  s.materials[Object.keys(E.RECIPES[E.COMMISSIONS[place].recipe].materials)[0]]=4;
  s.scrap=10;
  return s;
}

test('NPC order is a smith-only decision distinct from creating an owned weapon', () => {
  let s=prepared();
  assert.equal(E.supplyCommission(s,'wood'),s);
  s=E.switchCharacter(s,1);
  const sent=E.supplyCommission(s,'wood');
  assert.notEqual(sent,s);
  assert.equal(sent.materials.wolfFang,2);
  assert.equal(sent.scrap,6);
  assert.equal(sent.commission.pending,'wood');
  assert.equal(sent.commission.completed,0);
  assert.equal(sent.characters[1].experience,1);
  assert.deepEqual(sent.owned,['rust'],'an NPC receives the forged blade, not the account');
  assert.equal(E.supplyCommission(sent,'wood'),sent,'repeat clicks cannot consume again');
  assert.deepEqual(E.parse(E.serialize(sent)),sent,'pending order survives reload');
});

test('an NPC reports after at least one encounter and safe return in the matching region', () => {
  let s=E.supplyCommission(E.switchCharacter(prepared(),1),'wood');
  s=E.switchCharacter(s,0);
  const noWork=E.act(E.start(s,'wood'),'return');
  assert.equal(noWork.commission.pending,'wood','immediate turnaround does not resolve the job');
  assert.equal(noWork.commission.completed,0);
  s={...noWork,report:null};
  const result=winOne(s,'wood');
  assert.equal(result.commission.pending,null);
  assert.equal(result.commission.completed,1);
  assert.equal(result.commission.lastResult,'wood');
  assert.equal(result.commission.support,'wood');
  assert.equal(result.scrap,s.scrap+result.report.scrap+6);
  assert.deepEqual(E.parse(E.serialize(result)),result);
  assert.equal(E.act(result,'return'),result,'report cannot pay twice');

  let ready={...result,report:null};
  const wrong=E.start(ready,'tower');
  assert.equal(wrong,ready,'undiscovered region is not a free shortcut');
  const boosted=E.start(ready,'wood');
  assert.equal(boosted.expedition.potions,3);
  assert.equal(boosted.commission.support,null);
  assert.equal(boosted.commission.lastResult,null);
  const after=E.act(boosted,'return');
  ready={...after,report:null};
  assert.equal(E.start(ready,'wood').expedition.potions,2,'one reward can only be claimed once');
});

test('other regions and defeat do not deliver a pending commission', () => {
  let s=prepared('tower');
  s.materials.watchIron=2;
  s=E.supplyCommission(E.switchCharacter(s,1),'tower');
  assert.equal(s.commission.pending,'tower');
  s=E.switchCharacter(s,0);
  const other=winOne(s,'wood');
  assert.equal(other.commission.pending,'tower');
  s={...other,report:null};
  s=E.start(s,'tower');
  s=E.act(s,'careful');
  s.expedition.hp=1;
  s=E.act(s,'strike');
  assert.equal(s.report.died,true);
  assert.equal(s.commission.pending,'tower');
  assert.equal(s.commission.completed,0);
});

test('repeatable commissioning requires fresh resources after completing the first', () => {
  let s=E.supplyCommission(E.switchCharacter(prepared(),1),'wood');
  s=E.switchCharacter(s,0);
  s=winOne(s,'wood');
  s={...s,report:null};
  s=E.switchCharacter(s,1);
  const old=s.materials.wolfFang;
  const second=E.supplyCommission(s,'wood');
  if (old>=2) {
    assert.notEqual(second,s);
    assert.equal(second.materials.wolfFang,old-2);
    assert.equal(second.commission.completed,1);
    assert.equal(second.commission.pending,'wood');
  } else assert.equal(second,s);
});

test('legacy save migrates commission safely; malformed records are rejected', () => {
  const old=prepared();
  delete old.commission;
  const loaded=E.parse(JSON.stringify(old));
  assert.ok(loaded);
  assert.deepEqual(loaded.commission,{pending:null,completed:0,support:null,lastResult:null});
  const bad=E.parse(E.serialize({...loaded,commission:{pending:'__proto__',completed:1,support:null,lastResult:null}}));
  assert.equal(bad,null);
  const duplicate=E.parse(E.serialize({...loaded,commission:{pending:null,completed:-5,support:null,lastResult:null}}));
  assert.equal(duplicate,null);
});
