const test = require('node:test');
const assert = require('node:assert/strict');
const rescue = require('../src/rescue-cache');

test('a defeat leaves a bounded cache only at the same game location', () => {
  const report = { died: true, place: 'wood', scrap: 15, gear: ['fang_blood'], gearQuality: [2] };
  assert.deepEqual(rescue.cacheFromReport(report, 'wood'), { gear: 'fang_blood', quality: 2, scrap: 7 });
  assert.equal(rescue.cacheFromReport(report, 'tower'), null);
  assert.equal(rescue.cacheFromReport({ ...report, died: false }, 'wood'), null);
});

test('cache keeps at most eight scrap and one lost gear', () => {
  assert.deepEqual(
    rescue.cacheFromReport({ died: true, place: 'wood', scrap: 100, gear: ['fang_blood', 'fang_moon'], gearQuality: [3, 0] }, 'wood'),
    { gear: 'fang_blood', quality: 3, scrap: 8 },
  );
});

test('recovered loot returns to the new backpack and is still at risk', () => {
  const state = { expedition: { scrap: 0, gear: [], gearQuality: [], log: ['start'] } };
  const next = rescue.applyToExpedition(state, { gear: 'fang_blood', quality: 1, scrap: 6 });
  assert.equal(next.expedition.scrap, 6);
  assert.deepEqual(next.expedition.gear, ['fang_blood']);
  assert.deepEqual(next.expedition.gearQuality, [1]);
  assert.match(next.expedition.log[0], /生還するまで確定しない/);
  assert.deepEqual(state.expedition.gear, []);
});

test('an empty defeat leaves no compulsory recovery loop', () => {
  assert.equal(rescue.cacheFromReport({ died: true, place: 'wood', scrap: 1, gear: [] }, 'wood'), null);
});
