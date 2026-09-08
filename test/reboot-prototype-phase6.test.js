const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = require('../src/reboot-prototype-state.js');
const p2 = require('../src/reboot-phase2-state.js');
const p3 = require('../src/reboot-phase3-state.js');
const p4 = require('../src/reboot-phase4-state.js');
const locationModel = require('../src/reboot-phase6-location.js');

function reachHill(hillChoice = p3.CHOICES.SIGNAL_CHAPEL) {
  let state = base.discoverBellTower(base.createInitialState());
  state = base.applyBellChoice(state, base.CHOICES.RING_BELL);
  state = p2.discoverOldCrossing(state);
  state = p2.applyCrossingChoice(state, p2.CHOICES.KEEP_CROSSING);
  state = p3.discoverBlackRavenHill(state);
  return p3.applyHillChoice(state, hillChoice);
}

function moveMany(session, direction, count) {
  let next = session;
  for (let index = 0; index < count; index += 1) {
    next = locationModel.moveSession(next, direction);
  }
  return next;
}

test('the directional session starts with two distant ambiguous traces', () => {
  const session = locationModel.createSession();
  const senses = locationModel.senseAll(session);
  assert.equal(senses.length, 2);
  assert.deepEqual(senses.map((sense) => sense.strength), ['far', 'far']);
  assert.deepEqual(senses.map((sense) => sense.direction), ['南西', '西']);
  assert.equal(locationModel.discoveredPlace(session), null);
});

test('walking west changes information before it discovers a destination', () => {
  const session = locationModel.moveSession(locationModel.createSession(), 'west');
  const valley = locationModel.senseTrace(session, p4.SALT_CHAPEL);
  const road = locationModel.senseTrace(session, p4.RUINED_GATE);
  assert.equal(valley.strength, 'far');
  assert.equal(road.strength, 'noticed');
  assert.match(road.text, /石を打つ/);
  assert.equal(locationModel.discoveredPlace(session), null);
});

test('walking far enough west discovers the road trace without a destination button', () => {
  const session = moveMany(locationModel.createSession(), 'west', 4);
  assert.equal(locationModel.discoveredPlace(session), p4.RUINED_GATE);
});

test('walking southwest discovers the valley trace', () => {
  let session = moveMany(locationModel.createSession(), 'south', 3);
  session = moveMany(session, 'west', 2);
  assert.equal(locationModel.discoveredPlace(session), p4.SALT_CHAPEL);
});

test('directional discovery feeds the existing irreversible Phase 4 transition', () => {
  const before = reachHill(p3.CHOICES.SIGNAL_CHAPEL);
  const session = moveMany(locationModel.createSession(), 'west', 4);
  const placeId = locationModel.discoveredPlace(session);
  const after = p4.discoverForkPlace(before, placeId);

  assert.equal(after.choices[p4.FORK_FIRST_VISIT], p4.RUINED_GATE);
  assert.equal(after.placeStates[p4.RUINED_GATE], 'discovered_exposed');
  assert.equal(after.placeStates[p4.SALT_CHAPEL], 'sealed_without_you');
  assert.throws(() => p4.discoverForkPlace(after, p4.SALT_CHAPEL), /irreversible/);
});

test('live location samples become transient east/north meter offsets', () => {
  const origin = { latitude: 35, longitude: 139 };
  const north = locationModel.relativeMeters(origin, { latitude: 35.00036, longitude: 139 });
  const east = locationModel.relativeMeters(origin, { latitude: 35, longitude: 139.00044 });

  assert.ok(Math.abs(north.y - 40) < 2, `north offset was ${north.y}`);
  assert.ok(Math.abs(north.x) < 1);
  assert.ok(Math.abs(east.x - 40) < 3, `east offset was ${east.x}`);
  assert.ok(Math.abs(east.y) < 1);
});

test('location-session code has no persistence or route-history mechanism', () => {
  const locationSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase6-location.js'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase6-controller.js'), 'utf8');

  assert.doesNotMatch(locationSource, /localStorage|routeHistory|track|watchPosition/i);
  assert.doesNotMatch(controller, /localStorage\.setItem|watchPosition|routeHistory|track/i);
  assert.match(controller, /CrownlessRebootLocation\.request/);
  assert.match(controller, /let liveOrigin = null/);
});

test('Phase 6 UI exposes directions, not named destination choices', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase6.css'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase6-controller.js'), 'utf8');
  const section = html.match(/<section id="phase6-navigation"[\s\S]*?<\/section>/);

  assert.ok(section, 'Phase 6 navigation section should exist');
  assert.match(section[0], /data-move="north"/);
  assert.match(section[0], /data-move="east"/);
  assert.match(section[0], /data-move="south"/);
  assert.match(section[0], /data-move="west"/);
  assert.doesNotMatch(section[0], /data-place|塩の礼拝堂|朽ちた関門/);
  assert.match(html, /reboot-phase6-location\.js/);
  assert.match(html, /reboot-phase6-controller\.js/);
  assert.match(css, /data-phase6-navigation='enabled'[\s\S]*?#phase4-actions/);
  assert.match(css, /data-phase6='searching'[\s\S]*?\.chapel-label/);
  assert.match(controller, /phase4Actions\.hidden = true/);
  assert.match(controller, /button\.click\(\)/);
  assert.doesNotMatch(controller, /discoverForkPlace\(/);
});
