const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");
const ReunionEncounter = require("../src/npc-reunion-encounter.js");
const ReunionPresentation = require("../src/world-atlas-reunion-presentation.js");
const ExpeditionSystem = require("../src/expedition-system.js");

const EXPEDITION_STORAGE_KEY = "crownless.expedition-poc.v1";

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

function rootFor(Core, storage) {
  return {
    CrownlessCore: Core,
    CrownlessNpcLife: NpcLife,
    CrownlessNpcReunionEncounter: ReunionEncounter,
    CrownlessExpeditionSystem: ExpeditionSystem,
    localStorage: storage
  };
}

function reunionRecords(Core) {
  const safe = Core.loadSafeState();
  return safe && safe.npcLife && safe.npcLife.reunions && typeof safe.npcLife.reunions === "object"
    ? safe.npcLife.reunions
    : {};
}

test("Mira rumor leads through a north-road expedition to one persisted Marco reunion", () => {
  const storage = memoryStorage();
  const Core = freshCore(storage);
  const completedAt = new Date(2026, 8, 1, 11, 0, 0).getTime();
  const discoveryKey = "sim:north-road-ford";
  const destinationId = `world:${discoveryKey}`;

  const safe = Core.createInitialState();
  safe.worldKnowledge.discoveries[discoveryKey] = {
    key: discoveryKey,
    name: "北の街道の古い渡し場",
    baseTitle: "北の街道の古い渡し場",
    location: "north-road",
    terrain: ["road"],
    contentKind: "road",
    state: "discovered",
    firstDiscoveredAt: 1,
    visits: 1
  };
  assert.equal(Core.saveSafeState(safe), true);

  const snapshot = NpcLife.snapshotAt(new Date(completedAt));
  const rumor = NpcLife.relationshipLines(snapshot);
  const leads = NpcLife.explorationLeads(snapshot);
  const candidates = NpcLife.reunionCandidates(snapshot, safe.worldKnowledge.discoveries);

  assert.equal(rumor.length, 1);
  assert.equal(rumor[0].speakerId, "mira");
  assert.equal(rumor[0].targetId, "marco");
  assert.equal(leads.length, 1);
  assert.equal(leads[0].location, "north-road");
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].discoveryKey, discoveryKey);

  const expeditionState = ExpeditionSystem.initialState();
  expeditionState.destinations.push({
    id: destinationId,
    name: "北の街道の古い渡し場",
    family: "road",
    dangerTags: [],
    opportunityTags: ["rumor"],
    durationMs: 0,
    geographic: true,
    discoveryKey
  });
  expeditionState.completedReports.unshift({
    expeditionId: "exp-marco-reunion",
    destinationId,
    completedAt
  });
  storage.setItem(EXPEDITION_STORAGE_KEY, JSON.stringify(expeditionState));

  const root = rootFor(Core, storage);
  const atlasEncounter = ReunionPresentation.reunionForEntry(
    root,
    safe.worldKnowledge.discoveries[discoveryKey],
    new Date(completedAt)
  );
  assert.ok(atlasEncounter, "Atlas may expose a reunion candidate without mutating history");
  assert.equal(Object.keys(reunionRecords(Core)).length, 0);

  const first = ReunionPresentation.syncLatestExpeditionReunion(root);
  assert.ok(first);
  assert.equal(first.latest, true);
  assert.equal(first.encounter.npcId, "marco");
  assert.equal(first.encounter.discoveryKey, discoveryKey);
  assert.equal(first.record.firstReunitedAt, completedAt);
  assert.equal("latitude" in first.encounter, false);
  assert.equal("longitude" in first.encounter, false);

  const afterFirstSync = reunionRecords(Core);
  assert.deepEqual(afterFirstSync[`marco|${discoveryKey}`], {
    npcId: "marco",
    discoveryKey,
    firstReunitedAt: completedAt
  });
  assert.equal(Object.keys(afterFirstSync).length, 1);

  const second = ReunionPresentation.syncLatestExpeditionReunion(root);
  assert.ok(second);
  assert.equal(second.record.firstReunitedAt, completedAt);
  assert.equal(Object.keys(reunionRecords(Core)).length, 1);

  const reloadedCore = freshCore(storage);
  const reloadedRoot = rootFor(reloadedCore, storage);
  const afterReload = ReunionPresentation.syncLatestExpeditionReunion(reloadedRoot);
  assert.ok(afterReload);
  assert.equal(afterReload.record.firstReunitedAt, completedAt);
  assert.equal(Object.keys(reunionRecords(reloadedCore)).length, 1);

  delete global.localStorage;
});
