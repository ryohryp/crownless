const fs = require('node:fs');
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

test('next objective prefers the nearest unclaimed district', () => {
  const s = T.claim(T.fresh(), '0,0', '中央の砦');
  const districts = [
    { id:'0,0', x:0, y:0, claimed:true },
    { id:'2,0', x:2, y:0, claimed:false },
    { id:'0,1', x:0, y:1, claimed:false },
    { id:'1,0', x:1, y:0, claimed:true },
  ];

  assert.equal(T.nextObjective(s, districts)?.id, '0,1');
  assert.equal(T.nextObjective(s, districts.map(d => ({ ...d, claimed:true }))), null);
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


test('stronghold scripts wrap the current slice app in load order', () => {
  const html = fs.readFileSync('expedition.html', 'utf8');
  const state = html.indexOf('src/social-stronghold.js');
  const app = html.indexOf('src/slice-app.js');
  const ui = html.indexOf('src/social-stronghold-ui.js');
  assert.ok(state >= 0 && app > state && ui > app);
});
