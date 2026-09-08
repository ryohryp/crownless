const test = require('node:test');
const assert = require('node:assert/strict');
const base = require('../src/reboot-prototype-state.js');
const p2 = require('../src/reboot-phase2-state.js');
const p3 = require('../src/reboot-phase3-state.js');
const p4 = require('../src/reboot-phase4-state.js');
const p5 = require('../src/reboot-phase5-state.js');
const completion = require('../src/reboot-dev-tools.js');

function completeBranch(bell, crossing, hill, visit) {
  let state = base.discoverBellTower(base.createInitialState());
  state = base.applyBellChoice(state, bell);
  state = p2.discoverOldCrossing(state);
  state = p2.applyCrossingChoice(state, crossing);
  state = p3.discoverBlackRavenHill(state);
  state = p3.applyHillChoice(state, hill);
  state = p4.discoverForkPlace(state, visit);
  state = p5.discoverCollisionPlace(state);
  return state;
}

test('all 16 irreversible branches reach one of four endings with six land memories', () => {
  const branchKeys = new Set();
  const endingKeys = new Set();
  for (const bell of [base.CHOICES.RING_BELL, base.CHOICES.BREAK_BELL]) {
    for (const crossing of [p2.CHOICES.CUT_CROSSING, p2.CHOICES.KEEP_CROSSING]) {
      for (const hill of [p3.CHOICES.SIGNAL_CHAPEL, p3.CHOICES.SIGNAL_GATE]) {
        for (const visit of [p4.SALT_CHAPEL, p4.RUINED_GATE]) {
          const result = completion.buildCompletion(completeBranch(bell, crossing, hill, visit));
          assert.ok(result);
          assert.equal(result.memories.length, 6);
          assert.equal(new Set(result.memories.map((entry) => entry.id)).size, 6);
          assert.ok(result.memories.every((entry) => entry.statusLabel.length > 0));
          assert.doesNotMatch(result.branchSummary, /ring_bell|break_bell|cut_crossing|keep_crossing|signal_chapel|signal_gate|salt_chapel|ruined_gate/);
          branchKeys.add(result.branchKey);
          endingKeys.add(result.endingKey);
        }
      }
    }
  }
  assert.equal(branchKeys.size, 16);
  assert.deepEqual(new Set(Object.values(p5.OUTCOME_KEYS)), endingKeys);
});

test('land memory distinguishes the visited fork from the place that changed off-screen', () => {
  const result = completion.buildCompletion(completeBranch(
    base.CHOICES.BREAK_BELL,
    p2.CHOICES.KEEP_CROSSING,
    p3.CHOICES.SIGNAL_GATE,
    p4.RUINED_GATE
  ));
  const chapel = result.memories.find((entry) => entry.id === p4.SALT_CHAPEL);
  const gate = result.memories.find((entry) => entry.id === p4.RUINED_GATE);
  const hill = result.memories.find((entry) => entry.id === p3.BLACK_RAVEN_HILL);
  assert.equal(chapel.statusLabel, '未訪問: 世界は進んだ');
  assert.equal(gate.statusLabel, '訪問した');
  assert.equal(hill.title, '道見の丘');
  assert.match(result.branchSummary, /鐘を壊した.*渡りを残した.*街道へ合図した.*朽ちた関門へ先に向かった/);
});

test('completion survives serialize/reload without losing the ending or branch history', () => {
  const state = completeBranch(
    base.CHOICES.BREAK_BELL,
    p2.CHOICES.KEEP_CROSSING,
    p3.CHOICES.SIGNAL_GATE,
    p4.RUINED_GATE
  );
  const before = completion.buildCompletion(state);
  const after = completion.buildCompletion(p5.parseState(p5.serializeState(state)));
  assert.equal(after.endingKey, before.endingKey);
  assert.equal(after.branchKey, before.branchKey);
  assert.equal(after.branchSummary, before.branchSummary);
  assert.deepEqual(after.memories, before.memories);
});

test('resilient storage keeps world state in the same tab when persistent writes are denied', () => {
  const failures = [];
  const denied = {
    getItem() { return null; },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
    clear() { throw new Error('denied'); }
  };
  const storage = completion.createResilientStorage(denied, (status) => failures.push(status));
  storage.setItem(base.STORAGE_KEY, '{"hello":"world"}');
  assert.equal(storage.getItem(base.STORAGE_KEY), '{"hello":"world"}');
  assert.equal(storage.isPersistent(), false);
  assert.ok(failures.some((entry) => entry.persistent === false));
});

test('resilient storage prefers newer memory and preserves it when reset deletion is denied', () => {
  let persisted = '{"version":"old"}';
  const native = {
    getItem() { return persisted; },
    setItem() { throw new DOMException('quota', 'QuotaExceededError'); },
    removeItem() { throw new DOMException('blocked', 'SecurityError'); },
    clear() {}
  };
  const storage = completion.createResilientStorage(native);
  assert.equal(storage.getItem(base.STORAGE_KEY), persisted);
  storage.setItem(base.STORAGE_KEY, '{"version":"new"}');
  persisted = '{"version":"older-persistent"}';
  assert.equal(storage.getItem(base.STORAGE_KEY), '{"version":"new"}');
  assert.equal(storage.removeItem(base.STORAGE_KEY), false);
  assert.equal(storage.getItem(base.STORAGE_KEY), '{"version":"new"}');
});

test('resilient reset removes only the requested key after native deletion succeeds', () => {
  const removed = [];
  const native = {
    getItem() { return null; },
    setItem() {},
    removeItem(key) { removed.push(key); },
    clear() { throw new Error('clear must not be called'); }
  };
  const storage = completion.createResilientStorage(native);
  storage.setItem(base.STORAGE_KEY, 'current');
  assert.equal(storage.removeItem(base.STORAGE_KEY), true);
  assert.deepEqual(removed, [base.STORAGE_KEY]);
  assert.equal(storage.getItem(base.STORAGE_KEY), null);
});

test('location request gate rejects duplicate requests and stale callbacks after mode switching', () => {
  const gate = completion.createLocationRequestGate();
  const first = gate.begin();
  assert.ok(first);
  assert.equal(gate.begin(), null);
  gate.invalidate();
  assert.equal(gate.settle(first), false);
  const second = gate.begin();
  assert.ok(second);
  assert.equal(gate.settle(second), true);
});

test('location accuracy distinguishes insufficient samples while allowing missing accuracy metadata', () => {
  assert.equal(completion.accuracyStatus({ coords: { accuracy: 20 } }), 'acceptable');
  assert.equal(completion.accuracyStatus({ coords: { accuracy: 250 } }), 'insufficient');
  assert.equal(completion.accuracyStatus({ coords: {} }), 'unknown');
});

test('location failures provide retryable player-facing messages', () => {
  assert.match(completion.locationErrorMessage({ code: 1 }), /許可.*再試行.*模擬探索/);
  assert.match(completion.locationErrorMessage({ code: 2 }), /取得できない.*再試行.*模擬探索/);
  assert.match(completion.locationErrorMessage({ code: 3 }), /時間切れ.*再試行.*模擬探索/);
  assert.match(completion.locationErrorMessage({ code: 2, accuracy: 180 }), /約180m.*再試行.*模擬探索/);
});

test('GPS collision discovery uses the same p5 discovery transition as DEV', () => {
  let hinted = completeBranch(
    base.CHOICES.RING_BELL,
    p2.CHOICES.CUT_CROSSING,
    p3.CHOICES.SIGNAL_CHAPEL,
    p4.SALT_CHAPEL
  );
  hinted = p5.normalizeState({
    ...hinted,
    discoveredPlaces: hinted.discoveredPlaces.filter((id) => id !== p5.COLLISION_PLACE)
  });
  const session = { anchor: null, lastReading: null };
  const origin = { latitude: 35, longitude: 139 };
  assert.equal(completion.observeCollisionLocation(session, hinted, origin).status, 'anchored');
  const gps = completion.observeCollisionLocation(session, hinted, { latitude: 35.00062, longitude: 139 });
  const dev = p5.discoverCollisionPlace(hinted);
  assert.equal(gps.status, 'discovered');
  assert.equal(p5.serializeState(gps.state), p5.serializeState(dev));
});
