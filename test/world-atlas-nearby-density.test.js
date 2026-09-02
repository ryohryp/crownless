const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Atlas = require("../src/world-atlas.js");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

function discovery(index) {
  return {
    title: `周辺候補${index + 1}`,
    baseTitle: `候補${index + 1}`,
    realPlaceName: `地点${index + 1}`,
    sourceRef: `way:${900 + index}`,
    contentKind: index % 3 === 0 ? "encounter" : index % 3 === 1 ? "event" : "dungeon",
    features: index % 2 === 0 ? ["water"] : ["road_hub"],
    mapOrigin: { latitude: 35.68, longitude: 139.77 },
    representativeCoordinate: {
      latitude: 35.68 + (index + 1) * 0.00025,
      longitude: 139.77 + ((index % 4) - 1.5) * 0.00035
    }
  };
}

test("nearby atlas can present six real-world discoveries without persisting raw coordinates", () => {
  const runtime = {
    state: "ready",
    discoveries: Array.from({ length: 8 }, (_, index) => discovery(index)),
    worldKnowledgeKey(item) { return `geo:${item.sourceRef}`; }
  };

  const model = Atlas.nearbyViewModel(runtime, { discoveries: {} });
  assert.equal(Atlas.NEARBY_LIMIT, 6);
  assert.equal(model.length, 6);
  assert.deepEqual(model.map((entry) => entry.name), [
    "周辺候補1", "周辺候補2", "周辺候補3", "周辺候補4", "周辺候補5", "周辺候補6"
  ]);
  assert.doesNotMatch(JSON.stringify(model), /latitude|longitude|35\.68|139\.77/);
});

test("location runtime requests enough geographic discoveries to feed the denser atlas", () => {
  assert.match(runtimeSource, /createProxyLocationDiscoveryProvider\(\{ limit: 6, radius: 650/);
  assert.match(runtimeSource, /return \[watchtower, \.\.\.source\]\.slice\(0, 6\)/);
});

test("known-only rescan copy keeps the surrounding world open-ended", () => {
  const copy = Atlas.scanResultText({ state: "ready", foundCount: 6, newCount: 0 }, false);
  assert.match(copy, /時間や世界の動き/);
  assert.doesNotMatch(copy, /すべて既知/);
});
