const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
const M = require('../src/fen-field.js');

const fresh = (trained = false) => {
  const s = E.discover({...E.initial(),mode:'demo'},'fen');
  if(trained)s.characters[0].skills.trailReading = true;
  return s;
};
const walk = (s,...positions) => positions.reduce((current,to)=>E.act(current,'fen-step:'+to),s);
const approach = trained => walk(E.start(fresh(trained),'fen'),21,16,M.APPROACH);
const reachStar = () => {
  const atBank = approach(true);
  const opened = E.act(atBank,'fen-step:'+M.CAUSEWAY);
  const crossed = E.act(opened,'fen-step:'+M.CAUSEWAY);
  return E.act(crossed,'fen-step:'+M.STAR);
};

test('the causeway stays actual deep water for an untrained traveler, not a hinted shortcut',()=>{
  const untrained=approach(false);
  assert.equal(untrained.expedition.fen.pos,M.APPROACH);
  assert.equal(untrained.expedition.fen.trail,false);
  assert.equal(M.kind(M.CAUSEWAY),'causeway');
  assert.equal(M.canMove(untrained.expedition.fen,M.CAUSEWAY),false);
  assert.equal(M.uncover(untrained.expedition.fen,M.CAUSEWAY),null);
  assert.equal(E.act(untrained,'fen-step:'+M.CAUSEWAY),untrained);
  assert.equal(E.parse(E.serialize(untrained)).expedition.fen.trail,false);
});

test('trail reading discovers a separate safe route without teleporting or spoiling the original shoal',()=>{
  const atBank=approach(true);
  const beforeHp=atBank.expedition.hp;
  assert.match(atBank.expedition.log[0],/獣の足跡/);
  const opened=E.act(atBank,'fen-step:'+M.CAUSEWAY);
  assert.equal(opened.expedition.fen.pos,M.APPROACH,'first tap investigates in place');
  assert.equal(opened.expedition.fen.trail,true);
  assert.equal(opened.expedition.fen.shoal,false,'the dangerous old shoal remains separate');
  assert.equal(opened.expedition.fen.seen,atBank.expedition.fen.seen,'uncover must not move or reveal distant tiles');
  assert.equal(E.parse(E.serialize(opened)).expedition.fen.trail,true);
  const crossed=E.act(opened,'fen-step:'+M.CAUSEWAY);
  assert.equal(crossed.expedition.fen.pos,M.CAUSEWAY);
  assert.equal(crossed.expedition.hp,beforeHp);
  assert.equal(E.act(crossed,'fen-step:'+M.REEDS),crossed,'no non-adjacent jump');
  const star=E.act(crossed,'fen-step:'+M.STAR);
  assert.equal(star.expedition.fen.pos,M.STAR);
  assert.equal(star.expedition.hp,beforeHp,'new path avoids the original shoal HP loss');
  assert.equal(star.expedition.materials.marshFiber,1);
  assert.equal(star.expedition.scrap,4);
  assert.equal(star.expedition.foundDesign,'bow_hunter');
  assert.equal(star.designs.bow_hunter,undefined,'blueprint is still in the risky backpack');
  assert.deepEqual(E.parse(E.serialize(star)),star);
});

test('safe return unlocks smith-only gray-feather bow and its existing opening attack trait',()=>{
  let returned=E.act(reachStar(),'return');
  assert.equal(returned.report.died,false);
  assert.equal(returned.report.newDesign,'bow_hunter');
  assert.equal(returned.designs.bow_hunter,'fen');
  assert.equal(returned.materials.marshFiber,1);
  assert.equal(returned.scrap,4);
  assert.deepEqual(E.parse(E.serialize(returned)),returned);
  returned={...returned,report:null};
  returned.materials={...returned.materials,marshFiber:3,wolfFang:1};
  returned.scrap=6;
  assert.equal(E.craftItem(returned,'bow_hunter'),returned,'adventurer cannot make a weapon');
  let smith=E.switchCharacter(returned,1);
  smith=E.craftItem(smith,'bow_hunter');
  assert.equal(smith.owned.includes('bow_hunter'),true);
  assert.equal(smith.materials.marshFiber,0);
  assert.equal(smith.materials.wolfFang,0);
  assert.equal(smith.scrap,0);
  assert.equal(smith.characters[1].experience,1);
  const adventurer=E.equip(E.switchCharacter(smith,0),'bow_hunter');
  assert.equal(E.combatProfile(adventurer).openBonus,3);
  assert.deepEqual(E.parse(E.serialize(adventurer)),adventurer);
  assert.equal(E.craftItem(smith,'bow_hunter'),smith,'cannot repeatedly manufacture a unique owned gear ID');
});

test('dying before return loses the blueprint; returning over the old path cannot fake it',()=>{
  const atStar=reachStar();
  let fight=walk(atStar,M.CAUSEWAY,M.APPROACH,16,M.REEDS,M.HERBS,13,M.WRAITH);
  assert.equal(fight.expedition.stage,'fight');
  fight.expedition.hp=1;
  const dead=E.act(fight,'strike');
  assert.equal(dead.expedition,null);
  assert.equal(dead.report.died,true);
  assert.equal(dead.designs.bow_hunter,undefined);
  assert.equal(dead.report.newDesign,undefined);
  assert.deepEqual(E.parse(E.serialize(dead)),dead);

  const ordinary=E.start(fresh(true),'fen');
  const reeds=walk(ordinary,21,22,M.REEDS);
  const shoalOpen=E.act(reeds,'fen-step:'+M.SHOAL);
  assert.equal(shoalOpen.expedition.fen.shoal,true);
  const overShoal=walk(shoalOpen,M.SHOAL,M.STAR);
  assert.equal(overShoal.expedition.hp,ordinary.expedition.hp-3);
  assert.equal(overShoal.expedition.foundDesign,undefined);
  assert.equal(E.act(overShoal,'return').designs.bow_hunter,undefined);
});

test('old wetland saves without trail migrate and tampered unlocks are rejected',()=>{
  const old=E.start(fresh(),'fen');
  delete old.expedition.fen.trail;
  const parsed=E.parse(E.serialize(old));
  assert.ok(parsed,'optional new terrain state must preserve old saves');
  assert.equal(parsed.expedition.fen.trail,undefined);
  assert.equal(M.canMove(parsed.expedition.fen,M.CAUSEWAY),false);
  const forged=fresh();
  forged.designs.bow_hunter='wood';
  assert.equal(E.parse(E.serialize(forged)),null,'arbitrary recipe unlock is not a valid save');
  const impossible=E.start(fresh(),'fen');
  impossible.expedition.fen.pos=M.CAUSEWAY;
  impossible.expedition.fen.seen+=2**M.CAUSEWAY;
  assert.equal(E.parse(E.serialize(impossible)),null,'cannot stand on a hidden route without finding it');
});
