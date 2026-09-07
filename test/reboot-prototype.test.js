const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const api = require('../src/reboot-prototype-state.js');

function movedNorth(latitudeDelta) {
  return { latitude: 35 + latitudeDelta, longitude: 139 };
}

test('initial reboot state is isolated and contains no gameplay progression systems', () => {
  const state = api.createInitialState();
  assert.deepEqual(state.discoveredPlaces, []);
  assert.equal(state.placeStates[api.BELL_TOWER], 'undiscovered');
  assert.equal(state.placeStates[api.OLD_CROSSING], 'unknown');
  assert.equal(state.choices[api.BELL_TOWER], null);
});

test('explicit location observations discover the bell tower without persisting coordinates', () => {
  const session = api.createLocationSession();
  let state = api.createInitialState();

  let result = api.observeDiscoveryLocation(session, state, movedNorth(0));
  assert.equal(result.status, 'anchored');
  state = result.state;

  result = api.observeDiscoveryLocation(session, state, movedNorth(0.0002));
  assert.equal(result.status, 'searching');
  state = result.state;

  result = api.observeDiscoveryLocation(session, state, movedNorth(0.0006));
  assert.equal(result.status, 'discovered');
  state = result.state;
  assert.equal(state.placeStates[api.BELL_TOWER], 'discovered');
  assert.ok(state.discoveredPlaces.includes(api.BELL_TOWER));

  const persisted = api.serializeState(state);
  assert.doesNotMatch(persisted, /latitude|longitude|coords|route|track/i);
  assert.doesNotMatch(persisted, /35\.0|139\.0/);
});

test('ringing the bell permanently creates the king beacon and soldier consequence', () => {
  let state = api.discoverBellTower(api.createInitialState());
  state = api.applyBellChoice(state, api.CHOICES.RING_BELL);
  assert.equal(state.placeStates[api.BELL_TOWER], 'king_beacon');
  assert.equal(state.placeStates[api.OLD_CROSSING], 'hinted');
  assert.equal(state.consequences[api.OLD_CROSSING], 'soldiers_found_something');
  assert.equal(api.getOutcomePresentation(state).towerTitle, '王の烽火');
});

test('breaking the bell permanently creates the free haven and refugee consequence', () => {
  let state = api.discoverBellTower(api.createInitialState());
  state = api.applyBellChoice(state, api.CHOICES.BREAK_BELL);
  assert.equal(state.placeStates[api.BELL_TOWER], 'free_haven');
  assert.equal(state.placeStates[api.OLD_CROSSING], 'hinted');
  assert.equal(state.consequences[api.OLD_CROSSING], 'refugees_missing');
  assert.equal(api.getOutcomePresentation(state).towerTitle, '自由民の隠れ家');
});

test('bell choice is irreversible', () => {
  let state = api.discoverBellTower(api.createInitialState());
  state = api.applyBellChoice(state, api.CHOICES.RING_BELL);
  assert.throws(
    () => api.applyBellChoice(state, api.CHOICES.BREAK_BELL),
    /irreversible/
  );
});

test('reload normalization retains authored consequence and strips injected location history', () => {
  let state = api.discoverBellTower(api.createInitialState());
  state = api.applyBellChoice(state, api.CHOICES.BREAK_BELL);
  const dirty = {
    ...state,
    latitude: 35.1,
    longitude: 139.1,
    routeHistory: [{ latitude: 35.1, longitude: 139.1 }],
    placeStates: { ...state.placeStates, privateHome: 'x' }
  };
  const reloaded = api.parseState(JSON.stringify(dirty));
  assert.equal(reloaded.choices[api.BELL_TOWER], api.CHOICES.BREAK_BELL);
  assert.equal(reloaded.placeStates[api.BELL_TOWER], 'free_haven');
  assert.equal(reloaded.consequences[api.OLD_CROSSING], 'refugees_missing');
  const serialized = api.serializeState(reloaded);
  assert.doesNotMatch(serialized, /latitude|longitude|routeHistory|privateHome/);
});

test('standalone entrypoint does not load existing Crownless gameplay or Atlas logic', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
  assert.match(html, /src\/reboot-prototype-state\.js/);
  assert.match(html, /src\/reboot-prototype\.js/);
  assert.doesNotMatch(html, /app\.js|expedition-system|territory-phase1|world-atlas\.js|save-system\.js/);
  assert.match(html, /鐘を鳴らす/);
  assert.match(html, /鐘を壊す/);
  assert.match(html, /古い渡り場/);
});

test('browser controller uses foreground one-shot geolocation only', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-prototype.js'), 'utf8');
  assert.match(script, /navigator\.geolocation\.getCurrentPosition/);
  assert.doesNotMatch(script, /watchPosition/);
  assert.doesNotMatch(script, /expedition-system|territory|save-system|world-atlas/);
});

test('visual layer includes branch-specific marks and reduced-motion handling', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-prototype.css'), 'utf8');
  assert.match(css, /data-outcome='king'/);
  assert.match(css, /data-outcome='free'/);
  assert.match(css, /prefers-reduced-motion/);
});
