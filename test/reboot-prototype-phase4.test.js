const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = require('../src/reboot-prototype-state.js');
const p2 = require('../src/reboot-phase2-state.js');
const p3 = require('../src/reboot-phase3-state.js');
const p4 = require('../src/reboot-phase4-state.js');

function reachHill(bellChoice, crossingChoice, hillChoice) {
  let state = base.discoverBellTower(base.createInitialState());
  state = base.applyBellChoice(state, bellChoice);
  state = p2.discoverOldCrossing(state);
  state = p2.applyCrossingChoice(state, crossingChoice);
  state = p3.discoverBlackRavenHill(state);
  return p3.applyHillChoice(state, hillChoice);
}

test('Phase 3 fork remains untouched until a first destination is chosen', () => {
  const state = p4.normalizeState(reachHill(
    base.CHOICES.RING_BELL,
    p2.CHOICES.KEEP_CROSSING,
    p3.CHOICES.SIGNAL_CHAPEL
  ));
  assert.equal(state.choices[p4.FORK_FIRST_VISIT], null);
  assert.equal(state.placeStates[p4.SALT_CHAPEL], 'hinted_warned');
  assert.equal(state.placeStates[p4.RUINED_GATE], 'hinted_exposed');
});

test('walking to the warned chapel discovers it while the exposed gate changes off-screen', () => {
  const before = reachHill(base.CHOICES.RING_BELL, p2.CHOICES.KEEP_CROSSING, p3.CHOICES.SIGNAL_CHAPEL);
  const state = p4.discoverForkPlace(before, p4.SALT_CHAPEL);
  assert.equal(state.choices[p4.FORK_FIRST_VISIT], p4.SALT_CHAPEL);
  assert.equal(state.placeStates[p4.SALT_CHAPEL], 'discovered_warned');
  assert.equal(state.placeStates[p4.RUINED_GATE], 'passed_without_you');
  assert.ok(state.discoveredPlaces.includes(p4.SALT_CHAPEL));
  assert.ok(!state.discoveredPlaces.includes(p4.RUINED_GATE));
});

test('walking to the exposed gate leaves the warned chapel to seal itself', () => {
  const before = reachHill(base.CHOICES.RING_BELL, p2.CHOICES.KEEP_CROSSING, p3.CHOICES.SIGNAL_CHAPEL);
  const state = p4.discoverForkPlace(before, p4.RUINED_GATE);
  assert.equal(state.placeStates[p4.RUINED_GATE], 'discovered_exposed');
  assert.equal(state.placeStates[p4.SALT_CHAPEL], 'sealed_without_you');
});

test('road warning inverts both future consequences', () => {
  const before = reachHill(base.CHOICES.BREAK_BELL, p2.CHOICES.CUT_CROSSING, p3.CHOICES.SIGNAL_GATE);

  const chapelFirst = p4.discoverForkPlace(before, p4.SALT_CHAPEL);
  assert.equal(chapelFirst.placeStates[p4.SALT_CHAPEL], 'discovered_exposed');
  assert.equal(chapelFirst.placeStates[p4.RUINED_GATE], 'barricaded_without_you');

  const gateFirst = p4.discoverForkPlace(before, p4.RUINED_GATE);
  assert.equal(gateFirst.placeStates[p4.RUINED_GATE], 'discovered_warned');
  assert.equal(gateFirst.placeStates[p4.SALT_CHAPEL], 'crowded_without_you');
});

test('first destination is irreversible', () => {
  const before = reachHill(base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING, p3.CHOICES.SIGNAL_CHAPEL);
  const chapelFirst = p4.discoverForkPlace(before, p4.SALT_CHAPEL);
  assert.throws(() => p4.discoverForkPlace(chapelFirst, p4.RUINED_GATE), /irreversible/);
  assert.deepEqual(p4.discoverForkPlace(chapelFirst, p4.SALT_CHAPEL), p4.normalizeState(chapelFirst));
});

test('arrival copy keeps the earlier history actor and names the unseen world change', () => {
  const before = reachHill(base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING, p3.CHOICES.SIGNAL_CHAPEL);
  const state = p4.discoverForkPlace(before, p4.RUINED_GATE);
  const presentation = p4.getFirstVisitPresentation(state);
  assert.equal(presentation.visited.title, '朽ちた関門');
  assert.match(presentation.visited.text, /黒旗の一団と王兵/);
  assert.equal(presentation.unvisited.title, '塩の礼拝堂');
  assert.match(presentation.unvisited.text, /自分たちで扉を封じた/);
});

test('first visit and both resulting place states survive reload without raw location data', () => {
  const before = reachHill(base.CHOICES.BREAK_BELL, p2.CHOICES.KEEP_CROSSING, p3.CHOICES.SIGNAL_GATE);
  const state = p4.discoverForkPlace(before, p4.SALT_CHAPEL);
  const serialized = p4.serializeState({
    ...state,
    latitude: 35.7,
    longitude: 139.8,
    coords: { latitude: 35.7 },
    routeHistory: [{ latitude: 35.7 }]
  });
  const reloaded = p4.parseState(serialized);
  assert.equal(reloaded.choices[p4.FORK_FIRST_VISIT], p4.SALT_CHAPEL);
  assert.equal(reloaded.placeStates[p4.SALT_CHAPEL], 'discovered_exposed');
  assert.equal(reloaded.placeStates[p4.RUINED_GATE], 'barricaded_without_you');
  assert.doesNotMatch(serialized, /latitude|longitude|routeHistory|coords|track/i);
});

test('Phase 4 UI uses destination buttons rather than another fate-choice dialog', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase4-controller.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase4.css'), 'utf8');

  assert.match(html, /id="phase4-actions"/);
  assert.match(html, /data-place="salt_chapel"/);
  assert.match(html, /data-place="ruined_gate"/);
  assert.match(html, /DEV: 塩の礼拝堂へ向かう/);
  assert.match(html, /DEV: 朽ちた関門へ向かう/);
  assert.match(html, /reboot-phase4-state\.js/);
  assert.match(html, /reboot-phase4-controller\.js/);
  assert.match(controller, /discoverForkPlace\(state, button\.dataset\.place\)/);
  assert.match(css, /data-first-visit/);
  assert.doesNotMatch(html + controller, /expedition-system|territory-phase1|world-atlas\.js|save-system\.js/);
});
