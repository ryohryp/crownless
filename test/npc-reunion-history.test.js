const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");
const Encounter = require("../src/npc-reunion-encounter.js");
const Presentation = require("../src/world-atlas-reunion-presentation.js");

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

function freshCore(storage) {
  global.localStorage = storage;
  for (const path of [
    "../src/game-core.js",
    "../src/hunt-system.js",
    "../src/dungeon-system.js",
    "../src/progression-system.js",
    "../src/save-system.js"
  ]) {
    delete require.cache[require.resolve(path)];
  }
  const baseCore = require("../src/game-core.js");
  const installHunts = require("../src/hunt-system.js");
  const installDungeons = require("../src/dungeon-system.js");
  const installProgression = require("../src/progression-system.js");
  const installSave = require("../src/save-system.js");
  return installSave(installProgression(installDungeons(installHunts(baseCore))));
}

function rootFor(Core) {
  return {
    CrownlessCore: Core,
    CrownlessNpcLife: NpcLife,
    CrownlessNpcReunionEncounter: Encounter
  };
}

function seedNorthRoad(Core) {
  const state = Core.createInitialState();
  state.worldKnowledge.discoveries["sim:north-road-ford"] = {
    key: "sim:north-road-ford",
    name: "北の街道の古い渡し場",
    baseTitle: "北の街道の古い渡し場",
    terrain: ["road"],
    contentKind: "road",
    state: "discovered",
    firstDiscoveredAt: 1,
    visits: 1
  };
  assert.equal(Core.saveSafeState(state), true);
  return state.worldKnowledge.discoveries["sim:north-road-ford"];
}

test("first reunion is persisted through the existing version-1 safe save", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const entry = seedNorthRoad(Core);
  const root = rootFor(Core);
  const now = new Date(2026, 8, 1, 11, 0, 0);
  const encounter = Presentation.reunionForEntry(root, entry, now);

  assert.ok(encounter);
  const result = Presentation.recordReunion(root, encounter, now);
  assert.equal(result.added, true);
  assert.equal(result.persisted, true);

  const loaded = Core.loadSafeState();
  const key = Presentation.reunionRecordKey(encounter);
  assert.deepEqual(loaded.npcLife.reunions[key], {
    npcId: "marco",
    discoveryKey: "sim:north-road-ford",
    firstReunitedAt: now.getTime()
  });
  assert.equal(Core.SAVE_VERSION, 1);
  delete global.localStorage;
});

test("the same NPC and discovery are idempotent across redraws and reloads", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const entry = seedNorthRoad(Core);
  const root = rootFor(Core);
  const firstNow = new Date(2026, 8, 1, 11, 0, 0);
  const encounter = Presentation.reunionForEntry(root, entry, firstNow);

  assert.equal(Presentation.recordReunion(root, encounter, firstNow).added, true);
  assert.equal(Presentation.recordReunion(root, encounter, new Date(2026, 8, 1, 12, 0, 0)).added, false);

  const reloadedCore = freshCore(storage);
  const reloadedRoot = rootFor(reloadedCore);
  const record = Presentation.reunionRecord(reloadedRoot, encounter);
  assert.ok(record);
  assert.equal(record.firstReunitedAt, firstNow.getTime());
  assert.equal(Object.keys(reloadedCore.loadSafeState().npcLife.reunions).length, 1);
  delete global.localStorage;
});

test("reunion history stores identity and discovery only, not derived NPC position or coordinates", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const entry = seedNorthRoad(Core);
  const root = rootFor(Core);
  const now = new Date(2026, 8, 1, 11, 0, 0);
  const encounter = Presentation.reunionForEntry(root, entry, now);

  Presentation.recordReunion(root, encounter, now);
  const record = Presentation.reunionRecord(root, encounter);
  assert.deepEqual(Object.keys(record).sort(), ["discoveryKey", "firstReunitedAt", "npcId"]);
  for (const forbidden of ["location", "locationLabel", "state", "latitude", "longitude", "coordinates"]) {
    assert.equal(forbidden in record, false);
  }

  const outsideWindow = Presentation.reunionForEntry(root, entry, new Date(2026, 8, 1, 8, 0, 0));
  assert.equal(outsideWindow, null);
  assert.equal(Object.keys(Core.loadSafeState().npcLife.reunions).length, 1);
  delete global.localStorage;
});
