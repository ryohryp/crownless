const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');
require('../src/enemy-adaptation-runtime.js')(E, require('../src/enemy-adaptation.js'));

function fight(kind = 'wolf', turn = 1, gear = 'rust') {
  let s = {...E.initial(), mode:'demo'};
  if (gear !== 'rust') s.owned.push(gear);
  s.equipped = gear;
  s = E.act(E.start(s,'wood'),'careful');
  Object.assign(s.expedition.enemy, {kind, turn, hp:60, maxHp:60});
  return s;
}

test('reading a heavy creates one saved opening; its attack deals exactly the preview', () => {
  let s = E.act(fight(),'dodge');
  assert.equal(s.expedition.stagger,true);
  assert.equal(s.expedition.hp,30);
  assert.deepEqual(E.parse(E.serialize(s)),s);
  const damage = E.attackPreview(s,'strike');
  const ordinary = {...s, expedition:{...s.expedition, stagger:false}};
  assert.equal(damage-E.attackPreview(ordinary,'strike'),E.weaponAttack(s));
  const hp = s.expedition.enemy.hp;
  s = E.act(s,'strike');
  assert.equal(hp-s.expedition.enemy.hp,damage);
  assert.equal(s.expedition.stagger,false);
  assert.ok(s.expedition.log.some(line => line.startsWith('崩し追撃！')));
});

test('guarding or healing spends the opening while rejected input preserves it', () => {
  const s = E.act(fight(),'dodge');
  assert.equal(E.act(s,'guard').expedition.stagger,false);
  const injured = {...s, expedition:{...s.expedition, hp:20}};
  const healed = E.act(injured,'heal');
  assert.equal(healed.expedition.stagger,false);
  assert.equal(healed.expedition.potions,1);
  const exhausted = {...s, expedition:{...s.expedition, stamina:0}};
  assert.equal(E.act(exhausted,'heavy'),exhausted);
  assert.equal(exhausted.expedition.stagger,true);
  assert.equal(E.act(s,'heal'),s,'healing at full health is rejected');
  assert.equal(E.act(s,'invalid'),s);
});

test('piercing an actual guard breaks it; an adaptive attack has no phantom guard', () => {
  const s = fight('knight',0,'bow');
  const pierced = E.act(s,'heavy');
  assert.equal(pierced.expedition.stagger,true);
  const adaptive = fight('knight',0,'bow');
  adaptive.expedition.enemy.history = ['heavy','heavy'];
  assert.equal(E.intent(adaptive.expedition.enemy).id,'intercept');
  const expected = E.attackPreview(adaptive,'heavy');
  const after = E.act(adaptive,'heavy');
  assert.equal(after.expedition.stagger,false);
  assert.equal(adaptive.expedition.enemy.hp-after.expedition.enemy.hp,expected);
  assert.equal(after.expedition.hp,adaptive.expedition.hp-10);
});

test('feint cannot create a false break or focus even when the base intent is heavy', () => {
  const s = fight();
  s.expedition.enemy.history = ['dodge','dodge'];
  assert.equal(E.intent(s.expedition.enemy).id,'feint');
  const n = E.act(s,'dodge');
  assert.equal(n.expedition.hp,26);
  assert.equal(n.expedition.focus,0);
  assert.equal(n.expedition.stagger,false);
  assert.ok(n.expedition.log.some(line => line.includes('フェイント')));
  assert.ok(n.expedition.log.every(line => !line.includes('体勢が崩れた')));
});

test('adaptive preview, counters and fatal damage all resolve the telegraphed move once', () => {
  const s = fight('knight',0);
  s.expedition.enemy.history = ['guard','guard'];
  assert.equal(E.intent(s.expedition.enemy).id,'break');
  const damage = E.attackPreview(s,'strike');
  assert.equal(damage,E.weaponAttack(s),'the replaced guard must not reduce damage');
  const n = E.act(s,'strike');
  assert.equal(s.expedition.enemy.hp-n.expedition.enemy.hp,damage);
  assert.equal(n.expedition.hp,s.expedition.hp-7);

  s.expedition.hp = 4;
  s.expedition.scrap = 9;
  const dead = E.act(s,'strike');
  assert.equal(dead.expedition,null);
  assert.equal(dead.report.died,true);
  assert.equal(dead.report.hp,-3);
  assert.equal(dead.report.defeatedBy,'knight');
  assert.equal(dead.scrap,0);
  assert.deepEqual(E.parse(E.serialize(dead)),dead);

  const shield = fight('knight',0,'shield');
  shield.expedition.enemy.history = ['guard','guard'];
  const guarded = E.act(shield,'guard');
  assert.equal(guarded.expedition.hp,28,'break uses half the shield block, at least two damage');
  assert.equal(shield.expedition.enemy.hp-guarded.expedition.enemy.hp,E.combatProfile(shield).counter);
});

test('an adaptive move cannot undo a heal or turn a lethal hit into retaliation', () => {
  const s = fight();
  s.expedition.enemy.history = ['dodge','dodge'];
  s.expedition.hp = 10;
  const healed = E.act(s,'heal');
  assert.equal(healed.expedition.hp,18,'heal twelve, then take the four-point feint');
  assert.equal(healed.expedition.potions,1);
  s.expedition.enemy.hp = E.attackPreview(s,'strike');
  const won = E.act(s,'strike');
  assert.equal(won.expedition.stage,'path');
  assert.equal(won.expedition.hp,10,'a defeated enemy cannot retaliate');
  assert.equal(won.expedition.stagger,false);
});

test('a finishing blow consumes the break and the next encounter starts clean', () => {
  let s = E.act(fight(),'dodge');
  s.expedition.enemy.hp = E.attackPreview(s,'strike');
  s = E.act(s,'strike');
  assert.equal(s.expedition.stage,'path');
  assert.equal(s.expedition.stagger,false);
  assert.equal(s.expedition.focus,0);
  s.runs++;
  s = E.act(E.act(s,'rest'),'careful');
  assert.equal(s.expedition.stagger,false);
  assert.equal(s.expedition.focus,0);
  assert.equal(s.expedition.enemy.history,undefined);
});
