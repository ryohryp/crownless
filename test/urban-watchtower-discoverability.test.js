const test = require("node:test");
const assert = require("node:assert/strict");
const Discovery = require("../src/discovery-provider.js");
const ProxyCore = require("../src/geography-proxy.js");
const GeographyApi = require("../src/geography-api-provider.js");

test("named urban tower buildings become height signals", () => {
  const japanese = Discovery.normalizeGeographicFeature({
    id: 187748880,
    tags: { building: "yes", name: "日本橋三井タワー" }
  });
  const english = Discovery.normalizeGeographicFeature({
    id: 2,
    tags: { building: "office", name: "Riverside Tower" }
  });
  const ordinary = Discovery.normalizeGeographicFeature({
    id: 3,
    tags: { building: "office", name: "中央ビル" }
  });

  assert.ok(japanese.types.includes("height"));
  assert.ok(english.types.includes("height"));
  assert.equal(ordinary.types.includes("height"), false);
});

test("server and direct Overpass queries request named tower buildings selectively", () => {
  const serverQuery = ProxyCore.buildOverpassQuery(35.69, 139.78, 650);
  const directQuery = Discovery.buildOverpassQuery(35.69, 139.78, 650);

  assert.match(serverQuery, /\[building\]\[name~"\(タワー\|塔\|tower\)",i\]/);
  assert.match(serverQuery, /\[building\]\["name:ja"~"\(タワー\|塔\)"\]/);
  assert.match(directQuery, /\[building\]\[name~"\(タワー\|塔\|tower\)",i\]/);
  assert.match(directQuery, /\[building\]\["name:ja"~"\(タワー\|塔\)"\]/);
});

test("named urban tower survives competing real-world signals into the top three discoveries", async () => {
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
            { type: "way", id: 187748880, center: { lat: 35.6906, lon: 139.7806 }, tags: { building: "yes", name: "日本橋三井タワー" } }
          ]
        };
      }
    })
  });

  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.equal(discoveries.length, 3);
  const watchtower = discoveries.find((item) => item.baseTitle === "崩れた物見台");
  assert.ok(watchtower);
  assert.equal(watchtower.realPlaceName, "日本橋三井タワー");
  assert.equal(watchtower.contentKind, "dungeon");
  assert.equal(watchtower.sourceRef, "way:187748880");
  assert.deepEqual(watchtower.features, ["height"]);
});
