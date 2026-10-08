const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

const fresh = () => ({ ...E.initial(), mode:'demo' });
function recoverWolfFang(s) {
  let n = E.start(s,'wood');
  assert.notEqual(n,s);
  n = E.act(n,'careful');
  assert.equal(n.expedition.stage,'fight');
  assert.equal(n.expedition.enemy.kind,'wolf');
  n.expedition.enemy.hp = 1;
  n = E.act(n,'strike');
  assert.equal(n.expedition.materials.wolfFang,1);
  // Use a cleared fixture to isolate banking from the lengthy legacy expedition.
  n.expedition.stage='cleared';
  n.expedition.enemy=null;
  return E.act(n,'return');
}

test('wolf fangs are risky loot and only bank on safe return', () => {
  const base=fresh();
  let running=E.start(base,'wood');
  running=E.act(running,'careful');
  running.expedition.enemy.hp=1;
  running=E.act(running,'strike');
  assert.equal(running.materials.wolfFang,0);
  assert.equal(running.expedition.materials.wolfFang,1);
  assert.deepEqual(E.parse(E.serialize(running)),running);
  const lost=E.parse(E.serialize(running));
  lost.expedition.hp=1;
  // Failed expedition never calls the safe return bank transition.
  assert.equal(lost.materials.wolfFang,0);
  const returned=recoverWolfFang(base);
  assert.equal(returned.materials.wolfFang,1);
  assert.equal(returned.report.materials.wolfFang,1);
  assert.deepEqual(E.parse(E.serialize(returned)),returned);
});

test('three characters share materials but only the smith can craft', () => {
  let s=recoverWolfFang(fresh());
  s={...s,report:null};
  s=recoverWolfFang(s);
  s={...s,report:null};
  assert.equal(s.materials.wolfFang,2);
  const before=s;
  assert.equal(E.craftWolfFang(s),s,'adventurer cannot craft');
  s=E.switchCharacter(s,1);
  assert.notEqual(s,before);
  assert.equal(s.characters.length,3);
  assert.equal(s.characters[1].role,'smith');
  assert.equal(E.start(s,'wood'),s,'smith cannot act as remote adventurer');
  s={...s,scrap:0};
  const short=E.craftWolfFang(s);
  assert.equal(short,s,'insufficient iron scraps must not consume material');
  s={...s,scrap:20};
  const crafted=E.craftWolfFang(s);
  assert.equal(crafted.materials.wolfFang,0);
  assert.equal(crafted.scrap,16);
  assert.ok(crafted.owned.includes('forged_fang'));
  assert.equal(crafted.characters[1].experience,1);
  assert.equal(E.craftWolfFang(crafted),crafted,'repeat clicks must not duplicate the weapon');
  s=E.switchCharacter(crafted,0);
  s=E.equip(s,'forged_fang');
  assert.equal(s.equipped,'forged_fang');
  assert.ok(E.weaponAttack(s)>E.weaponAttack(s,'rust'));
  assert.deepEqual(E.parse(E.serialize(s)),s);
});

test('switching is blocked mid expedition and while reviewing results', () => {
  let s=fresh();
  s=E.start(s,'wood');
  assert.equal(E.switchCharacter(s,1),s);
  s=recoverWolfFang(fresh());
  assert.equal(E.switchCharacter(s,1),s);
});

test('older valid save migrates shared warehouse and character slots', () => {
  const original=fresh();
  original.owned.push('fang');
  original.equipped='fang';
  delete original.materials;
  delete original.activeCharacter;
  delete original.characters;
  const reloaded=E.parse(JSON.stringify(original));
  assert.ok(reloaded);
  assert.equal(reloaded.materials.wolfFang,0);
  assert.equal(reloaded.characters.length,3);
  assert.equal(reloaded.characters[0].equipped,'fang');
  assert.deepEqual(E.parse(E.serialize(reloaded)),reloaded);
});

test('invalid material and roster state does not load', () => {
  const s=fresh();
  s.materials.wolfFang=-10;
  assert.equal(E.parse(JSON.stringify(s)),null);
  s.materials.wolfFang=0;
  s.characters[1].role='adventurer';
  assert.equal(E.parse(JSON.stringify(s)),null);
});
