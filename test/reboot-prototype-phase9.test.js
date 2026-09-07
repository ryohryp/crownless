const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const phase9 = require('../src/reboot-phase9-combat.js');

test('Phase 9 attaches authored combat to two existing field-thread encounter sectors only', () => {
  assert.equal(phase9.encounterForThread('north', 'trace'), null);
  assert.equal(phase9.encounterForThread('north', 'encounter').id, 'high_watch_scouts');
  assert.equal(phase9.encounterForThread('north_west', 'encounter').id, 'abandoned_camp_returners');
  assert.equal(phase9.encounterForThread('east', 'encounter'), null);
});

test('combat supports idle -> engaged -> won with movement, normal attack and special action', () => {
  let combat = phase9.createCombat('high_watch_scouts');
  assert.equal(combat.mode, phase9.COMBAT_STATES.IDLE);
  assert.equal(combat.enemies.length, 2);

  combat = phase9.applyCombatAction(combat, 'engage', 0);
  assert.equal(combat.mode, phase9.COMBAT_STATES.ENGAGED);

  let now = 100;
  for (let step = 0; step < 6; step += 1) {
    combat = phase9.applyCombatAction(combat, 'move_right', now);
    now += 100;
  }
  combat = phase9.applyCombatAction(combat, 'attack', now += 500);
  combat = phase9.applyCombatAction(combat, 'attack', now += 500);
  assert.equal(combat.enemies[0].hp, 0);

  for (let step = 0; step < 4; step += 1) {
    combat = phase9.applyCombatAction(combat, 'move_right', now += 100);
  }
  combat = phase9.applyCombatAction(combat, 'special', now += 4000);
  combat = phase9.applyCombatAction(combat, 'attack', now += 500);
  assert.equal(combat.mode, phase9.COMBAT_STATES.WON);
});

test('flee is a first-class resolution and can be chosen before fighting', () => {
  let combat = phase9.createCombat('abandoned_camp_returners');
  combat = phase9.applyCombatAction(combat, 'flee', 0);
  assert.equal(combat.mode, phase9.COMBAT_STATES.ESCAPED);
  assert.equal(combat.reason, 'chosen_retreat');
});

test('dodge creates a transient invulnerability window and enemy pressure can force a retreat', () => {
  let combat = phase9.createCombat('high_watch_scouts');
  combat = phase9.applyCombatAction(combat, 'engage', 0);
  combat.player.position = 55;
  combat = phase9.applyCombatAction(combat, 'dodge', 1000);
  assert.ok(combat.player.invulnerableUntil > 1000);

  combat.player.position = combat.enemies[0].position;
  const before = combat.player.hp;
  combat = phase9.tickCombat(combat, 1200);
  assert.equal(combat.player.hp, before);

  combat.player.invulnerableUntil = 0;
  combat.player.hp = 1;
  combat.enemies[0].nextAttackAt = 0;
  combat.player.position = combat.enemies[0].position;
  combat = phase9.tickCombat(combat, 3000);
  assert.equal(combat.mode, phase9.COMBAT_STATES.ESCAPED);
  assert.equal(combat.reason, 'forced_retreat');
});

test('persistent Phase 9 world state stores semantic encounter outcome only', () => {
  let world = phase9.normalizeWorldState({});
  world = phase9.resolveWorldState(world, 'high_watch_scouts', phase9.OUTCOMES.DEFEATED);
  const serialized = phase9.serializeWorldState(world);

  assert.deepEqual(JSON.parse(serialized), {
    version: 1,
    encounters: { high_watch_scouts: 'defeated' }
  });
  assert.doesNotMatch(serialized, /hp|position|input|key|route|latitude|longitude/i);
  assert.equal(phase9.parseWorldState(serialized).encounters.high_watch_scouts, 'defeated');
  assert.throws(
    () => phase9.resolveWorldState(world, 'high_watch_scouts', phase9.OUTCOMES.ESCAPED),
    /irreversible/
  );
});

test('defeated and escaped produce visibly different world-thread consequences', () => {
  const defeated = phase9.outcomePresentation('high_watch_scouts', phase9.OUTCOMES.DEFEATED);
  const escaped = phase9.outcomePresentation('high_watch_scouts', phase9.OUTCOMES.ESCAPED);
  assert.notEqual(defeated.title, escaped.title);
  assert.notEqual(defeated.text, escaped.text);
  assert.match(defeated.text, /地図|方角/);
  assert.match(escaped.text, /地図|土地/);
});

test('browser controller exposes keyboard and touch controls while keeping combat HP transient', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase9-combat.js'), 'utf8');
  const devTools = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-dev-tools.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase9.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');

  assert.match(source, /data-combat-action="attack"/);
  assert.match(source, /data-combat-action="dodge"/);
  assert.match(source, /data-combat-action="special"/);
  assert.match(source, /arrowleft: 'move_left'/);
  assert.match(source, /escape: 'flee'/);
  assert.match(source, /player-unarmed\.png/);
  assert.match(source, /enemy-rusher\.png/);
  assert.match(source, /enemy-guard\.png/);
  assert.match(html, /reboot-phase9\.css/);
  assert.match(html, /src\/reboot-phase9-combat\.js/);
  assert.match(devTools, /const phase9 = window\.CrownlessRebootPhase9Combat/);
  assert.match(devTools, /removeItem\(phase9\.STORAGE_KEY\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
