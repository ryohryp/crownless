const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const installHunts = require('../src/hunt-system.js');
const installSave = require('../src/save-system.js');
const installRegionMissions = require('../src/region-mission-system.js');
const installStationaryGate = require('../src/region-mission-stationary-gate.js');
let Core = require('../src/game-core.js');
Core = installHunts(Core);
Core = installSave(Core);
Core = installRegionMissions(Core);
Core = installStationaryGate(Core);

function simulatedRoadDiscovery() {
  return {
    id: 'dead-kings-road-test',
    locationId: 'dead-kings-road',
    name: '死王の旧街道',
    palette: 'road',
    eventKind: 'cache'
  };
}

test('revealed final POI stays out of normal outdoor choices until armed from Grey Hearth', () => {
  let state = Core.beginExpedition(Core.createInitialState(), 17301);
  Core.recordRegionMissionClue(state, simulatedRoadDiscovery(), 1000);
  Core.recordRegionMissionClue(state, simulatedRoadDiscovery(), 2000);

  const mission = Core.getRegionMissionBoard(state)[0];
  assert.equal(mission.stage, 'investigated');
  assert.equal(Core.generateExplorationChoices(state).some((choice) => choice.regionMissionFinal), false);

  assert.equal(Core.armRegionMissionAssault(mission.key), true);
  assert.equal(Core.isRegionMissionAssaultArmed(mission.key), true);
  const choices = Core.generateExplorationChoices(state);
  const target = choices.find((choice) => choice.regionMissionFinal);
  assert.ok(target);
  assert.equal(target.name, '街道荒らしの野営地');

  state = Core.discoverLocation(state, target.choiceId);
  assert.equal(state.phase, 'combat');
  assert.equal(state.expedition.encounter.regionMissionKey, mission.key);
  assert.equal(Core.isRegionMissionAssaultArmed(), false);
});

test('stationary gate and Grey Hearth presentation load in the required order', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const regionSystem = html.indexOf('src/region-mission-system.js');
  const stationaryGate = html.indexOf('src/region-mission-stationary-gate.js');
  const app = html.indexOf('src/app.js');
  const hearth = html.indexOf('src/region-mission-hearth-presentation.js');

  assert.ok(regionSystem >= 0 && stationaryGate > regionSystem);
  assert.ok(app > stationaryGate);
  assert.ok(hearth > app);
});

test('Grey Hearth presentation launches the armed target through existing app controls', () => {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'src', 'region-mission-hearth-presentation.js'), 'utf8');

  assert.match(source, /armRegionMissionAssault/);
  assert.match(source, /startExpedition\.click\(\)/);
  assert.match(source, /target\.click\(\)/);
  assert.match(source, /危険な攻略は灰炉から/);
});

test('stationary regional mission scripts are valid JavaScript', () => {
  const root = path.join(__dirname, '..');
  execFileSync(process.execPath, ['--check', path.join(root, 'src', 'region-mission-stationary-gate.js')]);
  execFileSync(process.execPath, ['--check', path.join(root, 'src', 'region-mission-hearth-presentation.js')]);
});
