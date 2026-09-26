const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/slice-engine.js');

const fresh = () => ({ ...E.initial(), mode: 'demo' });

test('defeat records the killer and same-place revenge grants one +3 strike', () => {
  let s = E.start(fresh(), 'wood');
  s = E.act(s, 'careful');
  assert.equal(s.expedition.enemy.kind, 'wolf');

  s.expedition.hp = 1;
  s = E.act(s, 'strike');
  assert.equal(s.expedition, null);
  assert.equal(s.report.died, true);
  assert.equal(s.report.defeatedBy, 'wolf');
  assert.deepEqual(s.grudge, { place: 'wood', enemy: 'wolf' });

  const resumed = E.parse(E.serialize(s));
  assert.ok(resumed);
  s = E.start(resumed, 'wood');
  assert.deepEqual(s.expedition.grudge, { place: 'wood', enemy: 'wolf', used: false });
  s = E.act(s, 'careful');

  const base = E.weaponAttack(s, s.equipped);
  assert.equal(E.attackPreview(s, 'strike'), base + 3);
  const before = s.expedition.enemy.hp;
  s = E.act(s, 'strike');
  assert.equal(before - s.expedition.enemy.hp, base + 3);
  assert.equal(s.grudge, null);
  assert.equal(s.expedition.grudge.used, true);
  assert.match(s.expedition.log.join(' '), /敗走の執念/);
  assert.equal(E.attackPreview(s, 'strike'), base);
});

test('revenge and hearth sharpening can stack without corrupting persisted state', () => {
  let s = {
    ...fresh(),
    maintenance: 'sharp',
    grudge: { place: 'wood', enemy: 'wolf' },
  };
  s = E.start(s, 'wood');
  assert.equal(s.maintenance, null);
  assert.equal(s.expedition.sharpened, 3);
  assert.deepEqual(s.expedition.grudge, { place: 'wood', enemy: 'wolf', used: false });

  s = E.act(s, 'careful');
  const base = E.weaponAttack(s, s.equipped);
  assert.equal(E.attackPreview(s, 'strike'), base + 6);
  s = E.act(s, 'strike');

  assert.equal(s.expedition.sharpened, 2);
  assert.equal(s.expedition.sharpenedApplied, true);
  assert.equal(s.expedition.grudge.used, true);
  assert.equal(s.grudge, null);
  assert.ok(E.parse(E.serialize(s)));
});

test('legacy saves without revenge fields migrate safely', () => {
  const legacy = fresh();
  delete legacy.grudge;
  let parsed = E.parse(JSON.stringify(legacy));
  assert.ok(parsed);
  assert.equal(parsed.grudge, null);

  let running = E.start(fresh(), 'wood');
  delete running.grudge;
  delete running.expedition.grudge;
  parsed = E.parse(JSON.stringify(running));
  assert.ok(parsed);
  assert.equal(parsed.grudge, null);
  assert.equal(parsed.expedition.grudge, null);

  let defeated = E.start(fresh(), 'wood');
  defeated = E.act(defeated, 'careful');
  defeated.expedition.hp = 1;
  defeated = E.act(defeated, 'strike');
  delete defeated.grudge;
  delete defeated.report.defeatedBy;
  parsed = E.parse(JSON.stringify(defeated));
  assert.ok(parsed);
  assert.equal(parsed.grudge, null);
  assert.equal(parsed.report.defeatedBy, null);
});
