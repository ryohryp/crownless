'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createInitialState,
  getOutpost,
  claimOutpost,
  buildFacility,
  simulateRivalAttack,
} = require('../src/frontier-outpost.js');

test('Frontier Outpost: claiming creates outpost with initial level and history', () => {
  let state = createInitialState();
  state = claimOutpost(state, 'shrine_01', '北野天満宮・神域の祠', 'sacred');

  const outpost = getOutpost(state, 'shrine_01');
  assert.ok(outpost, 'Outpost must exist');
  assert.equal(outpost.title, '北野天満宮・神域の祠');
  assert.equal(outpost.owner, 'player');
  assert.equal(outpost.level, 1);
  assert.equal(outpost.defenseRating, 20);
  assert.equal(outpost.history.length, 1);
  assert.ok(outpost.history[0].text.includes('設営した'));
});

test('Frontier Outpost: building facility increases level and defense rating', () => {
  let state = createInitialState();
  state = claimOutpost(state, 'tower_01', '鐘なき塔・見張り砦', 'height');

  // Attempt building without enough scrap
  const failResult = buildFacility(state, 'tower_01', 'watchtower', 4);
  assert.equal(failResult.success, false);
  assert.ok(failResult.reason.includes('鉄片が不足'));

  // Build watchtower with 10 scrap (cost is 8)
  const successResult = buildFacility(state, 'tower_01', 'watchtower', 10);
  assert.equal(successResult.success, true);
  assert.equal(successResult.scrapSpent, 8);
  state = successResult.state;

  const outpost = getOutpost(state, 'tower_01');
  assert.equal(outpost.facilities.watchtower, 1);
  assert.equal(outpost.defenseRating, 45); // 20 + 1 * 25
  assert.ok(outpost.history[1].text.includes('見張り塔 を Lv1 に増築した'));
});

test('Frontier Outpost: high watchtower defense repels rival attack', () => {
  let state = createInitialState();
  state = claimOutpost(state, 'bridge_01', '隅田川・霧裂きの古橋', 'water');

  // Upgrade watchtower to Lv2 (defense 70)
  state = buildFacility(state, 'bridge_01', 'watchtower', 20).state;
  state = buildFacility(state, 'bridge_01', 'watchtower', 30).state;
  const outpost = getOutpost(state, 'bridge_01');
  assert.equal(outpost.defenseRating, 70);

  // Roll 0.5 < 0.70 (repelled!)
  state = simulateRivalAttack(state, 'bridge_01', '灰鴉', 0.5);
  const repelledOutpost = getOutpost(state, 'bridge_01');
  assert.equal(repelledOutpost.owner, 'player');
  assert.ok(repelledOutpost.history.some(h => h.text.includes('襲撃を撃退した')));

  // Roll 0.95 > 0.70 (captured)
  state = simulateRivalAttack(state, 'bridge_01', '灰鴉', 0.95);
  const capturedOutpost = getOutpost(state, 'bridge_01');
  assert.equal(capturedOutpost.owner, 'rival');
  assert.ok(capturedOutpost.history.some(h => h.text.includes('拠点を一時奪われた')));
});
