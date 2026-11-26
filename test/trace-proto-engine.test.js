'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/trace-proto-engine.js');

test('transition probabilities match Muse Round 6 table within statistical tolerance', () => {
  const N = 8000;
  for (const [stateName, expected] of Object.entries(P.TRANSITIONS)) {
    const counts = { stay: 0, bloom: 0, disturb: 0, ruin: 0 };
    for (let i = 1; i <= N; i++) {
      const out = P.rollTransitionOutcome(stateName, i * 7919 + 13, 0);
      counts[out]++;
    }
    for (const [key, prob] of Object.entries(expected)) {
      const observed = counts[key] / N;
      assert.ok(
        Math.abs(observed - prob) < 0.02,
        `${stateName}.${key}: expected ${prob}, got ${observed.toFixed(4)}`,
      );
    }
  }
});

test('bloom uses 1.4x normally and 1.6x when staked or in greatbox; disturb cuts 30%', () => {
  // Find deterministic seeds that yield bloom or disturb on tick 0
  let bloomSeed = null;
  let disturbSeed = null;
  let ruinSeed = null;
  for (let s = 1; s < 5000; s++) {
    const o = P.rollTransitionOutcome('intact', s, 0);
    if (!bloomSeed && o === 'bloom') bloomSeed = s;
    if (!disturbSeed && o === 'disturb') disturbSeed = s;
    if (!ruinSeed && o === 'ruin') ruinSeed = s;
    if (bloomSeed && disturbSeed && ruinSeed) break;
  }
  assert.ok(bloomSeed && disturbSeed && ruinSeed);

  const normalBloom = P.applySingleTick({
    id: 't1', area: 'sim_park', type: 'cache', owner: 'player',
    container: 'normal', staked: false, items: { iron: 5, fang: 0 },
    initialTotal: 5, state: 'intact', seed: bloomSeed, placedAt: 0, lastTickAt: 0, ticksApplied: 0, expiresAt: 1e12, real: false,
  }, 0);
  assert.equal(normalBloom.state, 'bloomed');
  assert.equal(P.itemTotal(normalBloom.items), Math.ceil(5 * 1.4)); // 7

  const stakedBloom = P.applySingleTick({
    id: 't2', area: 'sim_park', type: 'cache', owner: 'player',
    container: 'normal', staked: true, items: { iron: 5, fang: 0 },
    initialTotal: 5, state: 'intact', seed: bloomSeed, placedAt: 0, lastTickAt: 0, ticksApplied: 0, expiresAt: 1e12, real: false,
  }, 0);
  assert.equal(P.itemTotal(stakedBloom.items), Math.ceil(5 * 1.6)); // 8

  const greatboxBloom = P.applySingleTick({
    id: 't3', area: 'sim_park', type: 'cache', owner: 'player',
    container: 'greatbox', staked: false, items: { iron: 5, fang: 0 },
    initialTotal: 5, state: 'intact', seed: bloomSeed, placedAt: 0, lastTickAt: 0, ticksApplied: 0, expiresAt: 1e12, real: false,
  }, 0);
  assert.equal(P.itemTotal(greatboxBloom.items), 8);

  const disturbed = P.applySingleTick({
    id: 't4', area: 'sim_park', type: 'cache', owner: 'player',
    container: 'normal', staked: false, items: { iron: 7, fang: 3 },
    initialTotal: 10, state: 'intact', seed: disturbSeed, placedAt: 0, lastTickAt: 0, ticksApplied: 0, expiresAt: 1e12, real: false,
  }, 0);
  assert.equal(disturbed.state, 'disturbed');
  assert.equal(P.itemTotal(disturbed.items), 7); // 10 - 30% = 7

  const ruined = P.applySingleTick({
    id: 't5', area: 'sim_park', type: 'cache', owner: 'player',
    container: 'normal', staked: false, items: { iron: 4, fang: 2 },
    initialTotal: 6, state: 'intact', seed: ruinSeed, placedAt: 0, lastTickAt: 0, ticksApplied: 0, expiresAt: 1e12, real: false,
  }, 0);
  assert.equal(ruined.state, 'ruined');
  assert.equal(P.itemTotal(ruined.items), 0);
});

test('effort 4 settlement enforces scarcity: gentle(3), pry(1), preserve(1) and overnight decay', () => {
  let state = P.initialState('sim', 1000);
  state = P.setSimulatedArea(state, 'park', 1000);
  state = P.pickupCache(state, 't_init_park', 1000);
  state = P.setSimulatedArea(state, 'station', 1000);
  state = P.pickupCache(state, 't_init_station', 1000);
  assert.equal(state.carried.length, 2);
  assert.equal(state.effort, 4);

  // Preserve the second cache (cost 1 -> effort 3) and gentle open the first (cost 3 -> effort 0)
  state = P.preserveCarry(state, state.carried[1].carryId);
  assert.equal(state.effort, 3);
  const gentleRes = P.openGentle(state, state.carried[0].carryId);
  state = gentleRes.state;
  assert.equal(state.effort, 0);
  assert.equal(state.carried.length, 1);
  assert.equal(P.itemTotal(state.inventory), 6 + 4); // started 4+2=6, park had 3+1=4

  // Insufficient effort blocks another action
  const blocked = P.openPry(state, state.carried[0].carryId);
  assert.equal(blocked, state);

  // Preserved carry survives endNight without decay
  const stationBefore = P.itemTotal(state.carried[0].items);
  const night1 = P.endNight(state);
  state = night1.state;
  assert.equal(state.effort, 4);
  assert.equal(state.dayCount, 2);
  assert.equal(state.carried.length, 1);
  assert.equal(P.itemTotal(state.carried[0].items), stationBefore);
  assert.equal(state.carried[0].preserved, false);

  // Unpreserved carry decays overnight
  const night2 = P.endNight(state);
  state = night2.state;
  if (state.carried.length > 0) {
    assert.ok(P.itemTotal(state.carried[0].items) <= stationBefore);
  }
});

test('openPry matches 50% clean / 35% damaged / 15% trap distribution', () => {
  const counts = { pry_clean: 0, pry_damaged: 0, pry_trap: 0 };
  const N = 4000;
  for (let i = 1; i <= N; i++) {
    const s = P.initialState('sim', 1000);
    s.carried = [{
      carryId: `c_${i}`,
      traceId: `t_${i}`,
      area: 'sim_park',
      areaId: 'park',
      areaName: '近くの公園',
      areaColor: '#7ba6c7',
      owner: 'ecosystem',
      items: { iron: 6, fang: 4 },
      initialTotal: 10,
      state: 'intact',
      seed: i * 9973,
      placedAt: 0,
      pickedAt: 1000,
      preserved: false,
      real: false,
    }];
    const res = P.openPry(s, `c_${i}`);
    counts[res.result.outcome]++;
    if (res.result.outcome === 'pry_trap') {
      assert.equal(P.itemTotal(res.state.inventory), 5); // 6 - 1 spilled
    }
  }
  assert.ok(Math.abs(counts.pry_clean / N - 0.50) < 0.025);
  assert.ok(Math.abs(counts.pry_damaged / N - 0.35) < 0.025);
  assert.ok(Math.abs(counts.pry_trap / N - 0.15) < 0.025);
});

test('greatbox crafting consumes 12 materials and unlocks 4-cost container', () => {
  let state = P.initialState('sim', 1000);
  state.inventory = { iron: 9, fang: 4 }; // total 13
  state = P.craftGreatbox(state);
  assert.equal(state.greatboxUnlocked, true);
  assert.equal(P.itemTotal(state.inventory), 1); // 13 - 12

  state.inventory = { iron: 4, fang: 0 };
  state = P.setSimulatedArea(state, 'home', 1000);
  state = P.placeCache(state, { container: 'greatbox' }, 1000);
  const placed = P.activeTraceInArea(state, P.findArea(state, 'home'));
  assert.equal(placed.container, 'greatbox');
  assert.equal(placed.initialTotal, 4);
});

test('GPS calibration rounds raw coordinates, obeys 1.5x hysteresis, and promotes provisional area on 2nd visit', () => {
  let state = P.initialState('walk', 1000);
  const rawLat = 35.68123456;
  const rawLng = 139.76712345;
  state = P.calibrateArea(state, 'station', rawLat, rawLng);

  const savedJson = P.serializeSave(state);
  assert.equal(savedJson.includes('35.68123456'), false);
  assert.equal(savedJson.includes('139.76712345'), false);
  assert.equal(state.currentAreaId, 'station');

  // Inside 1.5x radius (150m * 1.5 = 225m -> ~190m north): stay in station due to hysteresis
  const station = P.findArea(state, 'station');
  const dLat190m = 190 / 111320;
  state = P.detectLocation(state, station.coarseLat + dLat190m, station.coarseLng, 2000);
  assert.equal(state.currentAreaId, 'station');

  // Beyond 1.5x radius (~260m north): exit station
  const dLat260m = 260 / 111320;
  state = P.detectLocation(state, station.coarseLat + dLat260m, station.coarseLng, 3000);
  assert.equal(state.currentAreaId, null);

  // Place cache outside registered areas -> creates provisional area
  const outLat = 35.7104321;
  const outLng = 139.7908765;
  state = P.detectLocation(state, outLat, outLng, 4000);
  state = P.placeCache(state, { rawLat: outLat, rawLng: outLng }, 4000);
  const provArea = state.areas.find(a => a.provisional);
  assert.ok(provArea);
  assert.equal(P.serializeSave(state).includes('35.7104321'), false);

  // Walk away (>225m) then come back -> 2nd visit promotes provisional area
  state = P.detectLocation(state, outLat + dLat260m * 2, outLng, 5000);
  assert.equal(state.currentAreaId, null);
  state = P.detectLocation(state, provArea.coarseLat, provArea.coarseLng, 6000);
  assert.equal(state.lastPromotedAreaId, provArea.id);
  assert.equal(P.findArea(state, provArea.id).provisional, false);
});

test('senseCache hides exact numbers and save separation isolates walk vs sim', () => {
  let state = P.initialState('sim', 1000);
  const sensed = P.senseCache(state, 't_init_park', 1000);
  assert.ok(['light', 'medium', 'heavy'].includes(sensed.senseFeedback.tier));
  assert.doesNotMatch(sensed.senseFeedback.text, /\d/);
  assert.notEqual(P.STORAGE_KEYS.walk, P.STORAGE_KEYS.sim);
  assert.equal(P.parseSave(P.serializeSave(sensed), 'walk'), null);
  assert.ok(P.parseSave(P.serializeSave(sensed), 'sim'));
});
