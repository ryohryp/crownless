const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/social-stronghold.js');

test('first claimed district becomes the only MVP stronghold', () => {
  let s = T.claim(T.fresh(), '-1,0', '西の木立');
  assert.equal(s.stronghold, '-1,0');
  assert.equal(s.owner, 'player');
  assert.equal(s.rivalArmed, true);

  const moved = T.claim(s, '0,1', '北の見張り跡');
  assert.deepEqual(moved, s);
});

test('simulated rival can take the stronghold once and the player can retake it', () => {
  let s = T.claim(T.fresh(), '-1,0', '西の木立');
  s = T.simulateRival(s, '西の木立');
  assert.equal(s.owner, 'rival');
  assert.equal(s.rivalUsed, true);

  s = T.claim(s, '-1,0', '西の木立');
  assert.equal(s.owner, 'player');
  assert.equal(s.rivalArmed, false);
  assert.equal(s.history.length, 3);
  assert.match(s.history[2].text, /奪い返した/);

  assert.deepEqual(T.simulateRival(s, '西の木立'), s);
});

test('invalid local fixture falls back safely', () => {
  assert.deepEqual(T.parse('{bad'), T.fresh());
  assert.deepEqual(T.parse(JSON.stringify({ ...T.fresh(), owner:'invalid' })), T.fresh());
});
