const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Reboot state modules intentionally mirror browser script order and publish each
// predecessor on globalThis. Keep the Node test bootstrap in that same order.
require('../src/reboot-prototype-state.js');
require('../src/reboot-phase2-state.js');
require('../src/reboot-phase3-state.js');
const p4 = require('../src/reboot-phase4-state.js');
const locationModel = require('../src/reboot-phase6-location.js');
const fieldModel = require('../src/reboot-phase7-exploration.js');

function moveMany(session, direction, count) {
  let next = session;
  for (let index = 0; index < count; index += 1) next = locationModel.moveSession(next, direction);
  return next;
}

test('movement trend compares the previous and current sample without exposing a distance score', () => {
  const start = locationModel.createSession();
  const west = locationModel.moveSession(start, 'west');
  const observation = fieldModel.observe(start, west, fieldModel.createClueMemory());
  const road = observation.senses.find((sense) => sense.placeId === p4.RUINED_GATE);
  const valley = observation.senses.find((sense) => sense.placeId === p4.SALT_CHAPEL);

  assert.equal(road.trend, 'closer');
  assert.equal(road.trendLabel, '近づいた');
  assert.equal(valley.trend, 'closer');
  assert.doesNotMatch(observation.note, /\d+m|メートル|距離/);
});

test('reaching noticed range records a road clue in transient memory', () => {
  const start = locationModel.createSession();
  const west = locationModel.moveSession(start, 'west');
  const observation = fieldModel.observe(start, west, fieldModel.createClueMemory());

  assert.deepEqual(observation.memory[p4.RUINED_GATE], ['車輪と石を打つ音']);
  assert.deepEqual(observation.memory[p4.SALT_CHAPEL], []);
});

test('a clue remains remembered after walking away from that trace', () => {
  const start = locationModel.createSession();
  const west = locationModel.moveSession(start, 'west');
  const first = fieldModel.observe(start, west, fieldModel.createClueMemory());
  const eastBack = locationModel.moveSession(west, 'east');
  const second = fieldModel.observe(west, eastBack, first.memory);

  assert.ok(second.memory[p4.RUINED_GATE].includes('車輪と石を打つ音'));
  const road = second.senses.find((sense) => sense.placeId === p4.RUINED_GATE);
  assert.equal(road.trend, 'farther');
});

test('near range adds richer clues without duplicating earlier ones', () => {
  const start = locationModel.createSession();
  const west1 = locationModel.moveSession(start, 'west');
  const noticed = fieldModel.observe(start, west1, fieldModel.createClueMemory());
  const west2 = locationModel.moveSession(west1, 'west');
  const near = fieldModel.observe(west1, west2, noticed.memory);

  assert.deepEqual(near.memory[p4.RUINED_GATE], [
    '車輪と石を打つ音',
    '崩れた石壁',
    '誰かが道を塞ぐ気配'
  ]);
});

test('the player can scout both directions before committing to either destination', () => {
  const origin = locationModel.createSession();
  const west = locationModel.moveSession(origin, 'west');
  const roadObservation = fieldModel.observe(origin, west, fieldModel.createClueMemory());

  let session = locationModel.moveSession(west, 'east');
  session = locationModel.moveSession(session, 'south');
  session = locationModel.moveSession(session, 'south');
  const valleyObservation = fieldModel.observe(origin, session, roadObservation.memory);

  assert.ok(valleyObservation.memory[p4.RUINED_GATE].includes('車輪と石を打つ音'));
  assert.ok(valleyObservation.memory[p4.SALT_CHAPEL].includes('鈍い鐘の音'));
  assert.equal(locationModel.discoveredPlace(session), null);
});

test('field notes describe observation changes instead of commanding a route', () => {
  const origin = locationModel.createSession();
  const east = locationModel.moveSession(origin, 'east');
  const observation = fieldModel.observe(origin, east, fieldModel.createClueMemory());

  assert.match(observation.note, /遠のいた|変わらない|濃くなった/);
  assert.doesNotMatch(observation.note, /行け|進め|向かえ|最短|メートル/);
});

test('Phase 7 UI removes meter labels and exposes remembered clue surfaces', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'reboot.html'), 'utf8');
  const section = html.match(/<section id="phase6-navigation"[\s\S]*?<\/section>/);

  assert.ok(section, 'directional exploration section should exist');
  assert.match(section[0], /PHASE 7 \/ READ THE LAND/);
  assert.match(section[0], /id="phase7-valley-clues"/);
  assert.match(section[0], /id="phase7-road-clues"/);
  assert.match(section[0], /id="phase7-field-note"/);
  assert.match(section[0], />北へ<|>東へ<|>南へ<|>西へ</);
  assert.doesNotMatch(section[0], /40m|\d+メートル/);
  assert.doesNotMatch(section[0], /data-place|塩の礼拝堂|朽ちた関門/);
  assert.match(html, /reboot-phase7\.css/);
  assert.match(html, /reboot-phase7-exploration\.js/);
});

test('field clue memory and previous samples remain session-only', () => {
  const modelSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase7-exploration.js'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase6-controller.js'), 'utf8');

  assert.doesNotMatch(modelSource, /localStorage|sessionStorage|routeHistory|watchPosition/i);
  assert.match(controller, /let previousSession = null/);
  assert.match(controller, /let clueMemory = fieldModel\.createClueMemory\(\)/);
  assert.doesNotMatch(controller, /localStorage\.setItem/);
  assert.match(controller, /getCurrentPosition/);
  assert.doesNotMatch(controller, /watchPosition/);
});

test('discovery contract remains Phase 6/4 compatible after collecting clues', () => {
  const session = moveMany(locationModel.createSession(), 'west', 4);
  assert.equal(locationModel.discoveredPlace(session), p4.RUINED_GATE);
});
