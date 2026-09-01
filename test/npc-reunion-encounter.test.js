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

const expeditionState = {
  destinations: [
    {
      id: "world:sim:north-road-ford",
      name: "北の街道の古い渡し場",
      discoveryKey: "sim:north-road-ford",
      geographic: true
    },
    {
      id: "world:sim:old-forest",
      name: "古い森",
      discoveryKey: "sim:old-forest",
      geographic: true
    },
    {
      id: "ashen-wood",
      name: "北の街道の古い渡し場",
      family: "forest"
    }
  ]
};

function expeditionTo(destinationId) {
  return { inputs: { destinationId } };
}

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
    message: "北の街道の古い渡し場で、旅の途中のマルコと再会した。"
  });
  assert.match(encounter.message, /北の街道の古い渡し場/);
  assert.match(encounter.message, /マルコ/);
  assert.match(encounter.message, /再会/);
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

test("expedition destination resolves reunion through authoritative discovery key", () => {
  const encounter = ReunionEncounter.encounterForExpedition(
    NpcLife.snapshotAt(11),
    knownDestinations,
    expeditionState,
    expeditionTo("world:sim:north-road-ford")
  );

  assert.ok(encounter);
  assert.equal(encounter.npcId, "marco");
  assert.equal(encounter.discoveryKey, "sim:north-road-ford");
  assert.equal(encounter.destinationName, "北の街道の古い渡し場");
});

test("expedition reunion still respects the NPC travel window", () => {
  const expedition = expeditionTo("world:sim:north-road-ford");
  assert.equal(
    ReunionEncounter.encounterForExpedition(NpcLife.snapshotAt(8), knownDestinations, expeditionState, expedition),
    null
  );
  assert.equal(
    ReunionEncounter.encounterForExpedition(NpcLife.snapshotAt(15), knownDestinations, expeditionState, expedition),
    null
  );
});

test("unknown and non-geographic expedition destinations do not forge a reunion", () => {
  const snapshot = NpcLife.snapshotAt(11);
  assert.equal(
    ReunionEncounter.encounterForExpedition(snapshot, knownDestinations, expeditionState, expeditionTo("world:sim:missing")),
    null
  );
  assert.equal(
    ReunionEncounter.encounterForExpedition(snapshot, knownDestinations, expeditionState, expeditionTo("ashen-wood")),
    null,
    "matching display names are not authoritative without discoveryKey"
  );
  assert.equal(
    ReunionEncounter.encounterForExpedition(snapshot, knownDestinations, expeditionState, { inputs: {} }),
    null
  );
});

test("expedition reunion result does not expose raw coordinates", () => {
  const encounter = ReunionEncounter.encounterForExpedition(
    NpcLife.snapshotAt(11),
    knownDestinations,
    expeditionState,
    expeditionTo("world:sim:north-road-ford")
  );
  assert.ok(encounter);
  assert.equal("latitude" in encounter, false);
  assert.equal("longitude" in encounter, false);
  assert.equal("coordinates" in encounter, false);
});
