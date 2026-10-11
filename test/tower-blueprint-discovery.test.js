const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../src/slice-engine.js');
const N=require('../src/neighborhood.js');
const tower=N.cell(400,0);
const shop=N.cell(800,0);
const demo=()=>({...E.initial(),mode:'demo'});
const event=()=>E.discoverDistrict(demo(),tower);
function defeatFirstClue(s=event()) {
  const fight=E.startWithLocalClue(s);
  assert.equal(fight.expedition.stage,'fight');
  fight.expedition.enemy.hp=1; // Normal victory through act(), not a minted schematic.
  return E.act(fight,'strike');
}

test('the tower event reveals a unique at-risk smith blueprint, banked only on safe return',()=>{
  const found=event();
  assert.deepEqual(found.designs,{});
  const ordinary=E.act(E.start(found,'tower'),'careful');
  ordinary.expedition.enemy.hp=1;
  const normalWin=E.act(ordinary,'strike');
  assert.equal(normalWin.expedition.foundDesign,undefined,'ordinary tower battle cannot reveal the recipe');
  const won=defeatFirstClue(found);
  assert.equal(won.expedition.foundDesign,'shield_thorn');
  assert.equal(won.materials.watchIron,0);
  assert.deepEqual(won.designs,{},'victory by itself does not unlock the design');
  assert.deepEqual(E.parse(E.serialize(won)),won,'unbanked scroll and provenance survive reload');
  const home=E.act(won,'return');
  assert.equal(home.designs.shield_thorn,tower.id,'the exact discovered source is remembered');
  assert.equal(home.report.newDesign,'shield_thorn');
  assert.equal(home.materials.watchIron,2);
  assert.deepEqual(E.parse(E.serialize(home)),home,'banked blueprint and reward survive reload');
});

test('no blueprint on failed run, shop discovery, other biome, or repeated clears',()=>{
  const found=event();
  const atShop=E.discoverDistrict(found,shop);
  assert.equal(E.startWithLocalClue(atShop),atShop);
  const won=defeatFirstClue();
  const advance=E.act(won,E.isRoadsideEvent(won)?'pray':'rest');
  const battle=E.act(advance,'careful');
  assert.equal(battle.expedition.stage,'fight');
  battle.expedition.hp=1;
  const dead=E.act(battle,'flee');
  assert.equal(dead.report.died,true);
  assert.deepEqual(dead.designs,{},'found-but-lost design does not unlock anything');
  assert.equal(dead.report.newDesign,undefined);
  const early=E.act(E.startWithLocalClue(event()),'flee');
  assert.deepEqual(early.designs,{},'retreat before victory does not give design');
  const forest=E.startWithLocalClue(demo());
  forest.expedition.enemy.hp=1;
  assert.equal(E.act(forest,'strike').expedition.foundDesign,undefined);
  const safe=E.act(defeatFirstClue(),'return');
  const replay=E.startWithLocalClue({...safe,report:null});
  replay.expedition.enemy.hp=1;
  const another=E.act(replay,'strike');
  assert.equal(another.expedition.foundDesign,undefined);
});

test('a smith needs learned design, watch iron, forest fang and scrap to craft a tactical shield',()=>{
  const safe=E.act(defeatFirstClue(),'return');
  const base={...safe,report:null,scrap:6,materials:{...safe.materials,wolfFang:1}};
  const novice=E.switchCharacter({...base,designs:{}},1);
  assert.equal(E.craftItem(novice,'shield_thorn'),novice,'without learning a design, raw materials are not enough');
  const learned=E.switchCharacter(base,1);
  const crafted=E.craftItem(learned,'shield_thorn');
  assert.ok(crafted.owned.includes('shield_thorn'));
  assert.equal(crafted.materials.watchIron,0);
  assert.equal(crafted.materials.wolfFang,0);
  assert.equal(crafted.scrap,0);
  assert.equal(crafted.characters[1].experience,1);
  const traveler=E.switchCharacter(crafted,0);
  const equipped=E.equip(traveler,'shield_thorn');
  const profile=E.combatProfile(equipped);
  assert.equal(profile.family,'shield');
  assert(profile.counter>0);
  assert(profile.block<E.combatProfile({...equipped,equipped:'shield'}).block);
  assert.deepEqual(E.parse(E.serialize(equipped)),equipped);
});

test('old saves migrate safely; forged or unknown blueprint origins fail closed',()=>{
  const old=demo();
  delete old.designs;
  assert.deepEqual(E.parse(E.serialize(old)).designs,{});
  const found=event();
  found.designs={shield_thorn:'-1,0'};
  assert.equal(E.parse(E.serialize(found)),null,'a forest location cannot provide the tower design');
  found.designs={shield_thorn:'0,1'};
  assert.deepEqual(E.parse(E.serialize(found)),found);
  found.designs={secret_wand:'0,1'};
  assert.equal(E.parse(E.serialize(found)),null,'unknown design is never silently accepted');
});
