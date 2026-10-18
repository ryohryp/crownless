'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const impact = require('../src/impact-combat.js');

function tick(s, count = 30) {
  for (let i = 0; i < count; i++) impact.step(s, 0.02, {});
}

test('a strike lands, briefly freezes action, and launches the goblin', () => {
  const s = impact.create();
  s.player.x = 355;
  s.player.z = 270;
  assert.equal(impact.strike(s), true);
  assert.equal(s.enemies[0].hp, 32);
  assert.equal(s.enemies[0].vx, 450);
  assert.ok(s.enemies[0].vy > 0);
  const before = s.player.x;
  impact.step(s, 0.02, { x: 1 });
  assert.equal(s.player.x, before, 'movement freezes during hitstop');
  assert.ok(s.hitstop > 0);
});

test('a launched enemy knocks over another enemy once within the same chain', () => {
  const s = impact.create();
  s.player.x = 355;
  impact.strike(s);
  tick(s, 36);
  assert.ok(s.chains >= 1, 'a knocked-back goblin should collide with its neighbor');
  assert.ok(s.enemies[1].hp < 50, 'collision causes real damage');
  assert.ok(s.events.some(e => e.type === 'chain'));
  assert.ok(s.chains <= 2, 'three goblins cannot bounce infinitely');
});

test('third rapid strike has heavier damage, knockback and a finisher cue', () => {
  const s = impact.create();
  s.player.x = 355;
  s.enemies[0].hp = 400;
  s.enemies[1].x = 800;
  s.enemies[2].x = 850;
  for (let i = 0; i < 3; i++) {
    s.enemies[0].x = 430;
    s.enemies[0].vx = 0;
    s.enemies[0].z = 270;
    assert.equal(impact.strike(s), true);
    if (i < 2) tick(s, 25);
  }
  assert.equal(s.combo, 3);
  assert.equal(s.enemies[0].vx, 660);
  assert.ok(s.events.some(e => e.type === 'finish'));
});

test('defeating all three enemies ends the short encounter', () => {
  const s = impact.create();
  s.player.x = 355;
  s.enemies[0].hp = 10;
  s.enemies[1].dead = true;
  s.enemies[2].dead = true;
  impact.step(s, 0.016, { attack: true });
  assert.equal(s.finished, true);
  assert.ok(s.events.some(e => e.type === 'victory'));
  assert.equal(impact.strike(s), false);
});

test('state is resettable and keeps no GPS, saves or network dependency', () => {
  const s = impact.create();
  assert.equal(s.enemies.length, 3);
  assert.equal(s.player.hp, 100);
  assert.equal(Object.keys(s).some(k => /location|gps|storage|save/i.test(k)), false);
});
