'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RELIC_CATALOG,
  getRelicsForSignal,
  createRegionalRelicInstance,
  rollLandmarkRelic,
  formatRelicDisplay,
} = require('../src/frontier-regional-relics.js');

test('Frontier Regional Relics Catalog contains diverse landmarks', () => {
  assert.ok(RELIC_CATALOG.length >= 10, 'Catalog should have at least 10 regional relics');

  const signals = new Set(RELIC_CATALOG.map(r => r.signal));
  assert.ok(signals.has('sacred'), 'Must contain sacred relics');
  assert.ok(signals.has('water'), 'Must contain water relics');
  assert.ok(signals.has('road_hub'), 'Must contain road_hub relics');
  assert.ok(signals.has('woods'), 'Must contain woods relics');
  assert.ok(signals.has('height'), 'Must contain height relics');
  assert.ok(signals.has('historic'), 'Must contain historic relics');
});

test('getRelicsForSignal filters relics matching signal', () => {
  const sacred = getRelicsForSignal('sacred');
  assert.ok(sacred.length >= 2);
  assert.ok(sacred.every(r => r.signal === 'sacred'));

  const water = getRelicsForSignal('water');
  assert.ok(water.length >= 2);
  assert.ok(water.every(r => r.signal === 'water'));
});

test('createRegionalRelicInstance stamps real landmark name and date', () => {
  const inst = createRegionalRelicInstance('relic_sacred_exorcist_dagger', '北野天満宮', { lat: 35.03, lng: 135.73 });
  assert.equal(inst.name, '破魔の短剣');
  assert.equal(inst.originPlace, '北野天満宮');
  assert.ok(inst.discoveredDate.length >= 8);
  assert.equal(inst.coordinates.lat, 35.03);
  assert.ok(inst.trait.includes('破魔の光'));

  const display = formatRelicDisplay(inst);
  assert.ok(display.includes('破魔の短剣'));
  assert.ok(display.includes('北野天満宮'));
});

test('rollLandmarkRelic returns valid instance with rolled candidate', () => {
  const relic = rollLandmarkRelic('woods', '明治神宮御苑', null, 0.1);
  assert.ok(relic.instanceId.startsWith('inst_'));
  assert.equal(relic.signal, 'woods');
  assert.equal(relic.originPlace, '明治神宮御苑');
});
