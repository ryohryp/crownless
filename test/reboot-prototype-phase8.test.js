const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../src/reboot-prototype-state.js');
require('../src/reboot-phase2-state.js');
const p3 = require('../src/reboot-phase3-state.js');
const p4 = require('../src/reboot-phase4-state.js');
const locationModel = require('../src/reboot-phase6-location.js');
const fieldModel = require('../src/reboot-phase7-exploration.js');

function moveMany(session, direction, count) {
  let next = session;
  for (let index = 0; index < count; index += 1) next = locationModel.moveSession(next, direction);
  return next;
}

test('every one of the eight directions produces a world response after one simulated move', () => {
  for (const direction of fieldModel.FIELD_SECTORS) {
    const session = locationModel.moveSession(locationModel.createSession(), direction);
    const observation = fieldModel.observeFieldThreads(session, fieldModel.createThreadMemory(), {});

    assert.ok(observation.response, `${direction} should produce a response`);
    assert.equal(observation.response.sector, direction);
    assert.equal(observation.response.stage, 'faint');
    assert.ok(observation.response.text.length > 0);
  }
});

test('continuing in any direction turns the response into an encounter', () => {
  for (const direction of fieldModel.FIELD_SECTORS) {
    const session = moveMany(locationModel.createSession(), direction, 3);
    const observation = fieldModel.observeFieldThreads(session, fieldModel.createThreadMemory(), {});

    assert.equal(observation.response.sector, direction);
    assert.equal(observation.response.stage, 'encounter');
    assert.match(observation.note, /出来事|世界/);
  }
});

test('the eight sectors are authored as distinct threads rather than one generic random event', () => {
  const titles = fieldModel.FIELD_SECTORS.map((sector) => fieldModel.threadDefinition(sector, {}).title);
  assert.ok(new Set(titles).size >= 8);
});

test('backtracking keeps clues from a direction for the rest of the exploration session', () => {
  const origin = locationModel.createSession();
  const north = locationModel.moveSession(origin, 'north');
  const first = fieldModel.observeFieldThreads(north, fieldModel.createThreadMemory(), {});
  const back = locationModel.moveSession(north, 'south');
  const second = fieldModel.observeFieldThreads(back, first.memory, {});

  assert.equal(second.response, null);
  assert.ok(second.entries.some((entry) => entry.sector === 'north'));
  assert.ok(second.memory.north.clues.length > 0);
});

test('the previous hill choice changes what the player finds in the valley and road directions', () => {
  const chapelWorld = { choices: { [p3.BLACK_RAVEN_HILL]: p3.CHOICES.SIGNAL_CHAPEL } };
  const gateWorld = { choices: { [p3.BLACK_RAVEN_HILL]: p3.CHOICES.SIGNAL_GATE } };

  assert.equal(fieldModel.threadDefinition('south_west', chapelWorld).title, '警告を受けた谷');
  assert.equal(fieldModel.threadDefinition('south_west', gateWorld).title, '合図の届かなかった谷');
  assert.equal(fieldModel.threadDefinition('west', chapelWorld).title, '無警戒の街道');
  assert.equal(fieldModel.threadDefinition('west', gateWorld).title, '備えられた街道');
});

test('existing irreversible Phase 4 destinations are still discovered through movement', () => {
  const road = moveMany(locationModel.createSession(), 'west', 4);
  const valley = moveMany(locationModel.createSession(), 'south_west', 3);

  assert.equal(locationModel.discoveredPlace(road), p4.RUINED_GATE);
  assert.equal(locationModel.discoveredPlace(valley), p4.SALT_CHAPEL);
});

test('Phase 8 exploration memory and direction history remain transient', () => {
  const modelSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase7-exploration.js'), 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase6-controller.js'), 'utf8');

  assert.doesNotMatch(modelSource, /localStorage|sessionStorage|routeHistory|watchPosition/i);
  assert.doesNotMatch(controller, /localStorage\.setItem|sessionStorage|routeHistory|watchPosition/i);
  assert.match(controller, /getCurrentPosition/);
  assert.match(controller, /let threadMemory = fieldModel\.createThreadMemory\(\)/);
});

test('Phase 8 runtime adds diagonal exploration and a world-response surface without distance UI', () => {
  const controller = fs.readFileSync(path.join(__dirname, '..', 'src', 'reboot-phase6-controller.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'reboot-phase7.css'), 'utf8');

  assert.match(controller, /PHASE 8 \/ WALK INTO THE UNKNOWN/);
  assert.match(controller, /id="phase8-response"/);
  assert.match(controller, /north_west/);
  assert.match(controller, /north_east/);
  assert.match(controller, /south_west/);
  assert.match(controller, /south_east/);
  assert.doesNotMatch(controller, /40m|メートル|到達ゲージ/);
  assert.match(css, /north_west north north_east/);
  assert.match(css, /south_west south south_east/);
});
