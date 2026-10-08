const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

function fresh() { return {...E.initial(), mode:'demo'}; }
function winEncounter(base,place='wood',elite=false) {
  let s=E.start(base,place);
  assert.ok(s.expedition);
  if (elite) s.expedition.room=4;
  s=E.act(s,'careful');
  assert.equal(s.expedition.stage,'fight');
  s.expedition.enemy.hp=1;
  s=E.act(s,'strike');
  return s;
}
test('all new locations reward materials, never finished equipment', () => {
  for (const [place,material] of [['wood','wolfFang'],['tower','watchIron'],['fen','marshFiber']]) {
    const s=fresh();
    s.unlocked=[...new Set([...s.unlocked,place])];
    const n=winEncounter(s,place,true);
    assert.equal(n.expedition.stage,'cleared');
    assert.deepEqual(n.expedition.gear,[]);
    assert.equal(n.expedition.materials[material],2);
    assert.equal(n.materials[material],0);
    const banked=E.act(n,'return');
    assert.equal(banked.materials[material],2);
    assert.deepEqual(banked.report.newGear,[]);
    assert.deepEqual(E.parse(E.serialize(banked)),banked);
  }
});

test('deeper and risky enemies still drop materials but not weapons', () => {
  let s=winEncounter(fresh(),'wood',true);
  s=E.act(s,'deeper');
  s.expedition.room=4;
  s=E.act(s,'careful');
  s.expedition.enemy.hp=1;
  s=E.act(s,'strike');
  assert.equal(s.expedition.stage,'cleared');
  assert.deepEqual(s.expedition.gear,[]);
  assert.ok(s.expedition.materials.wolfFang>=5);
  assert.match(E.lootCue('wood',2),/牙/);
});

test('smith converts regional materials into combat gear, no repeated free crafting', () => {
  for (const [item,material] of [['forged_fang','wolfFang'],['shield','watchIron'],['bow','marshFiber']]) {
    let s=fresh(); s.materials[material]=2; s.scrap=8;
    assert.equal(E.craftItem(s,item),s);
    s=E.switchCharacter(s,1);
    const crafted=E.craftItem(s,item);
    assert.notEqual(crafted,s);
    assert.equal(crafted.materials[material],0);
    assert.equal(crafted.scrap,4);
    assert.ok(crafted.owned.includes(item));
    assert.equal(E.craftItem(crafted,item),crafted);
    const returned=E.switchCharacter(crafted,0);
    const equipped=E.equip(returned,item);
    assert.equal(equipped.equipped,item);
    assert.deepEqual(E.parse(E.serialize(equipped)),equipped);
  }
});

test('falling in battle forfeits carried regional material', () => {
  let s=E.start(fresh(),'wood');
  s=E.act(s,'careful');
  s.expedition.materials.wolfFang=3;
  s.expedition.hp=1;
  s=E.act(s,'strike');
  assert.equal(s.expedition,null);
  assert.equal(s.report.died,true);
  assert.equal(s.materials.wolfFang,0);
});

test('old in-flight gear survives migration and one safe return (not a new drop)', () => {
  let s=E.start(fresh(),'wood');
  s.expedition.gear=['fang_blood'];
  s.expedition.gearQuality=[2];
  s.expedition.materials={wolfFang:1};
  s.materials={wolfFang:1};
  const migrated=E.parse(JSON.stringify(s));
  assert.ok(migrated);
  assert.equal(migrated.expedition.materials.marshFiber,0);
  assert.equal(migrated.materials.watchIron,0);
  const returned=E.act(migrated,'return');
  assert.ok(returned.owned.includes('fang_blood'));
  assert.equal(returned.materials.wolfFang,2);
  assert.equal(E.act(returned,'return'),returned);
  assert.deepEqual(E.parse(E.serialize(returned)),returned);
});

test('non-equippable crown remains the story relic', () => {
  const s=fresh();
  s.unlocked=['wood','tower','crypt']; s.cleared=['wood','tower'];
  let n=winEncounter(s,'crypt',true);
  assert.deepEqual(n.expedition.gear,['crown']);
  n=E.act(n,'return');
  assert.ok(n.owned.includes('crown'));
  assert.equal(E.equip({...n,report:null},'crown').equipped,'rust');
});
