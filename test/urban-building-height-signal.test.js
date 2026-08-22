const test = require("node:test");
const assert = require("node:assert/strict");
const Discovery = require("../src/discovery-provider.js");
const ProxyCore = require("../src/geography-proxy.js");
const GeographyApi = require("../src/geography-api-provider.js");

test("genuinely tall buildings become height signals without treating ordinary buildings as landmarks", () => {
  const byHeight = Discovery.normalizeGeographicFeature({
    id: 1,
    tags: { building: "apartments", height: "150", name: "駅前高層棟" }
  });
  const byLevels = Discovery.normalizeGeographicFeature({
    id: 2,
    tags: { building: "apartments", "building:levels": "45", name: "高層住宅" }
  });
  const lowHeight = Discovery.normalizeGeographicFeature({
    id: 3,
    tags: { building: "office", height: "29", name: "中央ビル" }
  });
  const lowLevels = Discovery.normalizeGeographicFeature({
    id: 4,
    tags: { building: "apartments", "building:levels": "9", name: "集合住宅" }
  });

  assert.ok(byHeight.types.includes("height"));
  assert.ok(byLevels.types.includes("height"));
  assert.equal(lowHeight.types.includes("height"), false);
  assert.equal(lowLevels.types.includes("height"), false);
});

test("production height query includes structural building metadata but not dense building-name scans", () => {
  const query = ProxyCore.buildOverpassQuery(35.69, 139.78, 500);

  assert.match(query, /nw\(35\.682814,139\.771152,35\.697186,139\.788848\)\[building\]\[height\]/);
  assert.match(query, /nw\(35\.682814,139\.771152,35\.697186,139\.788848\)\[building\]\["building:levels"~"\^\(\[1-9\]\[0-9\]\+\)\$"\]/);
  assert.doesNotMatch(query, /\[building\]\[name~/);
  assert.doesNotMatch(query, /\[building\]\["name:ja"~/);
});

test("direct Overpass query requests structural tall-building metadata without name matching", () => {
  const query = Discovery.buildOverpassQuery(35.69, 139.78, 500);

  assert.match(query, /\[building\]\[height\]/);
  assert.match(query, /\[building\]\["building:levels"~"\^\(\[1-9\]\[0-9\]\+\)\$"\]/);
  assert.doesNotMatch(query, /\[building\]\[name~/);
  assert.doesNotMatch(query, /\[building\]\["name:ja"~/);
});

test("a real high-rise building can naturally produce 崩れた物見台 through the proxy path", async () => {
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
            { type: "way", id: 10, center: { lat: 35.69, lon: 139.78 }, tags: { waterway: "river", "name:ja": "川" } },
            { type: "way", id: 11, center: { lat: 35.6901, lon: 139.7801 }, tags: { bridge: "yes", "name:ja": "橋" } },
            { type: "way", id: 12, center: { lat: 35.6902, lon: 139.7802 }, tags: { amenity: "place_of_worship", "name:ja": "神社" } },
            { type: "way", id: 99, center: { lat: 35.696, lon: 139.786 }, tags: { building: "apartments", height: "150", "building:levels": "45", "name:ja": "駅前高層棟" } }
          ]
        };
      }
    })
  });

  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  const watchtower = discoveries.find((item) => item.baseTitle === "崩れた物見台");
  assert.ok(watchtower);
  assert.equal(watchtower.realPlaceName, "駅前高層棟");
  assert.equal(watchtower.contentKind, "dungeon");
  assert.equal(watchtower.sourceRef, "way:99");
  assert.deepEqual(watchtower.features, ["height"]);
});
