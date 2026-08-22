const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

function fakeDocument() {
  const elements = new Map();

  function createElement() {
    return {
      id: "",
      className: "",
      innerHTML: "",
      textContent: "",
      style: {},
      dataset: {},
      classList: {
        add() {},
        remove() {},
        contains() { return false; }
      },
      setAttribute() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };
  }

  return {
    getElementById(id) { return elements.get(id) || null; },
    createElement,
    head: {
      appendChild(element) {
        if (element && element.id) elements.set(element.id, element);
      }
    },
    body: {
      appendChild(element) {
        if (element && element.id) elements.set(element.id, element);
      }
    }
  };
}

function loadLocationRuntime(search = "") {
  const document = fakeDocument();
  const Core = {
    discoverLocation(state) { return state; },
    saveWorldKnowledge() { return true; },
    loadSafeState() { return { worldKnowledge: { discoveries: {} } }; }
  };
  const window = {
    CrownlessCore: Core,
    CrownlessDiscovery: {},
    CrownlessGeographyApi: {},
    location: { search }
  };

  const context = {
    window,
    document,
    URLSearchParams,
    setTimeout() { return 1; },
    clearTimeout() {},
    console
  };

  vm.runInNewContext(runtimeSource, context, { filename: "location-discovery-runtime.js" });
  return window.CrownlessLocationDiscoveryRuntime;
}

function qaWatchtowerDiscovery(id) {
  const geographicDiscovery = {
    id: "qa-ruined-watchtower",
    title: "QA固定候補の崩れた物見台",
    baseTitle: "崩れた物見台",
    realPlaceName: "QA固定候補",
    contentKind: "dungeon",
    features: ["height"],
    sourceRef: "qa:ruined-watchtower",
    qaInjected: true
  };

  return {
    id,
    name: geographicDiscovery.title,
    eventKind: "dungeon",
    geographicDiscovery
  };
}

test("same Ruined Watchtower revisit updates one journal entry instead of unlocking twice", () => {
  const runtime = loadLocationRuntime("?qa=watchtower");
  const first = qaWatchtowerDiscovery("discovery-1");
  const state = {
    worldKnowledge: { discoveries: {} },
    expedition: {
      lastDiscovery: first,
      discoveries: [first]
    }
  };

  runtime.recordWorldKnowledge(state, 1000);

  const keysAfterFirstVisit = Object.keys(state.worldKnowledge.discoveries);
  assert.deepEqual(keysAfterFirstVisit, ["geo:qa:ruined-watchtower:dungeon:height"]);
  assert.equal(state.worldKnowledge.discoveries[keysAfterFirstVisit[0]].visits, 1);
  assert.equal(state.worldKnowledge.discoveries[keysAfterFirstVisit[0]].firstDiscoveredAt, 1000);
  assert.equal(state.expedition.lastDiscovery.isNewDiscovery, true);

  const revisit = qaWatchtowerDiscovery("discovery-2");
  state.expedition.lastDiscovery = revisit;
  state.expedition.discoveries.push(revisit);
  runtime.recordWorldKnowledge(state, 2000);

  const keysAfterRevisit = Object.keys(state.worldKnowledge.discoveries);
  assert.deepEqual(keysAfterRevisit, keysAfterFirstVisit);
  assert.equal(state.worldKnowledge.discoveries[keysAfterRevisit[0]].visits, 2);
  assert.equal(state.worldKnowledge.discoveries[keysAfterRevisit[0]].firstDiscoveredAt, 1000);
  assert.equal(state.expedition.lastDiscovery.isNewDiscovery, false);
});

test("watchtower QA injection is opt-in and remains explicitly synthetic", () => {
  const normalRuntime = loadLocationRuntime("");
  const normal = normalRuntime.ensureQaWatchtowerDiscoveries([{ baseTitle: "苔むした聖域" }]);
  assert.equal(normalRuntime.qaMode, "");
  assert.equal(normal.length, 1);
  assert.equal(normal[0].baseTitle, "苔むした聖域");
  assert.equal(normal.some((item) => item && item.qaInjected), false);

  const qaRuntime = loadLocationRuntime("?qa=watchtower");
  const qa = qaRuntime.ensureQaWatchtowerDiscoveries([{ baseTitle: "苔むした聖域" }]);
  assert.equal(qaRuntime.qaMode, "watchtower");
  assert.equal(qa[0].baseTitle, "崩れた物見台");
  assert.equal(qa[0].sourceRef, "qa:ruined-watchtower");
  assert.equal(qa[0].qaInjected, true);
  assert.deepEqual(Array.from(qa[0].features), ["height"]);
});

test("defeat keeps Ruined Watchtower knowledge while save sanitization drops visual and GPS metadata", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  let active = Core.beginExpedition(Core.createInitialState(), 9123);
  const key = "geo:qa:ruined-watchtower:dungeon:height";

  active.worldKnowledge.discoveries[key] = {
    key,
    name: "QA固定候補の崩れた物見台",
    baseTitle: "崩れた物見台",
    terrain: ["height"],
    contentKind: "dungeon",
    state: "discovered",
    firstDiscoveredAt: 1234,
    visits: 1,
    assetPath: "assets/locations/ruined-watchtower.png",
    assetUrl: "https://example.invalid/ruined-watchtower.png",
    imageBinary: "should-not-persist",
    representativeCoordinate: { latitude: 35.0, longitude: 139.0 },
    mapOrigin: { latitude: 35.0, longitude: 139.0 },
    latitude: 35.0,
    longitude: 139.0
  };

  assert.equal(Core.saveWorldKnowledge(active), true);
  active.expedition.unsecuredLoot.push({ id: "lost-after-watchtower", name: "Lost after watchtower" });
  Core.resolveDefeat(active);

  const loaded = Core.loadSafeState();
  const entry = loaded.worldKnowledge.discoveries[key];
  assert.ok(entry);
  assert.equal(entry.visits, 1);
  assert.equal(entry.firstDiscoveredAt, 1234);
  for (const forbidden of [
    "assetPath",
    "assetUrl",
    "imageBinary",
    "representativeCoordinate",
    "mapOrigin",
    "latitude",
    "longitude"
  ]) assert.equal(forbidden in entry, false, `${forbidden} must not persist`);

  const resolved = LocationVisuals.resolveLatestDiscoveredVisual(loaded.worldKnowledge);
  assert.equal(resolved.visual.assetPath, "assets/locations/ruined-watchtower.png");
  delete global.localStorage;
});

test("Ruined Watchtower visual remains fail closed until a matching discovery exists", () => {
  assert.equal(LocationVisuals.resolveLatestDiscoveredVisual({ discoveries: {} }), null);
  assert.equal(LocationVisuals.resolveLatestDiscoveredVisual({
    discoveries: {
      shrine: {
        key: "sim:shrine",
        name: "苔むした聖域",
        baseTitle: "苔むした聖域",
        terrain: ["woods", "sacred"],
        contentKind: "encounter",
        state: "discovered",
        firstDiscoveredAt: 1,
        visits: 1
      }
    }
  }), null);
});
