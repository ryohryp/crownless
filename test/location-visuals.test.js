const test = require("node:test");
const assert = require("node:assert/strict");
const LocationVisuals = require("../src/location-visuals.js");

test("崩れた物見台 resolves to the Ruined Watchtower static asset", () => {
  const entry = {
    name: "近所の丘の崩れた物見台",
    baseTitle: "崩れた物見台",
    contentKind: "dungeon",
    firstDiscoveredAt: 100,
    visits: 1
  };

  assert.deepEqual(LocationVisuals.resolveLocationVisual(entry), {
    id: "ruined-watchtower",
    assetPath: "assets/locations/ruined-watchtower.png",
    alt: "崩れた石造りの物見台"
  });
  assert.equal(entry.assetPath, undefined);
});

test("unmapped discoveries do not unlock a location visual", () => {
  assert.equal(LocationVisuals.resolveLocationVisual({ baseTitle: "森の野営地" }), null);
  assert.equal(LocationVisuals.resolveLocationVisual(null), null);
});

test("latest mapped discovery visual is resolved from world knowledge without persisting asset metadata", () => {
  const worldKnowledge = {
    discoveries: {
      oldTower: {
        baseTitle: "崩れた物見台",
        name: "古い物見台",
        firstDiscoveredAt: 10,
        visits: 2
      },
      newerUnmapped: {
        baseTitle: "苔むした聖域",
        name: "新しい聖域",
        firstDiscoveredAt: 30,
        visits: 1
      },
      newestTower: {
        baseTitle: "崩れた物見台",
        name: "新しい物見台",
        firstDiscoveredAt: 20,
        visits: 1
      }
    }
  };

  const resolved = LocationVisuals.resolveLatestDiscoveredVisual(worldKnowledge);
  assert.equal(resolved.entry.name, "新しい物見台");
  assert.equal(resolved.visual.id, "ruined-watchtower");
  assert.equal(worldKnowledge.discoveries.newestTower.assetPath, undefined);
});
