const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NpcLife = require("../src/npc-life.js");
const Encounter = require("../src/npc-reunion-encounter.js");
const Presentation = require("../src/world-atlas-reunion-presentation.js");

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

function rootWithKnowledge() {
  return {
    CrownlessCore: {
      loadSafeState() {
        return { worldKnowledge: { discoveries: knownDestinations } };
      }
    },
    CrownlessNpcLife: NpcLife,
    CrownlessNpcReunionEncounter: Encounter
  };
}

test("selected reunion destination projects Marco into the Atlas detail model", () => {
  const reunion = Presentation.reunionForEntry(
    rootWithKnowledge(),
    knownDestinations["sim:north-road-ford"],
    new Date(2026, 8, 1, 11, 0, 0)
  );

  assert.ok(reunion);
  assert.equal(reunion.npcId, "marco");
  assert.equal(reunion.npcName, "マルコ");
  assert.equal(reunion.discoveryKey, "sim:north-road-ford");
  assert.equal(reunion.message, "北の街道の古い渡し場でマルコを見つけた。");
});

test("another destination and travel-window boundaries do not show a reunion", () => {
  const root = rootWithKnowledge();
  assert.equal(Presentation.reunionForEntry(root, knownDestinations["sim:old-forest"], new Date(2026, 8, 1, 11)), null);
  assert.equal(Presentation.reunionForEntry(root, knownDestinations["sim:north-road-ford"], new Date(2026, 8, 1, 8)), null);
  assert.equal(Presentation.reunionForEntry(root, knownDestinations["sim:north-road-ford"], new Date(2026, 8, 1, 15)), null);
});

test("Atlas reunion presentation reuses encounter domain and never introduces coordinate fields", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/world-atlas-reunion-presentation.js"), "utf8");
  const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/app-runtime-state.js"), "utf8");
  const reunion = Presentation.reunionForEntry(rootWithKnowledge(), knownDestinations["sim:north-road-ford"], new Date(2026, 8, 1, 11));

  assert.match(source, /CrownlessNpcReunionEncounter/);
  assert.match(source, /encounterAtDiscovery/);
  assert.doesNotMatch(source, /saveWorldKnowledge|geolocation|getCurrentPosition/);
  assert.equal("latitude" in reunion, false);
  assert.equal("longitude" in reunion, false);
  assert.equal("coordinates" in reunion, false);
  assert.match(runtimeSource, /src\/npc-life\.js/);
  assert.match(runtimeSource, /src\/npc-reunion-encounter\.js/);
  assert.match(runtimeSource, /src\/world-atlas-reunion-presentation\.js/);
});
