const test = require("node:test");
const assert = require("node:assert/strict");

const NpcLife = require("../src/npc-life.js");
const ReunionEncounter = require("../src/npc-reunion-encounter.js");

const knownDestinations = {
  "sim:north-road-ford": {
    key: "sim:north-road-ford",
    name: "北の街道の古い渡し場",
    location: "north-road",
    state: "discovered"
  },
  "sim:old-forest": {
    key: "sim:old-forest",
    name: "古い森",
    location: "forest",
    state: "discovered"
  }
};

test("selected known destination resolves Marco as a reunion encounter while he is traveling", () => {
  const encounter = ReunionEncounter.encounterAtDiscovery(
    NpcLife.snapshotAt(11),
    knownDestinations,
    "sim:north-road-ford"
  );

  assert.deepEqual(encounter, {
    npcId: "marco",
    npcName: "マルコ",
    discoveryKey: "sim:north-road-ford",
    destinationName: "北の街道の古い渡し場",
    location: "north-road",
    locationLabel: "北の街道",
    state: "reunion",
    message: "北の街道の古い渡し場でマルコを見つけた。"
  });
});

test("reunion encounter disappears outside Marco's travel window", () => {
  assert.equal(
    ReunionEncounter.encounterAtDiscovery(NpcLife.snapshotAt(8), knownDestinations, "sim:north-road-ford"),
    null
  );
  assert.equal(
    ReunionEncounter.encounterAtDiscovery(NpcLife.snapshotAt(15), knownDestinations, "sim:north-road-ford"),
    null
  );
});

test("another or unknown discovery key does not produce a reunion", () => {
  const snapshot = NpcLife.snapshotAt(11);
  assert.equal(ReunionEncounter.encounterAtDiscovery(snapshot, knownDestinations, "sim:old-forest"), null);
  assert.equal(ReunionEncounter.encounterAtDiscovery(snapshot, knownDestinations, "sim:missing"), null);
  assert.equal(ReunionEncounter.encounterAtDiscovery(snapshot, knownDestinations, ""), null);
});

test("encounter model stays game-facing and never returns raw coordinates", () => {
  const encounter = ReunionEncounter.encounterAtDiscovery(
    NpcLife.snapshotAt(11),
    knownDestinations,
    "sim:north-road-ford"
  );
  assert.ok(encounter);
  assert.equal("latitude" in encounter, false);
  assert.equal("longitude" in encounter, false);
  assert.equal("coordinates" in encounter, false);
});
