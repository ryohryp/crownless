const test = require("node:test");
const assert = require("node:assert/strict");
const Discovery = require("../src/discovery-provider.js");

test("normalizes OSM-like tags behind Crownless feature types", () => {
  const features = Discovery.normalizeGeographicFeatures([
    { id: 1, tags: { natural: "water" } }, { id: 2, tags: { bridge: "yes" } }, { id: 3, tags: { amenity: "place_of_worship" } }, { id: 4, tags: { leisure: "park" } }, { id: 5, tags: { railway: "station" } }, { id: 6, tags: { natural: "peak" } }, { id: 7, tags: { natural: "coastline" } }, { id: 8, tags: { place: "neighbourhood" } }
  ]);
  assert.deepEqual(features, ["water", "crossing", "sacred", "woods", "road_hub", "height", "coast", "settlement"]);
});

test("keeps Japanese OSM names alongside normalized feature types", () => {
  const context = Discovery.normalizeGeographicContext([
    { id: 1, tags: { waterway: "river", name: "Nakagawa", "name:ja": "中川" } },
    { id: 2, tags: { place: "neighbourhood", name: "Okudo", "name:ja": "奥戸" } }
  ]);
  assert.equal(context.namesByType.water, "中川");
  assert.equal(context.namesByType.settlement, "奥戸");
});

test("feature combinations create mysterious signals before names are revealed", () => {
  const discoveries = Discovery.discoveriesFromFeatures(["water", "sacred", "woods"], { limit: 3 });
  assert.equal(discoveries[0].title, "沈んだ祠"); assert.equal(discoveries[0].revealState, "signal"); assert.match(discoveries[0].signal, /石影/); assert.ok(discoveries.every((item) => item.signal !== item.title));
});

test("real place names become fantasy discovery names", () => {
  const discoveries = Discovery.discoveriesFromFeatures(["water", "crossing"], { limit: 1, namesByType: { water: "中川" } });
  assert.equal(discoveries[0].title, "中川の血濡れの渡し場");
  assert.equal(discoveries[0].realPlaceName, "中川");
});

test("investigation progressively reveals identity and preserves entry metadata", () => {
  const hidden = Discovery.discoveriesFromFeatures(["height"], { limit: 1 })[0]; const revealed = Discovery.investigateDiscovery(hidden);
  assert.equal(hidden.revealState, "signal"); assert.equal(revealed.revealState, "identified"); assert.equal(revealed.title, "崩れた物見台"); assert.equal(revealed.contentKind, "dungeon");
});

test("location provider uses injected network boundary and carries OSM names", async () => {
  let request; const provider = Discovery.createLocationDiscoveryProvider({ limit: 2, fetch: async (url, options) => { request = { url, options }; return { ok: true, async json() { return { elements: [{ id: 10, tags: { waterway: "river", "name:ja": "中川" } }, { id: 11, tags: { bridge: "yes" } }] }; } }; } });
  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.equal(provider.kind, "location"); assert.equal(discoveries[0].title, "中川の血濡れの渡し場"); assert.match(request.options.body, /around%3A500%2C35.69%2C139.78/);
});

test("simulated discovery remains available as deterministic fallback", () => {
  const provider = Discovery.createSimulatedDiscoveryProvider({ limit: 1 }); assert.deepEqual(provider.discover({ leads: [{ id: "old", title: "Old Mine", risk: 4 }] })[0].title, "Old Mine");
});
