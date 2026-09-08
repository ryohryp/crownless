const test = require('node:test');
const assert = require('node:assert/strict');
const { createStorage, createLocationReader, locationErrorMessage } = require('../src/reboot-session.js');
const base = require('../src/reboot-prototype-state.js');
const p2 = require('../src/reboot-phase2-state.js');
const p3 = require('../src/reboot-phase3-state.js');
const p4 = require('../src/reboot-phase4-state.js');
const p5 = require('../src/reboot-phase5-state.js');
function harness(provider) {
  let timeout;
  const reader = createLocationReader(() => provider, { setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() {} });
  return { reader, expire: () => timeout() };
}
test('GPS single flight, cancellation and late callback cannot advance the world twice', () => {
  let success; let requests = 0; let discoveries = 0;
  const busy = [];
  const { reader } = harness({ getCurrentPosition(ok) { requests++; success = ok; } });
  reader.request(() => discoveries++, assert.fail, value => busy.push(value));
  assert.equal(reader.request(() => discoveries++, assert.fail), false);
  assert.equal(requests, 1);
  reader.cancel();
  success({ coords: { latitude: 35, longitude: 139 } });
  assert.equal(discoveries, 0);
  assert.deepEqual(busy, [true, false]);
  reader.request(() => discoveries++, assert.fail);
  success({ coords: { latitude: 35, longitude: 139 } });
  success({ coords: { latitude: 35, longitude: 139 } });
  assert.equal(discoveries, 1);
});
test('GPS timeout recovers when provider never calls back; stale results are ignored', () => {
  let callback;
  const failures = [];
  const { reader, expire } = harness({ getCurrentPosition(ok) { callback = ok; } });
  reader.request(assert.fail, error => failures.push(error.code));
  expire();
  callback({ coords: { latitude: 35, longitude: 139 } });
  assert.deepEqual(failures, [3]);
  assert.equal(reader.pending, false);
});
test('GPS denied, unavailable, thrown errors and imprecise/invalid fixes release the reader', () => {
  for (const provider of [null,
    { getCurrentPosition(_, fail) { fail({ code: 1 }); } },
    { getCurrentPosition() { throw Error('unavailable'); } },
    { getCurrentPosition(ok) { ok({ coords: { latitude: 91, longitude: 139 } }); } },
    { getCurrentPosition(ok) { ok({ coords: { latitude: 35, longitude: 139, accuracy: 500 } }); } }
  ]) {
    const { reader } = harness(provider); let error;
    reader.request(assert.fail, value => { error = value; });
    assert.ok(error);
    assert.ok(locationErrorMessage(error).length > 10);
    assert.equal(reader.pending, false);
  }
  assert.equal(new Set([1, 2, 3, 4].map(code => locationErrorMessage({ code }))).size, 4);
});
test('blocked storage keeps all 16 branches playable, private and idempotent', () => {
  const endings = new Set();
  for (const bell of Object.values(base.CHOICES)) for (const crossing of Object.values(p2.CHOICES)) {
    for (const hill of Object.values(p3.CHOICES)) for (const first of [p4.SALT_CHAPEL, p4.RUINED_GATE]) {
      const storage = createStorage(() => { throw Error('blocked'); });
      const key = base.STORAGE_KEY;
      assert.equal(storage.getItem(key), null);
      let state = base.applyBellChoice(base.discoverBellTower(base.createInitialState()), bell);
      storage.setItem(key, base.serializeState(state));
      state = p2.applyCrossingChoice(p2.discoverOldCrossing(p2.parseState(storage.getItem(key))), crossing);
      storage.setItem(key, p2.serializeState(state));
      state = p3.applyHillChoice(p3.discoverBlackRavenHill(p3.parseState(storage.getItem(key))), hill);
      storage.setItem(key, p3.serializeState(state));
      state = p4.discoverForkPlace(p4.parseState(storage.getItem(key)), first);
      storage.setItem(key, p4.serializeState(state));
      state = p5.parseState(storage.getItem(key));
      const session = p5.createLocationSession();
      assert.equal(p5.observeCollisionLocation(session, state, { latitude: 35, longitude: 139 }).status, 'anchored');
      assert.equal(p5.observeCollisionLocation(session, state, { latitude: 35.0001, longitude: 139 }).status, 'searching');
      const result = p5.observeCollisionLocation(session, state, { latitude: 35.0006, longitude: 139 });
      assert.equal(result.status, 'discovered');
      assert.deepEqual(result.state, p5.discoverCollisionPlace(state));
      storage.setItem(key, p5.serializeState(result.state));
      const reloaded = p5.parseState(storage.getItem(key));
      assert.deepEqual(p5.discoverCollisionPlace(reloaded), reloaded);
      assert.equal(reloaded.choices[base.BELL_TOWER], bell);
      assert.equal(reloaded.choices[p2.OLD_CROSSING], crossing);
      assert.equal(reloaded.choices[p3.BLACK_RAVEN_HILL], hill);
      assert.equal(reloaded.choices[p4.FORK_FIRST_VISIT], first);
      assert.doesNotMatch(storage.getItem(key), /latitude|longitude|routeHistory|accuracy/);
      assert.equal(storage.available, false);
      endings.add(reloaded.placeStates[p5.COLLISION_PLACE]);
    }
  }
  assert.equal(endings.size, 4);
});
test('failed write reads new session state rather than stale persistent save', () => {
  const storage = createStorage(() => ({ getItem: () => 'old', setItem() { throw Error('quota'); } }));
  assert.equal(storage.getItem('world'), 'old');
  storage.setItem('world', 'new');
  assert.equal(storage.getItem('world'), 'new');
  assert.equal(storage.available, false);
});
