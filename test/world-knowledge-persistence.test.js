const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const GeographyApi = require("../src/geography-api-provider.js");
const LocationVisuals = require("../src/location-visuals.js");
const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

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

test("fresh and legacy safe saves normalize world knowledge without a version reset", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  Core.createInitialState();

  const payload = JSON.parse(storage.getItem(Core.SAVE_KEY));
  assert.equal(payload.version, 1);
  assert.deepEqual(payload.state.worldKnowledge, { discoveries: {} });

  delete payload.state.worldKnowledge;
  storage.setItem(Core.SAVE_KEY, JSON.stringify(payload));
  const loaded = Core.createInitialState();
  assert.deepEqual(loaded.worldKnowledge, { discoveries: {} });
  delete global.localStorage;
});

test("world knowledge can be secured mid-expedition without securing expedition progress", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const safe = Core.createInitialState();
  safe.progression.renown = 6;
  Core.getHearthProgression(safe);
  Core.saveSafeState(safe);

  const active = Core.beginExpedition(safe, 2121);
  active.progression.renown = 99;
  active.expedition.unsecuredLoot.push({ id: "unsafe-loot", name: "Must stay unsafe" });
  active.worldKnowledge.discoveries["geo:way:42:encounter:crossing+water"] = {
    key: "geo:way:42:encounter:crossing+water",
    name: "中川の血濡れの渡し場",
    baseTitle: "血濡れの渡し場",
    terrain: ["water", "crossing"],
    contentKind: "encounter",
    state: "discovered",
    firstDiscoveredAt: 123456,
    visits: 1,
    representativeCoordinate: { latitude: 35.69, longitude: 139.78 },
    mapOrigin: { latitude: 35.68, longitude: 139.77 },
    latitude: 35.69,
    longitude: 139.78
  };

  assert.equal(Core.saveWorldKnowledge(active), true);
  const loaded = Core.createInitialState();
  assert.equal(loaded.phase, "hub");
  assert.equal(loaded.expedition, null);
  assert.equal(loaded.progression.renown, 6);
  assert.equal(loaded.securedLoot.some((item) => item.id === "unsafe-loot"), false);

  const entry = loaded.worldKnowledge.discoveries["geo:way:42:encounter:crossing+water"];
  assert.equal(entry.name, "中川の血濡れの渡し場");
  assert.deepEqual(entry.terrain, ["water", "crossing"]);
  assert.equal("representativeCoordinate" in entry, false);
  assert.equal("mapOrigin" in entry, false);
  assert.equal("latitude" in entry, false);
  assert.equal("longitude" in entry, false);
  delete global.localStorage;
});

test("knowledge secured before defeat survives the defeat snapshot", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  let active = Core.beginExpedition(Core.createInitialState(), 2122);
  active.worldKnowledge.discoveries["sim:ruined-chapel"] = {
    key: "sim:ruined-chapel",
    name: "崩れた礼拝堂",
    terrain: [],
    contentKind: "combat",
    state: "discovered",
    firstDiscoveredAt: 222,
    visits: 1
  };
  Core.saveWorldKnowledge(active);
  active.expedition.unsecuredLoot.push({ id: "lost", name: "Lost" });
  active = Core.resolveDefeat(active);

  const loaded = Core.createInitialState();
  assert.ok(loaded.worldKnowledge.discoveries["sim:ruined-chapel"]);
  assert.equal(loaded.worldKnowledge.discoveries["sim:ruined-chapel"].visits, 1);
  delete global.localStorage;
});

test("Ruined Watchtower visual remains available after return and defeat snapshots", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  let active = Core.beginExpedition(Core.createInitialState(), 2123);
  active.worldKnowledge.discoveries["geo:node:123:height"] = {
    key: "geo:node:123:height",
    name: "丘の崩れた物見台",
    baseTitle: "崩れた物見台",
    terrain: ["height"],
    contentKind: "dungeon",
    state: "discovered",
    firstDiscoveredAt: 223,
    visits: 1
  };

  assert.equal(Core.saveWorldKnowledge(active), true);
  let loaded = Core.createInitialState();
  assert.equal(LocationVisuals.resolveLatestDiscoveredVisual(loaded.worldKnowledge).visual.id, "ruined-watchtower");

  active = Core.beginExpedition(loaded, 2124);
  active.expedition.unsecuredLoot.push({ id: "lost-after-discovery", name: "Lost after discovery" });
  active = Core.resolveDefeat(active);
  loaded = Core.createInitialState();
  const resolved = LocationVisuals.resolveLatestDiscoveredVisual(loaded.worldKnowledge);
  assert.equal(resolved.visual.assetPath, "assets/locations/ruined-watchtower.png");
  assert.equal(loaded.worldKnowledge.discoveries["geo:node:123:height"].visits, 1);
  delete global.localStorage;
});

test("OSM source identity distinguishes node way and relation ids", () => {
  assert.equal(GeographyApi.sourceFeatureRef({ type: "node", id: 77 }), "node:77");
  assert.equal(GeographyApi.sourceFeatureRef({ type: "way", id: 77 }), "way:77");
  assert.equal(GeographyApi.sourceFeatureRef({ type: "relation", id: 77 }), "relation:77");
  assert.notEqual(GeographyApi.sourceFeatureRef({ type: "node", id: 77 }), GeographyApi.sourceFeatureRef({ type: "way", id: 77 }));
});

test("geographic map decoration carries stable source identity separately from coordinates", () => {
  const discoveries = GeographyApi.decorateDiscoveriesWithMapData([
    { title: "中川の渡し場", realPlaceName: "中川", features: ["water", "crossing"], contentKind: "encounter" }
  ], [
    { type: "way", id: 901, center: { lat: 35.69, lon: 139.78 }, tags: { waterway: "river", bridge: "yes", "name:ja": "中川" } }
  ], { latitude: 35.68, longitude: 139.77 });

  assert.equal(discoveries[0].sourceRef, "way:901");
  assert.deepEqual(discoveries[0].representativeCoordinate, { latitude: 35.69, longitude: 139.78 });
});

test("runtime records stable geographic and simulated discovery keys and marks revisits", () => {
  assert.match(runtimeSource, /return `geo:\$\{sourceRef\}:\$\{geographicRuleSignature\(geographic\)\}`/);
  assert.match(runtimeSource, /return locationId \? `sim:\$\{locationId\}` : null/);
  assert.match(runtimeSource, /Core\.saveWorldKnowledge\(next\)/);
  assert.match(runtimeSource, /previous[\s\S]*visits: Math\.max\(1, Number\(previous\.visits\) \|\| 1\) \+ 1/);
  assert.match(runtimeSource, /lead-knowledge-badge/);
  assert.match(runtimeSource, /NEW DISCOVERY \/ 探索録/);
  assert.doesNotMatch(runtimeSource, /firstDiscoveredAt:[^\n]*latitude|worldKnowledgeEntry[\s\S]{0,900}representativeCoordinate/);
});
