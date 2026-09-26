const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

const fresh = () => ({ ...E.initial(), mode: 'demo' });

function safeAction(s) {
  const x = s.expedition;
  if (x.stage === 'cleared') return 'return';
  if (x.stage === 'path') return [1, 3].includes(x.room) ? 'rest' : 'careful';
  const intent = E.intent(x.enemy);
  const attack = E.attackPreview(s, 'strike');
  if (x.enemy.hp <= attack && intent.id !== 'guard') return 'strike';
  if (['heavy', 'pounce'].includes(intent.id) && x.stamina >= E.combatProfile(s).dodgeCost) return 'dodge';
  if (intent.id === 'quick' || intent.id === 'guard') return 'guard';
  return x.stamina >= E.combatProfile(s).heavyCost ? 'heavy' : 'strike';
}

function completeWood(s) {
  s = E.start(s, 'wood');
  for (let i = 0; i < 150 && s.expedition; i += 1) s = E.act(s, safeAction(s));
  assert.equal(s.expedition, null);
  assert.equal(s.report.died, false);
  return s;
}

test('surviving enables one free hearth sharpening for the next expedition', () => {
  let s = completeWood(fresh());
  assert.equal(s.maintenance, 'ready');

  s = E.maintain(s);
  assert.equal(s.maintenance, 'sharp');

  const resumed = E.parse(E.serialize(s));
  assert.ok(resumed);
  assert.equal(resumed.maintenance, 'sharp');

  s = E.start(resumed, 'wood');
  assert.equal(s.maintenance, null);
  assert.equal(s.expedition.sharpened, 3);
  assert.equal(s.expedition.sharpenedApplied, false);
});

test('sharpening buffs only the first attack of an encounter and then spends one charge', () => {
  let s = { ...fresh(), maintenance: 'sharp' };
  s = E.start(s, 'wood');
  s = E.act(s, 'careful');

  assert.equal(E.intent(s.expedition.enemy).id, 'quick');
  assert.equal(E.attackPreview(s, 'strike'), E.weaponAttack(s, s.equipped) + 3);

  const before = s.expedition.enemy.hp;
  s = E.act(s, 'strike');
  assert.equal(before - s.expedition.enemy.hp, E.weaponAttack(s, s.equipped) + 3);
  assert.equal(s.expedition.sharpened, 2);
  assert.equal(s.expedition.sharpenedApplied, true);

  assert.equal(E.attackPreview(s, 'strike'), E.weaponAttack(s, s.equipped));
});

test('legacy saves without maintenance fields migrate safely', () => {
  const legacy = fresh();
  delete legacy.maintenance;
  const parsed = E.parse(JSON.stringify(legacy));
  assert.ok(parsed);
  assert.equal(parsed.maintenance, null);

  let running = E.start(fresh(), 'wood');
  delete running.maintenance;
  delete running.expedition.sharpened;
  delete running.expedition.sharpenedApplied;
  const resumed = E.parse(JSON.stringify(running));
  assert.ok(resumed);
  assert.equal(resumed.maintenance, null);
  assert.equal(resumed.expedition.sharpened, 0);
  assert.equal(resumed.expedition.sharpenedApplied, false);
});
