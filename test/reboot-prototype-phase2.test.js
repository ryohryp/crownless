const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = require('../src/reboot-prototype-state.js');
const p2 = require('../src/reboot-phase2-state.js');

function towerChosen(choice) {
  return base.applyBellChoice(base.discoverBellTower(base.createInitialState()), choice);
}

function crossingChosen(bellChoice, crossingChoice) {
  let state = p2.discoverOldCrossing(towerChosen(bellChoice));
  return p2.applyCrossingChoice(state, crossingChoice);
}

test('Phase 1 persisted state is extended in place without changing the storage key', () => {
  const oldState = towerChosen(base.CHOICES.RING_BELL);
  const state = p2.parseState(base.serializeState(oldState));
  assert.equal(p2.STORAGE_KEY, base.STORAGE_KEY);
  assert.equal(state.placeStates[base.BELL_TOWER], 'king_beacon');
  assert.equal(state.placeStates[p2.OLD_CROSSING], 'hinted');
  assert.equal(state.placeStates[p2.BLACK_RAVEN_HILL], 'unknown');
});

test('development shortcut and GPS path share the same Old Crossing discovery transition', () => {
  const before = towerChosen(base.CHOICES.RING_BELL);
  const dev = p2.simulateOldCrossingDiscovery(before);
  const session = p2.createLocationSession();
  let result = p2.observeOldCrossingLocation(session, before, { latitude: 35, longitude: 139 });
  assert.equal(result.status, 'anchored');
  result = p2.observeOldCrossingLocation(session, result.state, { latitude: 35.00062, longitude: 139 });
  assert.equal(result.status, 'discovered');
  assert.deepEqual(result.state, dev);
});

test('Old Crossing arrival reflects the Bell Tower history', () => {
  const king = p2.getCrossingArrivalPresentation(p2.discoverOldCrossing(towerChosen(base.CHOICES.RING_BELL)));
  const free = p2.getCrossingArrivalPresentation(p2.discoverOldCrossing(towerChosen(base.CHOICES.BREAK_BELL)));
  assert.match(king.summary, /王兵/);
  assert.match(free.summary, /負傷者/);
  assert.notEqual(king.summary, free.summary);
});

test('Old Crossing choice permanently changes the place and hints Black Raven Hill', () => {
  const cut = crossingChosen(base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING);
  assert.equal(cut.placeStates[p2.OLD_CROSSING], 'ash_crossing');
  assert.equal(cut.placeStates[p2.BLACK_RAVEN_HILL], 'hinted');
  assert.equal(p2.getCrossingOutcomePresentation(cut).crossingTitle, '灰の渡り');

  const keep = crossingChosen(base.CHOICES.BREAK_BELL, p2.CHOICES.KEEP_CROSSING);
  assert.equal(keep.placeStates[p2.OLD_CROSSING], 'lantern_crossing');
  assert.equal(p2.getCrossingOutcomePresentation(keep).crossingTitle, '灯火の渡り');
});

test('two-by-two history creates four distinct Black Raven Hill hooks', () => {
  const combinations = [
    [base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING],
    [base.CHOICES.RING_BELL, p2.CHOICES.KEEP_CROSSING],
    [base.CHOICES.BREAK_BELL, p2.CHOICES.CUT_CROSSING],
    [base.CHOICES.BREAK_BELL, p2.CHOICES.KEEP_CROSSING]
  ];
  const outcomes = combinations.map(([bell, crossing]) => p2.getCrossingOutcomePresentation(crossingChosen(bell, crossing)));
  assert.equal(new Set(outcomes.map((outcome) => outcome.consequence)).size, 4);
  assert.equal(new Set(outcomes.map((outcome) => outcome.hillHook)).size, 4);
  assert.deepEqual(outcomes.map((outcome) => outcome.hillTrace), ['黒い旗', '戻らない荷車', '追手の松明', '先回りした影']);
});

test('Old Crossing choice is irreversible', () => {
  const state = crossingChosen(base.CHOICES.RING_BELL, p2.CHOICES.CUT_CROSSING);
  assert.throws(() => p2.applyCrossingChoice(state, p2.CHOICES.KEEP_CROSSING), /irreversible/);
});

test('two-place history survives reload while raw location data is stripped', () => {
  const state = crossingChosen(base.CHOICES.BREAK_BELL, p2.CHOICES.KEEP_CROSSING);
  const serialized = p2.serializeState({ ...state, latitude: 35.2, longitude: 139.2, routeHistory: [{ latitude: 35.2 }] });
  const reloaded = p2.parseState(serialized);
  assert.equal(reloaded.choices[p2.OLD_CROSSING], p2.CHOICES.KEEP_CROSSING);
  assert.equal(reloaded.placeStates[p2.OLD_CROSSING], 'lantern_crossing');
  assert.equal(reloaded.placeStates[p2.BLACK_RAVEN_HILL], 'hinted');
  assert.doesNotMatch(serialized, /latitude|longitude|routeHistory|coords|track/i);
});

test('Phase 2 UI stays isolated from current Crownless systems', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase2-controller.js'), 'utf8');
  assert.match(html, /id="dev-walk-next"/);
  assert.match(html, /渡りを断つ/);
  assert.match(html, /渡りを残す/);
  assert.match(html, /黒鴉の丘/);
  assert.match(html, /reboot-phase2-state\.js/);
  assert.match(html, /reboot-phase2-controller\.js/);
  assert.match(controller, /observeOldCrossingLocation/);
  assert.match(controller, /simulateOldCrossingDiscovery/);
  assert.doesNotMatch(html + controller, /expedition-system|territory-phase1|world-atlas\.js|save-system\.js/);
});
