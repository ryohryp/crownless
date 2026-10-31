'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/gemini-action-save.js');
const R = require('../src/gemini-rpg-loop.js');

test('action-lab progress has its own per-mode save key, never production key', () => {
  assert.equal(P.key('demo'), 'crownless-action-forest-v1-demo');
  assert.equal(P.key('walk'), 'crownless-action-forest-v1-walk');
  assert.equal(P.key('bogus'), null);
  assert.notEqual(P.key('demo'), P.key('walk'));
  assert.doesNotMatch(P.key('demo'), /crownless-expedition-v1/);
});

test('only genuinely returned materials and smith equipment survive a reload', () => {
  const expedition = R.create();
  R.claimMaterial(expedition);
  R.claimMaterial(expedition);
  R.claimMaterial(expedition);
  assert.deepEqual(JSON.parse(P.encode(expedition)), { version: 1, banked: 0, crafted: false, tempered: false },
    'unreturned battle loot must never be written');
  R.clearWave(expedition);
  R.returnAlive(expedition, 10);
  const savedAfterReturn = P.encode(expedition);
  const resumed = R.create();
  assert.equal(P.restore(resumed, P.decode(savedAfterReturn)), true);
  assert.equal(resumed.banked, 3);
  assert.equal(resumed.crafted, false);
  assert.equal(resumed.phase, 'fight');
  assert.equal(resumed.unbanked, 0);
  R.loseExpedition(resumed);
  assert.equal(resumed.banked, 3, 'a later defeat cannot erase a previous safe return');
  R.forge(expedition);
  assert.equal(expedition.crafted, true);
  const savedAfterForge = P.encode(expedition);
  const future = R.create();
  P.restore(future, P.decode(savedAfterForge));
  assert.equal(future.crafted, true);
  assert.equal(future.banked, 0);
  assert.equal(future.unbanked, 0);
});

test('new storage is empty but corrupted/versioned data is rejected rather than rewritten', () => {
  assert.deepEqual(P.decode(null), { version: 1, banked: 0, crafted: false, tempered: false });
  for (const raw of [
    '', '{}', 'invalid JSON', '[]', '{"version":2,"banked":3,"crafted":true}',
    '{"version":1,"banked":-1,"crafted":true}',
    '{"version":1,"banked":1.2,"crafted":true}',
    '{"version":1,"banked":1000001,"crafted":true}',
    '{"version":1,"banked":1,"crafted":"yes"}',
    '{"version":1,"banked":0,"crafted":false,"tempered":true}',
    '{"version":1,"banked":0,"crafted":true,"tempered":"yes"}',
    '"hello"', '0', 'null', 'a'.repeat(2001),
  ]) assert.equal(P.decode(raw), null, 'unsafe save: ' + raw.slice(0, 50));
  assert.throws(() => P.encode({ banked: NaN, crafted: false }), /invalid/);
  assert.throws(() => P.encode({ banked: 5, crafted: null }), /invalid/);
});

test('saves are content-minimal and never disclose coordinates, routes or user location', () => {
  const encoded = P.encode({ banked: 7, crafted: true, unbanked: 100,
    phase: 'return', latitude: 35.7, longitude: 139.8, path: '/secret' });
  assert.equal(encoded, '{"version":1,"banked":7,"crafted":true,"tempered":false}');
  assert.equal(Object.keys(JSON.parse(encoded)).length, 4);
});


test('tempered sword persists after safe return, while current v1 saves still load', () => {
  const old = P.decode('{"version":1,"banked":5,"crafted":true}');
  assert.equal(old.tempered, false);
  const s = R.create();
  assert.equal(P.restore(s, old), true);
  assert.equal(R.temper(s), false, 'restoring enters combat, not the camp');
  R.clearWave(s);
  R.returnAlive(s, 70);
  assert.equal(R.temper(s), true);
  const saved = P.encode(s);
  const fresh = R.create();
  assert.equal(P.restore(fresh, P.decode(saved)), true);
  assert.equal(fresh.tempered, true);
  assert.equal(fresh.banked, 0);
  assert.equal(fresh.unbanked, 0);
  assert.equal(fresh.phase, 'fight');
});
