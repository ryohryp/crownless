const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = require('../src/reboot-prototype-state.js');
const p2 = require('../src/reboot-phase2-state.js');
const p3 = require('../src/reboot-phase3-state.js');

function towerChosen(choice) {
  return base.applyBellChoice(base.discoverBellTower(base.createInitialState()), choice);
}

function crossingChosen(bellChoice, crossingChoice) {
  let state = p2.discoverOldCrossing(towerChosen(bellChoice));
  return p2.applyCrossingChoice(state, crossingChoice);
}

function hillDiscovered(bellChoice, crossingChoice) {
  return p3.discoverBlackRavenHill(crossingChosen(bellChoice, crossingChoice));
}

function hillChosen(bellChoice, crossingChoice, hillChoice) {
  return p3.applyHillChoice(hillDiscovered(bellChoice, crossingChoice), hillChoice);
}

test('Phase 2 persisted history extends into Phase 3 without changing storage key', () => {
  const oldState = crossingChosen(base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING);
  const state = p3.parseState(p2.serializeState(oldState));
  assert.equal(p3.STORAGE_KEY, base.STORAGE_KEY);
  assert.equal(state.placeStates[p3.BLACK_RAVEN_HILL], 'hinted');
  assert.equal(state.placeStates[p3.SALT_CHAPEL], 'unknown');
  assert.equal(state.placeStates[p3.RUINED_GATE], 'unknown');
});

test('development shortcut and GPS path share the same Black Raven Hill discovery transition', () => {
  const before = crossingChosen(base.CHOICES.BREAK_BELL, p2.CHOICES.KEEP_CROSSING);
  const dev = p3.simulateBlackRavenHillDiscovery(before);
  const session = p3.createLocationSession();
  let result = p3.observeBlackRavenHillLocation(session, before, { latitude: 35, longitude: 139 });
  assert.equal(result.status, 'anchored');
  result = p3.observeBlackRavenHillLocation(session, result.state, { latitude: 35.00062, longitude: 139 });
  assert.equal(result.status, 'discovered');
  assert.deepEqual(result.state, dev);
});

test('Black Raven Hill arrival has four distinct contexts from the two prior choices', () => {
  const combinations = [
    [base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING],
    [base.CHOICES.RING_BELL, p2.CHOICES.KEEP_CROSSING],
    [base.CHOICES.BREAK_BELL, p2.CHOICES.CUT_CROSSING],
    [base.CHOICES.BREAK_BELL, p2.CHOICES.KEEP_CROSSING]
  ];
  const arrivals = combinations.map(([bell, crossing]) => p3.getHillArrivalPresentation(hillDiscovered(bell, crossing)));
  assert.equal(new Set(arrivals.map((arrival) => arrival.historyKey)).size, 4);
  assert.equal(new Set(arrivals.map((arrival) => arrival.summary)).size, 4);
  assert.ok(arrivals.every((arrival) => arrival.title === '黒鴉の丘'));
});

test('signaling the valley changes the hill and creates two different next-place states', () => {
  const state = hillChosen(base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING, p3.CHOICES.SIGNAL_CHAPEL);
  assert.equal(state.placeStates[p3.BLACK_RAVEN_HILL], 'valley_watch');
  assert.equal(state.placeStates[p3.SALT_CHAPEL], 'hinted_warned');
  assert.equal(state.placeStates[p3.RUINED_GATE], 'hinted_exposed');
  const outcome = p3.getHillOutcomePresentation(state);
  assert.equal(outcome.hillTitle, '谷見の丘');
  assert.equal(outcome.chapel.mark, '警戒');
  assert.equal(outcome.gate.mark, '無警戒');
});

test('signaling the road inverts which next place is warned', () => {
  const state = hillChosen(base.CHOICES.BREAK_BELL, p2.CHOICES.KEEP_CROSSING, p3.CHOICES.SIGNAL_GATE);
  assert.equal(state.placeStates[p3.BLACK_RAVEN_HILL], 'road_watch');
  assert.equal(state.placeStates[p3.SALT_CHAPEL], 'hinted_exposed');
  assert.equal(state.placeStates[p3.RUINED_GATE], 'hinted_warned');
  const outcome = p3.getHillOutcomePresentation(state);
  assert.equal(outcome.hillTitle, '道見の丘');
  assert.equal(outcome.chapel.mark, '無警戒');
  assert.equal(outcome.gate.mark, '警戒');
});

test('the same hill choice still carries prior history into the two future hooks', () => {
  const king = p3.getHillOutcomePresentation(hillChosen(base.CHOICES.RING_BELL, p2.CHOICES.KEEP_CROSSING, p3.CHOICES.SIGNAL_CHAPEL));
  const free = p3.getHillOutcomePresentation(hillChosen(base.CHOICES.BREAK_BELL, p2.CHOICES.CUT_CROSSING, p3.CHOICES.SIGNAL_CHAPEL));
  assert.notEqual(king.historyKey, free.historyKey);
  assert.notEqual(king.chapel.hook, free.chapel.hook);
  assert.notEqual(king.gate.hook, free.gate.hook);
});

test('Black Raven Hill signal choice is irreversible', () => {
  const state = hillChosen(base.CHOICES.RING_BELL, p2.CHOICES.KEEP_CROSSING, p3.CHOICES.SIGNAL_GATE);
  assert.throws(() => p3.applyHillChoice(state, p3.CHOICES.SIGNAL_CHAPEL), /irreversible/);
});

test('three-place history and both future-place states survive reload without location history', () => {
  const state = hillChosen(base.CHOICES.BREAK_BELL, p2.CHOICES.CUT_CROSSING, p3.CHOICES.SIGNAL_CHAPEL);
  const serialized = p3.serializeState({
    ...state,
    latitude: 35.2,
    longitude: 139.2,
    routeHistory: [{ latitude: 35.2, longitude: 139.2 }]
  });
  const reloaded = p3.parseState(serialized);
  assert.equal(reloaded.choices[p3.BLACK_RAVEN_HILL], p3.CHOICES.SIGNAL_CHAPEL);
  assert.equal(reloaded.placeStates[p3.BLACK_RAVEN_HILL], 'valley_watch');
  assert.equal(reloaded.placeStates[p3.SALT_CHAPEL], 'hinted_warned');
  assert.equal(reloaded.placeStates[p3.RUINED_GATE], 'hinted_exposed');
  assert.doesNotMatch(serialized, /latitude|longitude|routeHistory|coords|track/i);
});

test('Phase 3 UI exposes a real two-place fork and stays isolated from current Crownless systems', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase3-controller.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase3.css'), 'utf8');
  assert.match(html, /id="dev-walk-hill"/);
  assert.match(html, /谷へ合図する/);
  assert.match(html, /街道へ合図する/);
  assert.match(html, /塩の礼拝堂/);
  assert.match(html, /朽ちた関門/);
  assert.match(html, /id="fork-summary"/);
  assert.match(controller, /observeBlackRavenHillLocation/);
  assert.match(controller, /simulateBlackRavenHillDiscovery/);
  assert.match(css, /data-chapel-state='hinted_warned'/);
  assert.match(css, /data-gate-state='hinted_warned'/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(html + controller, /expedition-system|territory-phase1|world-atlas\.js|save-system\.js/);
});
