const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  for (const modulePath of [
    "../src/game-core.js",
    "../src/hunt-system.js",
    "../src/dungeon-system.js",
    "../src/progression-system.js",
    "../src/save-system.js"
  ]) delete require.cache[require.resolve(modulePath)];

  const baseCore = require("../src/game-core.js");
  const installHunts = require("../src/hunt-system.js");
  const installDungeons = require("../src/dungeon-system.js");
  const installProgression = require("../src/progression-system.js");
  const installSave = require("../src/save-system.js");
  return installSave(installProgression(installDungeons(installHunts(baseCore))));
}

test("z16 exploration cells roll up into stable z14 completion areas", () => {
  const Core = freshCore(memoryStorage());
  const location = { latitude: 35.69, longitude: 139.78 };
  const cell = Core.explorationCellFromLocation(location);
  const area = Core.explorationAreaFromLocation(location);
  const rolledUp = Core.explorationAreaFromCell(cell.id);

  assert.equal(area.zoom, 14);
  assert.match(area.id, /^area:14:\d+:\d+$/);
  assert.deepEqual(rolledUp, area);
  assert.deepEqual(Core.parseExplorationAreaId(area.id), area);
  assert.ok(Core.explorationAreaGoal(area.id) >= 5 && Core.explorationAreaGoal(area.id) <= 7);
  delete global.localStorage;
});

test("coarse discovery area persists while raw position fields remain stripped", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const safe = Core.createInitialState();
  const area = Core.explorationAreaFromLocation({ latitude: 35.69, longitude: 139.78 });
  const active = Core.beginExpedition(safe, 1570);

  active.worldKnowledge.discoveries["geo:way:157:event:woods"] = {
    key: "geo:way:157:event:woods",
    name: "森の祠",
    terrain: ["woods", "sacred"],
    contentKind: "event",
    state: "discovered",
    firstDiscoveredAt: 1570,
    visits: 1,
    areaId: area.id,
    latitude: 35.69,
    longitude: 139.78,
    mapOrigin: { latitude: 35.69, longitude: 139.78 },
    representativeCoordinate: { latitude: 35.691, longitude: 139.781 }
  };
  active.worldKnowledge.discoveries["sim:bad-area"] = {
    key: "sim:bad-area",
    name: "壊れた区画記録",
    terrain: [],
    contentKind: "event",
    state: "discovered",
    firstDiscoveredAt: 1571,
    visits: 1,
    areaId: "35.69,139.78"
  };

  assert.equal(Core.saveWorldKnowledge(active), true);
  const loaded = Core.createInitialState();
  assert.equal(loaded.worldKnowledge.discoveries["geo:way:157:event:woods"].areaId, area.id);
  assert.equal("areaId" in loaded.worldKnowledge.discoveries["sim:bad-area"], false);
  assert.doesNotMatch(JSON.stringify(loaded.worldKnowledge), /latitude|longitude|mapOrigin|representativeCoordinate/);
  delete global.localStorage;
});

test("browser runtime exposes area completion integration", () => {
  const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
  assert.match(runtimeSource, /explorationAreaFromLocation/);
  assert.match(runtimeSource, /representativeCoordinate \|\| geographic\.mapOrigin/);
  assert.match(runtimeSource, /currentAreaId/);
});
