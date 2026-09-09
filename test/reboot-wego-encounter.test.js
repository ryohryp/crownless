const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wego = require('../src/reboot-wego-encounter.js');
const battlefield = require('../src/reboot-wego-battlefield.js');

const richClues = ['木と石の乾いた音', '乱れた轍と積み石', '人が集まる崩れ関門'];

function play(state, actions) {
  return actions.reduce((current, action) => wego.resolveRound(current, action), state);
}

test('enemy intent is deterministic but exploration knowledge changes its precision', () => {
  const blind = wego.createEncounter({ clues: [], gear: 'round_shield' });
  const informed = wego.createEncounter({ clues: richClues, gear: 'round_shield' });

  assert.equal(wego.enemyPlan(blind).id, 'probe_shot');
  assert.equal(wego.enemyPlan(informed).id, 'probe_shot');
  assert.notEqual(wego.intentPresentation(blind), wego.intentPresentation(informed));
  assert.match(wego.intentPresentation(blind), /人影|片方/);
  assert.match(wego.intentPresentation(informed), /前衛/);
  assert.match(wego.intentPresentation(informed), /弓兵/);
});

test('guard reveals the next enemy intent even without exploration knowledge', () => {
  let state = wego.createEncounter({ clues: [], gear: 'round_shield' });
  state = wego.resolveRound(state, wego.ACTIONS.GUARD);

  assert.equal(state.round, 2);
  assert.equal(state.readIntent, true);
  assert.match(wego.intentPresentation(state), /前衛/);
});

test('equipment changes the nature of press guard and maneuver', () => {
  const spear = wego.resolveRound(wego.createEncounter({ clues: [], gear: 'long_spear' }), 'press');
  const shield = wego.resolveRound(wego.createEncounter({ clues: [], gear: 'round_shield' }), 'guard');
  const light = wego.resolveRound(wego.createEncounter({ clues: [], gear: 'light_kit' }), 'maneuver');

  assert.equal(spear.advantage, 2, 'long spear should strengthen press against an advancing frontliner');
  assert.equal(shield.advantage, 1, 'round shield should turn guarding a shot into initiative');
  assert.equal(shield.pressure, 0);
  assert.equal(light.advantage, 2, 'light kit should strengthen maneuver');
  assert.equal(light.pressure, 0);
});

test('exploration knowledge can be converted into a first-round terrain advantage', () => {
  const blind = wego.resolveRound(wego.createEncounter({ clues: [], gear: 'round_shield' }), 'maneuver');
  const informed = wego.resolveRound(wego.createEncounter({ clues: richClues, gear: 'round_shield' }), 'maneuver');

  assert.ok(informed.advantage > blind.advantage);
  assert.match(informed.lastResolution, /探索|崩れ石/);
});

test('adapting after a press can clear the two-enemy encounter before the third round', () => {
  const initial = wego.createEncounter({ clues: [], gear: 'long_spear' });
  const resolved = play(initial, ['press', 'maneuver']);

  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.result, 'cleared');
});

test('repeating press into the enemy response is punished and ends by round three', () => {
  const initial = wego.createEncounter({ clues: [], gear: 'long_spear' });
  const resolved = play(initial, ['press', 'press', 'press']);

  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.result, 'forced_retreat');
  assert.ok(resolved.injury);
});

test('retreat is always a legitimate terminal action and still carries enemy information', () => {
  let state = wego.createEncounter({ clues: richClues, gear: 'light_kit' });
  state = wego.resolveRound(state, 'maneuver');
  const resolved = wego.resolveRound(state, 'retreat');
  const record = wego.persistentRecord(resolved);

  assert.equal(resolved.result, 'retreated');
  assert.equal(record.placeState, 'bandits_alerted');
  assert.ok(record.intel.includes('弓兵は崩れ石から射線を作る'));
});

test('persistent result contains semantic aftermath but no transient combat inputs', () => {
  const resolved = play(wego.createEncounter({ clues: richClues, gear: 'long_spear' }), ['press', 'maneuver']);
  const serialized = wego.serializePersistentRecord(resolved);
  const record = JSON.parse(serialized);

  assert.deepEqual(Object.keys(record).sort(), ['encounterId', 'injury', 'intel', 'placeState', 'result', 'version'].sort());
  assert.equal('round' in record, false);
  assert.equal('advantage' in record, false);
  assert.equal('pressure' in record, false);
  assert.equal('lastAction' in record, false);
  assert.equal('intent' in record, false);
  assert.equal('gear' in record, false);
  assert.equal(/latitude|longitude|route|gps/i.test(serialized), false);
});

test('cleared retreat and forced retreat produce different land presentations', () => {
  const cleared = wego.presentationForPersistent({ encounterId: wego.ENCOUNTER_ID, result: 'cleared', injury: null, placeState: 'road_cleared', intel: [] });
  const retreated = wego.presentationForPersistent({ encounterId: wego.ENCOUNTER_ID, result: 'retreated', injury: null, placeState: 'bandits_alerted', intel: [] });
  const forced = wego.presentationForPersistent({ encounterId: wego.ENCOUNTER_ID, result: 'forced_retreat', injury: 'bruised_ribs', placeState: 'bandits_hold_road', intel: [] });

  assert.notEqual(cleared.mark, retreated.mark);
  assert.notEqual(retreated.mark, forced.mark);
  assert.notEqual(cleared.text, forced.text);
});

test('battlefield turns exploration knowledge into visual intent certainty', () => {
  const blind = wego.createEncounter({ clues: [], gear: 'round_shield' });
  const informed = wego.createEncounter({ clues: richClues, gear: 'round_shield' });
  const blindScene = battlefield.sceneFor(blind, wego.enemyPlan(blind));
  const informedScene = battlefield.sceneFor(informed, wego.enemyPlan(informed));

  assert.equal(blindScene.certainty, battlefield.CERTAINTY.VAGUE);
  assert.equal(informedScene.certainty, battlefield.CERTAINTY.CLEAR);
  assert.equal(blindScene.planId, informedScene.planId);
  assert.deepEqual(blindScene.frontliner, informedScene.frontliner);
  assert.deepEqual(blindScene.archer, informedScene.archer);
});

test('battlefield shows guard reading the next plan and pressure closing the retreat lane', () => {
  let state = wego.createEncounter({ clues: [], gear: 'round_shield' });
  state = wego.resolveRound(state, 'guard');
  const guardScene = battlefield.sceneFor(state, wego.enemyPlan(state));

  assert.equal(guardScene.certainty, battlefield.CERTAINTY.CLEAR);
  assert.equal(guardScene.gear, 'shield');
  assert.equal(guardScene.retreatTone, 'open');

  let pressured = wego.createEncounter({ clues: [], gear: 'long_spear' });
  pressured = wego.resolveRound(pressured, 'press');
  pressured = wego.resolveRound(pressured, 'press');
  const pressureScene = battlefield.sceneFor(pressured, wego.enemyPlan(pressured));
  assert.equal(pressureScene.retreatTone, 'danger');
});

test('battlefield makes gear and previous action visible without changing combat state', () => {
  const spear = battlefield.sceneFor(wego.createEncounter({ clues: richClues, gear: 'long_spear' }), wego.PLANS.probe_shot);
  const shield = battlefield.sceneFor(wego.createEncounter({ clues: richClues, gear: 'round_shield' }), wego.PLANS.probe_shot);
  let lightState = wego.createEncounter({ clues: richClues, gear: 'light_kit' });
  lightState = wego.resolveRound(lightState, 'maneuver');
  const light = battlefield.sceneFor(lightState, wego.enemyPlan(lightState));

  assert.equal(spear.gear, 'reach');
  assert.equal(shield.gear, 'shield');
  assert.equal(light.gear, 'mobility');
  assert.ok(light.player.y < spear.player.y, 'maneuver should visibly move the player toward the rubble side');
});

test('resolved encounters have distinct terminal battlefield compositions and no next-intent lines', () => {
  const clearedState = play(wego.createEncounter({ clues: [], gear: 'long_spear' }), ['press', 'maneuver']);
  const forcedState = play(wego.createEncounter({ clues: [], gear: 'long_spear' }), ['press', 'press', 'press']);
  const cleared = battlefield.sceneFor(clearedState, null);
  const forced = battlefield.sceneFor(forcedState, null);

  assert.equal(cleared.outcome, 'cleared');
  assert.equal(forced.outcome, 'forced_retreat');
  assert.equal(cleared.frontIntent, null);
  assert.equal(forced.shotIntent, null);
  assert.ok(cleared.frontliner.x > forced.frontliner.x, 'cleared enemies should be visibly driven farther off the road');
  assert.equal(forced.retreatTone, 'danger');
});

test('Reboot runtime wires a battlefield-first stopped WEGO layer without restoring realtime combat', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'reboot.html'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'src', 'reboot-wego-controller.js'), 'utf8');
  const board = fs.readFileSync(path.join(root, 'src', 'reboot-wego-battlefield.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'reboot-wego.css'), 'utf8');

  assert.match(html, /reboot-wego\.css/);
  assert.match(html, /src\/reboot-wego-encounter\.js/);
  assert.match(html, /src\/reboot-wego-controller\.js/);
  assert.match(controller, /src\/reboot-wego-battlefield\.js/);
  assert.match(controller, /id=\"wego-battlefield\"/);
  assert.match(controller, /id=\"wego-intent-front\"/);
  assert.match(controller, /id=\"wego-intent-shot\"/);
  assert.match(controller, /data-wego-action=\"press\"/);
  assert.match(controller, /data-wego-action=\"guard\"/);
  assert.match(controller, /data-wego-action=\"maneuver\"/);
  assert.match(controller, /data-wego-action=\"retreat\"/);
  assert.match(controller, /安全に立ち止まってから/);
  assert.match(board, /certaintyFor/);
  assert.match(board, /retreatTone/);
  assert.match(css, /\.wego-board/);
  assert.match(css, /\.wego-intent-path/);
  assert.match(css, /data-gear='reach'/);
  assert.match(css, /data-gear='shield'/);
  assert.match(css, /data-gear='mobility'/);
  assert.match(css, /transition: left 220ms ease, top 220ms ease/);
  assert.doesNotMatch(controller, /watchPosition|requestAnimationFrame|keydown|pointermove/i);
  assert.doesNotMatch(controller, /attack|dodge|enemyHp|timing|QTE/i);
  // Short presentation-only timeouts may stage/settle a resolved click, but no repeating or frame-driven combat loop is allowed.
  assert.doesNotMatch(board, /setInterval|requestAnimationFrame/i);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
