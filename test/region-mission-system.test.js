const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const installHunts = require('../src/hunt-system.js');
const installSave = require('../src/save-system.js');
const installRegionMissions = require('../src/region-mission-system.js');
let Core = require('../src/game-core.js');
Core = installHunts(Core);
Core = installSave(Core);
Core = installRegionMissions(Core);

function activeState(seed = 173) {
  return Core.beginExpedition(Core.createInitialState(), seed);
}

function simulatedRoadDiscovery() {
  return {
    id: 'dead-kings-road-test',
    locationId: 'dead-kings-road',
    name: '死王の旧街道',
    palette: 'road',
    eventKind: 'cache'
  };
}

test('simulated road fallback deterministically advances one stable regional mission', () => {
  const state = activeState();
  const first = Core.recordRegionMissionClue(state, simulatedRoadDiscovery(), 1000);
  const second = Core.recordRegionMissionClue(state, simulatedRoadDiscovery(), 2000);
  const duplicate = Core.recordRegionMissionClue(state, simulatedRoadDiscovery(), 3000);

  assert.equal(first.changed, true);
  assert.equal(first.mission.clues, 1);
  assert.equal(second.changed, true);
  assert.equal(second.mission.clues, 2);
  assert.equal(second.mission.finalPoiDiscovered, true);
  assert.equal(duplicate.changed, false);

  const board = Core.getRegionMissionBoard(state);
  assert.equal(board.length, 1);
  assert.equal(board[0].key, 'region-mission:missing-pack-train:sim:dead-kings-road');
  assert.equal(board[0].stage, 'investigated');
  assert.equal(board[0].clues, 2);
});

test('geographic road tags use only the coarse exploration area for mission identity', () => {
  const state = activeState(174);
  state.worldKnowledge = {
    discoveries: {
      'geo:way/123:encounter:road_hub': {
        key: 'geo:way/123:encounter:road_hub',
        name: '黒土の辻',
        baseTitle: '黒土の辻',
        terrain: ['road_hub'],
        contentKind: 'encounter',
        state: 'discovered',
        firstDiscoveredAt: 1000,
        visits: 1,
        areaId: 'area:14:14555:6451'
      }
    }
  };
  const discovery = {
    id: 'geo-road-test',
    locationId: 'watchfire-hill',
    discoveryKey: 'geo:way/123:encounter:road_hub',
    geographicDiscovery: {
      features: ['road_hub'],
      palette: 'road',
      sourceRef: 'way/123',
      representativeCoordinate: { latitude: 35.0, longitude: 139.0 }
    }
  };

  Core.recordRegionMissionClue(state, discovery, 2000);
  const board = Core.getRegionMissionBoard(state);

  assert.equal(board.length, 1);
  assert.equal(board[0].regionKey, 'area:14:14555:6451');
  assert.equal(board[0].areaId, 'area:14:14555:6451');
  assert.doesNotMatch(JSON.stringify(state.worldKnowledge.discoveries[board[0].key]), /latitude|longitude|representativeCoordinate|mapOrigin/);
});

test('two clues reveal a bandit camp that launches existing combat and only completes after safe return', () => {
  let state = activeState(175);
  Core.recordRegionMissionClue(state, simulatedRoadDiscovery(), 1000);
  Core.recordRegionMissionClue(state, simulatedRoadDiscovery(), 2000);

  const choices = Core.generateExplorationChoices(state);
  const target = choices.find((choice) => choice.regionMissionFinal);
  assert.ok(target);
  assert.equal(target.name, '街道荒らしの野営地');
  assert.equal(target.eventKind, 'region-mission');

  state = Core.discoverLocation(state, target.choiceId);
  assert.equal(state.phase, 'combat');
  assert.equal(state.expedition.encounter.kind, 'region-mission');
  assert.ok(state.expedition.encounter.enemies.length > 0);

  const lootBefore = state.expedition.unsecuredLoot.length;
  state = Core.resolveVictory(state, 80);
  assert.equal(state.phase, 'decision');
  assert.ok(state.expedition.unsecuredLoot.length > lootBefore);
  assert.equal(Core.getRegionMissionBoard(state)[0].completed, false);

  const unsecuredIds = state.expedition.unsecuredLoot.map((item) => item.id);
  state = Core.returnHome(state);
  assert.equal(state.phase, 'hub');
  assert.ok(unsecuredIds.every((id) => state.securedLoot.some((item) => item.id === id)));

  const mission = Core.getRegionMissionBoard(state)[0];
  assert.equal(mission.completed, true);
  assert.equal(mission.knowledge, 'この街道には組織的な襲撃者がいる');
  assert.equal(mission.nextRumorUnlocked, true);

  const journal = Object.values(state.worldKnowledge.discoveries);
  assert.ok(journal.some((entry) => entry.name === 'この街道には組織的な襲撃者がいる' && entry.state === 'cleared'));
  assert.ok(journal.some((entry) => entry.contentKind === 'rumor' && /灰牙/.test(entry.name)));
  assert.ok(journal.some((entry) => entry.name === '街道荒らしの野営地' && entry.state === 'cleared'));
});

test('unrelated simulated discoveries do not start the road mission', () => {
  const state = activeState(176);
  const result = Core.recordRegionMissionClue(state, {
    id: 'ruined-chapel',
    locationId: 'ruined-chapel',
    palette: 'chapel'
  }, 1000);
  assert.equal(result.changed, false);
  assert.deepEqual(Core.getRegionMissionBoard(state), []);
});

test('regional mission script is loaded after geographic enrichment and before app state creation', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const geography = html.indexOf('src/location-discovery-runtime.js');
  const missions = html.indexOf('src/region-mission-system.js');
  const app = html.indexOf('src/app.js');

  assert.ok(geography >= 0 && missions > geography && app > missions);
  execFileSync(process.execPath, ['--check', path.join(root, 'src', 'region-mission-system.js')]);
});
