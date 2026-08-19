const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GeographyApi = require("../src/geography-api-provider.js");
const Presentation = require("../src/exploration-map-presentation.js");

const presentationSource = fs.readFileSync(path.join(__dirname, "../src/exploration-map-presentation.js"), "utf8");

test("representative geography coordinates accept nodes and way centers", () => {
  assert.deepEqual(GeographyApi.representativeCoordinate({ lat: 35.691, lon: 139.781 }), { latitude: 35.691, longitude: 139.781 });
  assert.deepEqual(GeographyApi.representativeCoordinate({ center: { lat: 35.688, lon: 139.784 } }), { latitude: 35.688, longitude: 139.784 });
  assert.equal(GeographyApi.representativeCoordinate({ tags: { leisure: "park" } }), null);
  assert.equal(GeographyApi.representativeCoordinate({ lat: 120, lon: 139 }), null);
});

test("discoveries retain the current position and representative place coordinates", () => {
  const origin = { latitude: 35.69, longitude: 139.78 };
  const discoveries = GeographyApi.decorateDiscoveriesWithMapData([
    { id: "river", realPlaceName: "中川", features: ["water", "crossing"] },
    { id: "park", realPlaceName: "立石児童遊園", features: ["woods"] },
    { id: "unnamed", realPlaceName: "", features: ["sacred"] }
  ], [
    { id: 1, lat: 35.692, lon: 139.78, tags: { waterway: "river", "name:ja": "中川" } },
    { id: 2, center: { lat: 35.689, lon: 139.783 }, tags: { leisure: "park", "name:ja": "立石児童遊園" } },
    { id: 3, lat: 35.687, lon: 139.779, tags: { amenity: "place_of_worship" } }
  ], origin);

  assert.deepEqual(discoveries[0].representativeCoordinate, { latitude: 35.692, longitude: 139.78 });
  assert.deepEqual(discoveries[1].representativeCoordinate, { latitude: 35.689, longitude: 139.783 });
  assert.deepEqual(discoveries[2].representativeCoordinate, { latitude: 35.687, longitude: 139.779 });
  assert.deepEqual(discoveries[0].mapOrigin, origin);
});

test("proxy discovery decorates rule results without making coordinates mandatory", async () => {
  const provider = GeographyApi.createProxyLocationDiscoveryProvider({
    endpoint: "https://crownless.test/api/geography",
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          endpoint: "https://overpass.test/api",
          attempts: [{ endpoint: "https://overpass.test/api", state: "success", httpStatus: 200 }],
          elements: [
            { id: 1, lat: 35.692, lon: 139.78, tags: { waterway: "river", "name:ja": "中川" } },
            { id: 2, tags: { bridge: "yes" } }
          ]
        };
      }
    })
  });

  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.equal(discoveries[0].realPlaceName, "中川");
  assert.deepEqual(discoveries[0].representativeCoordinate, { latitude: 35.692, longitude: 139.78 });
  assert.deepEqual(discoveries[0].mapOrigin, { latitude: 35.69, longitude: 139.78 });
});

test("relative projection preserves north and east direction around the current position", () => {
  const origin = { latitude: 35.69, longitude: 139.78 };
  const north = Presentation.projectDiscoveryPoint(origin, { latitude: 35.692, longitude: 139.78 });
  const east = Presentation.projectDiscoveryPoint(origin, { latitude: 35.69, longitude: 139.783 });

  assert.ok(north.y < 50);
  assert.ok(Math.abs(north.x - 50) < 0.01);
  assert.equal(Presentation.directionLabel(north), "北");
  assert.ok(east.x > 50);
  assert.ok(Math.abs(east.y - 50) < 0.01);
  assert.equal(Presentation.directionLabel(east), "東");
});

test("sketch map model is capped at three and survives unnamed real places", () => {
  const origin = { latitude: 35.69, longitude: 139.78 };
  const runtime = {
    state: "ready",
    discoveries: [
      { id: "a", realPlaceName: "中川", title: "中川の渡し場", features: ["water"], mapOrigin: origin, representativeCoordinate: { latitude: 35.692, longitude: 139.78 } },
      { id: "b", realPlaceName: "", baseTitle: "名もない聖域", title: "名もない聖域", features: ["sacred"], mapOrigin: origin, representativeCoordinate: { latitude: 35.689, longitude: 139.782 } },
      { id: "c", realPlaceName: "立石", title: "立石の路地", features: ["settlement"], mapOrigin: origin, representativeCoordinate: { latitude: 35.688, longitude: 139.779 } },
      { id: "d", realPlaceName: "遠方", title: "遠方", features: ["woods"], mapOrigin: origin, representativeCoordinate: { latitude: 35.695, longitude: 139.785 } }
    ]
  };

  const model = Presentation.sketchMapModelFromRuntime(runtime);
  assert.equal(model.length, 3);
  assert.equal(model[1].title, "名もない聖域");
  assert.notEqual(model[0].glyph, model[1].glyph);
  assert.notEqual(model[1].glyph, model[2].glyph);
  assert.deepEqual(Presentation.sketchMapModelFromRuntime({ state: "failed", discoveries: runtime.discoveries }), []);
});

test("exploration sketch remains a manuscript-relative view rather than a navigation map", () => {
  assert.match(presentationSource, /NEARBY MANUSCRIPT \/ RELATIVE DISCOVERY/);
  assert.match(presentationSource, /現在地中心 \/ 相対配置 \/ 縮尺なし/);
  assert.match(presentationSource, /sketch-map-point/);
  assert.match(presentationSource, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(presentationSource, /google\.maps|mapbox|leaflet/i);
});
