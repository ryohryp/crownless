const test = require("node:test");
const assert = require("node:assert/strict");
const Discovery = require("../src/discovery-provider.js");
const ProxyCore = require("../src/geography-proxy.js");
const GeographyApi = require("../src/geography-api-provider.js");

test("tower-like OSM features become height signals", () => {
  const dedicatedTower = Discovery.normalizeGeographicFeature({ id: 1, tags: { man_made: "tower", name: "旧監視塔" } });
  const viewpoint = Discovery.normalizeGeographicFeature({ id: 2, tags: { tourism: "viewpoint", name: "展望地点" } });
  const ordinary = Discovery.normalizeGeographicFeature({ id: 3, tags: { building: "office", name: "中央ビル" } });

  assert.ok(dedicatedTower.types.includes("height"));
  assert.ok(viewpoint.types.includes("height"));
  assert.equal(ordinary.types.includes("height"), false);
});

test("production query extends sparse height signals without scanning dense building names", () => {
  const query = ProxyCore.buildOverpassQuery(35.69, 139.78, 500);

  assert.match(query, /nw\(35\.685508,139\.77447,35\.694492,139\.78553\)\[waterway\]/);
  assert.match(query, /nw\(35\.682814,139\.771152,35\.697186,139\.788848\)\[tourism=viewpoint\]/);
  assert.match(query, /nw\(35\.682814,139\.771152,35\.697186,139\.788848\)\[man_made~/);
  assert.doesNotMatch(query, /\[building\]\[name~/);
  assert.doesNotMatch(query, /\[building\]\["name:ja"~/);
});

test("viewpoint survives competing real-world signals into the top three watchtower discoveries", async () => {
  const provider = GeographyApi.createProxyLocationDiscoveryProvider({
    endpoint: "https://crownless.test/api/geography",
    limit: 3,
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          endpoint: "https://overpass.test/api",
          total: 1,
          attempts: [{ endpoint: "https://overpass.test/api", state: "success", httpStatus: 200 }],
          elements: [
            { type: "way", id: 10, center: { lat: 35.69, lon: 139.78 }, tags: { waterway: "river", "name:ja": "日本橋川" } },
            { type: "way", id: 11, center: { lat: 35.6901, lon: 139.7801 }, tags: { bridge: "yes", "name:ja": "日本橋" } },
            { type: "way", id: 12, center: { lat: 35.6902, lon: 139.7802 }, tags: { leisure: "park", "name:ja": "花の広場" } },
            { type: "node", id: 13, lat: 35.6903, lon: 139.7803, tags: { amenity: "place_of_worship", "name:ja": "福徳神社" } },
            { type: "node", id: 14, lat: 35.6904, lon: 139.7804, tags: { railway: "station", "name:ja": "三越前" } },
            { type: "node", id: 15, lat: 35.6905, lon: 139.7805, tags: { place: "neighbourhood", "name:ja": "日本橋室町" } },
            { type: "node", id: 16, lat: 35.696, lon: 139.786, tags: { tourism: "viewpoint", name: "遠見の展望地点" } }
          ]
        };
      }
    })
  });

  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.equal(discoveries.length, 3);
  const watchtower = discoveries.find((item) => item.baseTitle === "崩れた物見台");
  assert.ok(watchtower);
  assert.equal(watchtower.realPlaceName, "遠見の展望地点");
  assert.equal(watchtower.contentKind, "dungeon");
  assert.equal(watchtower.sourceRef, "node:16");
  assert.deepEqual(watchtower.features, ["height"]);
});

test("height diversity keeps a viewpoint in the top three when unnamed water creates distinct competitors", async () => {
  const provider = GeographyApi.createProxyLocationDiscoveryProvider({
    endpoint: "https://crownless.test/api/geography",
    limit: 3,
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          endpoint: "https://overpass.test/api",
          total: 1,
          attempts: [{ endpoint: "https://overpass.test/api", state: "success", httpStatus: 200 }],
          elements: [
            { type: "way", id: 20, center: { lat: 35.69, lon: 139.78 }, tags: { waterway: "river" } },
            { type: "way", id: 21, center: { lat: 35.6901, lon: 139.7801 }, tags: { bridge: "yes", "name:ja": "白銀橋" } },
            { type: "way", id: 22, center: { lat: 35.6902, lon: 139.7802 }, tags: { leisure: "park", "name:ja": "常盤公園" } },
            { type: "node", id: 23, lat: 35.6903, lon: 139.7803, tags: { amenity: "place_of_worship", "name:ja": "稲荷社" } },
            { type: "node", id: 24, lat: 35.696, lon: 139.786, tags: { tourism: "viewpoint", "name:ja": "物見丘展望所" } }
          ]
        };
      }
    })
  });

  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.deepEqual(discoveries.map((item) => item.baseTitle), ["沈んだ祠", "血濡れの渡し場", "崩れた物見台"]);
  const watchtower = discoveries[2];
  assert.equal(watchtower.realPlaceName, "物見丘展望所");
  assert.equal(watchtower.contentKind, "dungeon");
  assert.equal(watchtower.sourceRef, "node:24");
  assert.deepEqual(watchtower.features, ["height"]);
});

test("height diversity leaves no-height ranking and limits below three unchanged", () => {
  const namesByType = {
    crossing: "白銀橋",
    sacred: "稲荷社",
    woods: "常盤公園",
    height: "物見丘展望所"
  };

  const withoutHeight = Discovery.discoveriesFromFeatures(["water", "crossing", "sacred", "woods"], { limit: 3, namesByType });
  assert.deepEqual(withoutHeight.map((item) => item.baseTitle), ["沈んだ祠", "血濡れの渡し場", "苔むした聖域"]);

  const shortList = Discovery.discoveriesFromFeatures(["water", "crossing", "sacred", "woods", "height"], { limit: 2, namesByType });
  assert.deepEqual(shortList.map((item) => item.baseTitle), ["沈んだ祠", "血濡れの渡し場"]);
});
