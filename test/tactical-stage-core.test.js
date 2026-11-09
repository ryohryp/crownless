const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../src/tactical-stage-core.js');

function atGate() {
  let s = game.initial();
  for (let i = 1; i < game.ROUTE.length; i++) s = game.act(s, 'advance');
  return s;
}

test('earned reveal happens only near keep, and route cannot be skipped', () => {
  let s = game.initial();
  assert.equal(s.discovered, false);
  assert.equal(game.act(s, 'enter').phase, 'explore');
  for (let i = 1; i <= 3; i++) {
    s = game.act(s, 'advance');
    assert.equal(s.discovered, false);
    assert.equal(game.valid(s), true);
  }
  s = game.act(s, 'advance');
  assert.equal(s.discovered, true);
  assert.equal(s.phase, 'explore');
  s = game.act(s, 'advance');
  assert.equal(s.phase, 'gate');
  assert.equal(s.step, 5);
  assert.equal(game.act(s, 'advance').step, 5);
});

test('blocking a heavy windup creates a useful counterattack', () => {
  let s = game.act(atGate(), 'enter');
  s = game.act(s, 'guard');
  assert.equal(s.hp, 95);
  assert.equal(s.opening, true);
  s = game.act(s, 'strike');
  assert.equal(s.hp, 83);
  assert.equal(s.guardianHp, game.ENEMY_HP - 38);
  s = game.act(s, 'strike');
  assert.equal(s.guardianHp, 18);
  s = game.act(s, 'strike');
  assert.equal(s.phase, 'vault');
  assert.equal(s.hp, 56);
});

test('material only becomes banked after collect and living return', () => {
  let s = game.act(atGate(), 'enter');
  while (s.phase === 'combat') s = game.act(s, 'strike');
  assert.equal(s.phase, 'vault');
  assert.equal(s.banked, 0);
  s = game.act(s, 'collect');
  assert.equal(s.carried, 1);
  s = game.act(s, 'collect');
  assert.equal(s.carried, 1);
  s = game.act(s, 'return');
  assert.equal(s.result, 'cleared');
  assert.equal(s.carried, 0);
  assert.equal(s.banked, 1);
  assert.equal(game.valid(s), true);
});

test('early retreat earns no loot, restart returns a clean run', () => {
  let s = game.act(game.act(game.initial(), 'advance'), 'retreat');
  assert.equal(s.phase, 'returned');
  assert.equal(s.banked, 0);
  assert.equal(game.act(s, 'advance').step, 1);
  s = game.act(s, 'restart');
  assert.deepEqual(s, game.initial());
});

test('defeat does not bank loot and rejects actions after ending', () => {
  let s = game.act(atGate(), 'enter');
  s.hp = 4;
  s = game.act(s, 'strike');
  assert.equal(s.phase, 'fallen');
  assert.equal(s.carried, 0);
  assert.equal(s.banked, 0);
  assert.equal(game.act(s, 'collect').phase, 'fallen');
});
