const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const wego = require('../src/reboot-wego-encounter.js');

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

test('Reboot runtime wires the stopped WEGO layer without restoring realtime combat', () => {
  const root = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'reboot.html'), 'utf8');
  const controller = fs.readFileSync(path.join(root, 'src', 'reboot-wego-controller.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'reboot-wego.css'), 'utf8');

  assert.match(html, /reboot-wego\.css/);
  assert.match(html, /src\/reboot-wego-encounter\.js/);
  assert.match(html, /src\/reboot-wego-controller\.js/);
  assert.match(controller, /data-wego-action=\"press\"/);
  assert.match(controller, /data-wego-action=\"guard\"/);
  assert.match(controller, /data-wego-action=\"maneuver\"/);
  assert.match(controller, /data-wego-action=\"retreat\"/);
  assert.match(controller, /安全に立ち止まってから/);
  assert.doesNotMatch(controller, /watchPosition|requestAnimationFrame|keydown|pointermove/i);
  assert.doesNotMatch(controller, /attack|dodge|enemyHp|timing|QTE/i);
  assert.match(css, /@media \(max-width: 620px\)/);
});
