const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const CellRuntime = require("../src/exploration-cell-runtime.js");

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

test("GPS is quantized to a coarse zoom-16 exploration cell", () => {
  const Core = freshCore(memoryStorage());
  const location = { latitude: 35.69, longitude: 139.78 };
  const cell = Core.explorationCellFromLocation(location);

  assert.ok(cell);
  assert.equal(cell.zoom, 16);
  assert.match(cell.id, /^cell:16:\d+:\d+$/);
  assert.deepEqual(Core.parseExplorationCellId(cell.id), cell);
  assert.equal(Core.explorationCellFromLocation({ latitude: 120, longitude: 139.78 }), null);
  delete global.localStorage;
});

test("new cells persist once while revisits do not grow explored territory", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const safe = Core.createInitialState();
  const firstLocation = { latitude: 35.69, longitude: 139.78 };

  const first = Core.recordExploredCell(safe, firstLocation, 1000);
  const revisit = Core.recordExploredCell(safe, firstLocation, 2000);
  const moved = Core.recordExploredCell(safe, { latitude: 35.69, longitude: 139.80 }, 3000);

  assert.equal(first.added, true);
  assert.equal(revisit.added, false);
  assert.equal(revisit.count, 1);
  assert.equal(moved.added, true);
  assert.equal(moved.count, 2);

  const loaded = Core.createInitialState();
  assert.equal(Object.keys(loaded.worldKnowledge.exploredCells).length, 2);
  assert.equal(loaded.worldKnowledge.exploredCells[first.cell.id].firstExploredAt, 1000);
  delete global.localStorage;
});

test("coarse cells survive stale safe and POI knowledge writes without storing raw GPS", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const staleSafe = Core.createInitialState();
  const recorded = Core.recordExploredCell(Core.loadSafeState(), { latitude: 35.69, longitude: 139.78 }, 1234);
  assert.equal(recorded.added, true);

  staleSafe.progression.renown = 7;
  assert.equal(Core.saveSafeState(staleSafe), true);
  let loaded = Core.createInitialState();
  assert.ok(loaded.worldKnowledge.exploredCells[recorded.cell.id]);

  const active = Core.beginExpedition(staleSafe, 1530);
  active.worldKnowledge.discoveries["sim:ruined-chapel"] = {
    key: "sim:ruined-chapel",
    name: "崩れた礼拝堂",
    terrain: [],
    contentKind: "combat",
    state: "discovered",
    firstDiscoveredAt: 1500,
    visits: 1
  };
  assert.equal(Core.saveWorldKnowledge(active), true);

  loaded = Core.createInitialState();
  assert.ok(loaded.worldKnowledge.discoveries["sim:ruined-chapel"]);
  assert.ok(loaded.worldKnowledge.exploredCells[recorded.cell.id]);
  const serializedKnowledge = JSON.stringify(loaded.worldKnowledge);
  assert.doesNotMatch(serializedKnowledge, /latitude|longitude|mapOrigin|representativeCoordinate/);
  delete global.localStorage;
});

test("cell window exposes a visible known/unknown frontier around the current cell", () => {
  const current = { id: "cell:16:500:700" };
  const known = ["cell:16:500:700", "cell:16:501:700", "cell:16:500:699"];
  const model = CellRuntime.cellWindowModel(current, known);

  assert.equal(model.length, 25);
  assert.equal(model.filter((cell) => cell.current).length, 1);
  assert.equal(model.find((cell) => cell.current).known, true);
  assert.equal(model.filter((cell) => cell.known).length, 3);
  assert.ok(model.some((cell) => !cell.known));
  assert.ok(model.every((cell) => cell.left >= 8 && cell.top >= 8));
});

test("browser entrypoint keeps fallback independent and renders manuscript territory cells", () => {
  const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/exploration-cell-runtime.js"), "utf8");
  const indexSource = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

  assert.match(runtimeSource, /exploration-cell-tile\.known/);
  assert.match(runtimeSource, /exploration-cell-tile\.unknown/);
  assert.match(runtimeSource, /KNOWN TERRITORY/);
  assert.match(runtimeSource, /getCurrentPosition/);
  assert.doesNotMatch(runtimeSource, /Overpass|GeographyApi|google\.maps|mapbox|leaflet/i);
  assert.match(indexSource, /exploration-map-presentation\.js[\s\S]*exploration-cell-runtime\.js/);
});
