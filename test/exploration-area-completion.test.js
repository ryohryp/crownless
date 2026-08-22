const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Journal = require("../src/discovery-journal-browser.js");

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
  assert.equal(Core.explorationAreaGoal(area.id), Journal.areaGoal(area.id));
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

test("area summaries count unique discoveries and complete at the deterministic goal", () => {
  const areaId = "area:14:14550:6450";
  const goal = Journal.areaGoal(areaId);
  const discoveries = {};
  for (let index = 0; index < goal; index += 1) {
    discoveries[`sim:${index}`] = {
      key: `sim:${index}`,
      name: `発見 ${index + 1}`,
      areaId,
      firstDiscoveredAt: 100 + index,
      visits: index === 0 ? 8 : 1
    };
  }

  const model = Journal.areaSummaries({
    discoveries,
    exploredCells: {
      a: { id: "cell:16:58200:25800", firstExploredAt: 10 },
      b: { id: "cell:16:58201:25800", firstExploredAt: 11 }
    }
  });

  const area = model.find((entry) => entry.id === areaId);
  assert.ok(area);
  assert.equal(area.discoveries, goal);
  assert.equal(area.progress, goal);
  assert.equal(area.exploredCells, 2);
  assert.equal(area.complete, true);
  assert.equal(Journal.entriesForArea(Object.values(discoveries), areaId).length, goal);
});

test("coarse map exposes known, unknown, progress, and completed neighboring areas", () => {
  const areaId = "area:14:14550:6450";
  const goal = Journal.areaGoal(areaId);
  const discoveries = {};
  for (let index = 0; index < goal; index += 1) {
    discoveries[`geo:${index}`] = { key: `geo:${index}`, areaId, firstDiscoveredAt: 200 + index };
  }
  const worldKnowledge = {
    discoveries,
    exploredCells: {
      center: { id: "cell:16:58200:25800", firstExploredAt: 20 },
      east: { id: "cell:16:58204:25800", firstExploredAt: 21 }
    }
  };

  const window = Journal.areaWindowModel(worldKnowledge, areaId);
  assert.equal(window.length, 25);
  assert.ok(window.some((area) => area.id === areaId && area.complete));
  assert.ok(window.some((area) => area.known && !area.complete));
  assert.ok(window.some((area) => !area.known));
  assert.equal(Journal.defaultAreaId(worldKnowledge), areaId);
});

test("browser runtime and manuscript CSS expose the area completion interaction", () => {
  const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");
  const journalSource = fs.readFileSync(path.join(__dirname, "../src/discovery-journal-browser.js"), "utf8");
  const cssSource = fs.readFileSync(path.join(__dirname, "../discovery-journal-browser.css"), "utf8");

  assert.match(runtimeSource, /explorationAreaFromLocation/);
  assert.match(runtimeSource, /representativeCoordinate \|\| geographic\.mapOrigin/);
  assert.match(runtimeSource, /currentAreaId/);
  assert.match(journalSource, /KNOWN AREAS \/ COARSE MAP/);
  assert.match(journalSource, /COMPLETE/);
  assert.match(journalSource, /entriesForArea/);
  assert.match(journalSource, /正確な移動経路は保存しない/);
  assert.match(cssSource, /\.discovery-area-map\s*\{/);
  assert.match(cssSource, /\.discovery-area-cell\.complete/);
  assert.match(cssSource, /@media \(max-width:\s*700px\)/);
  assert.doesNotMatch(journalSource, /latitude|longitude|mapOrigin|representativeCoordinate/);
});
