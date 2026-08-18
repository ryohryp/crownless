const test = require("node:test");
const assert = require("node:assert/strict");
const Discovery = require("../src/discovery-provider.js");

test("normalizes OSM-like tags behind Crownless feature types", () => {
  const features = Discovery.normalizeGeographicFeatures([{ id: 1, tags: { natural: "water" } }, { id: 2, tags: { bridge: "yes" } }, { id: 3, tags: { amenity: "place_of_worship" } }, { id: 4, tags: { leisure: "park" } }, { id: 5, tags: { railway: "station" } }, { id: 6, tags: { natural: "peak" } }, { id: 7, tags: { natural: "coastline" } }, { id: 8, tags: { place: "neighbourhood" } }]);
  assert.deepEqual(features, ["water", "crossing", "sacred", "woods", "road_hub", "height", "coast", "settlement"]);
});

test("keeps Japanese OSM names alongside normalized feature types", () => {
  const context = Discovery.normalizeGeographicContext([{ id: 1, tags: { waterway: "river", name: "Nakagawa", "name:ja": "中川" } }, { id: 2, tags: { place: "neighbourhood", name: "Okudo", "name:ja": "奥戸" } }]);
  assert.equal(context.namesByType.water, "中川"); assert.equal(context.namesByType.settlement, "奥戸");
});

test("feature combinations create mysterious signals before names are revealed", () => {
  const discoveries = Discovery.discoveriesFromFeatures(["water", "sacred", "woods"], { limit: 3 });
  assert.equal(discoveries[0].title, "沈んだ祠"); assert.equal(discoveries[0].revealState, "signal"); assert.match(discoveries[0].signal, /石影/); assert.ok(discoveries.every((item) => item.signal !== item.title));
});

test("real place names become fantasy discovery names", () => {
  const discoveries = Discovery.discoveriesFromFeatures(["water", "crossing"], { limit: 1, namesByType: { water: "中川" } });
  assert.equal(discoveries[0].title, "中川の血濡れの渡し場"); assert.equal(discoveries[0].realPlaceName, "中川");
});

test("geographic discoveries prefer distinct real places before duplicate names", () => {
  const discoveries = Discovery.discoveriesFromFeatures(["water", "crossing", "sacred", "woods", "settlement"], {
    limit: 3,
    namesByType: {
      water: "中川",
      crossing: "中川",
      sacred: "東立石諏訪神社",
      woods: "立石児童遊園",
      settlement: "立石"
    }
  });

  assert.equal(discoveries.length, 3);
  assert.deepEqual(discoveries.map((item) => item.realPlaceName), ["中川", "立石児童遊園", "立石"]);
  assert.equal(discoveries[0].baseTitle, "血濡れの渡し場");
  assert.equal(discoveries.filter((item) => item.realPlaceName === "中川").length, 1);
});

test("geographic discoveries reuse duplicate places only when unique places cannot fill the limit", () => {
  const discoveries = Discovery.discoveriesFromFeatures(["water", "crossing", "sacred", "woods"], {
    limit: 3,
    namesByType: { water: "中川", crossing: "中川", sacred: "中川", woods: "中川" }
  });

  assert.equal(discoveries.length, 3);
  assert.ok(discoveries.every((item) => item.realPlaceName === "中川"));
  assert.equal(discoveries[0].baseTitle, "血濡れの渡し場");
});

test("unnamed geographic discoveries remain independent diversity candidates", () => {
  const discoveries = Discovery.discoveriesFromFeatures(["water", "crossing", "sacred", "woods"], { limit: 3 });
  assert.equal(discoveries.length, 3);
  assert.ok(discoveries.every((item) => item.realPlaceName === ""));
});

test("investigation progressively reveals identity and preserves entry metadata", () => {
  const hidden = Discovery.discoveriesFromFeatures(["height"], { limit: 1 })[0]; const revealed = Discovery.investigateDiscovery(hidden);
  assert.equal(hidden.revealState, "signal"); assert.equal(revealed.revealState, "identified"); assert.equal(revealed.title, "崩れた物見台"); assert.equal(revealed.contentKind, "dungeon");
});

test("location provider uses injected network boundary and carries OSM names", async () => {
  let request; const provider = Discovery.createLocationDiscoveryProvider({ limit: 2, endpoint: "https://example.test/api", fetch: async (url, options) => { request = { url, options }; return { ok: true, status: 200, async json() { return { elements: [{ id: 10, tags: { waterway: "river", "name:ja": "中川" } }, { id: 11, tags: { bridge: "yes" } }] }; } }; } });
  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.equal(provider.kind, "location"); assert.equal(discoveries[0].title, "中川の血濡れの渡し場"); assert.equal(provider.endpoint, "https://example.test/api"); assert.match(request.options.body, /around%3A500%2C35.69%2C139.78/);
});

test("location provider retries the next Overpass endpoint after a failure", async () => {
  const calls = []; const provider = Discovery.createLocationDiscoveryProvider({ endpoints: ["https://first.test/api", "https://second.test/api"], fetch: async (url) => { calls.push(url); if (url.includes("first")) return { ok: false, status: 503 }; return { ok: true, status: 200, async json() { return { elements: [{ id: 1, tags: { waterway: "river", "name:ja": "中川" } }] }; } }; } });
  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.deepEqual(calls, ["https://first.test/api", "https://second.test/api"]); assert.equal(provider.endpoint, "https://second.test/api"); assert.equal(discoveries[0].title, "中川の葦辺の巣穴");
});

test("location provider reports requesting, failed, and success states per endpoint", async () => {
  const statuses = [];
  const provider = Discovery.createLocationDiscoveryProvider({
    endpoints: ["https://first.test/api", "https://second.test/api"],
    onStatus: (status) => statuses.push(status),
    fetch: async (url) => {
      if (url.includes("first")) return { ok: false, status: 429 };
      return { ok: true, status: 200, async json() { return { elements: [{ id: 1, tags: { place: "neighbourhood", "name:ja": "奥戸" } }] }; } };
    }
  });
  await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.deepEqual(statuses.map((status) => [status.state, status.attempt]), [["requesting", 1], ["failed", 1], ["requesting", 2], ["success", 2]]);
  assert.equal(statuses[1].httpStatus, 429);
  assert.equal(statuses[3].endpoint, "https://second.test/api");
  assert.deepEqual(statuses[3].names, ["奥戸"]);
});

test("location provider times out a stuck endpoint and falls back", async () => {
  const statuses = [];
  const provider = Discovery.createLocationDiscoveryProvider({
    endpoints: ["https://stuck.test/api", "https://second.test/api"],
    timeoutMs: 10,
    onStatus: (status) => statuses.push(status),
    fetch: async (url) => {
      if (url.includes("stuck")) return new Promise(() => {});
      return { ok: true, status: 200, async json() { return { elements: [{ id: 1, tags: { waterway: "river" } }] }; } };
    }
  });
  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.equal(discoveries[0].title, "葦辺の巣穴");
  const timeoutStatus = statuses.find((status) => status.endpoint.includes("stuck") && status.state === "failed");
  assert.equal(timeoutStatus.timedOut, true);
  assert.match(timeoutStatus.error, /timeout/);
  assert.equal(provider.endpoint, "https://second.test/api");
});

test("simulated discovery remains available as deterministic fallback", () => {
  const provider = Discovery.createSimulatedDiscoveryProvider({ limit: 1 }); assert.deepEqual(provider.discover({ leads: [{ id: "old", title: "Old Mine", risk: 4 }] })[0].title, "Old Mine");
});
