const test = require("node:test");
const assert = require("node:assert/strict");
const ProxyCore = require("../src/geography-proxy.js");
const GeographyApi = require("../src/geography-api-provider.js");

test("server geography query fetches tower and viewpoint signals", () => {
  const query = ProxyCore.buildOverpassQuery(35.69, 139.78, 650);
  assert.match(query, /\[man_made~"\^\(tower\|communications_tower\)\$"\]/);
  assert.match(query, /\[tourism=viewpoint\]/);
  assert.match(query, /\[historic=tower\]/);
});

test("GitHub Pages geography path can translate an urban tower into Ruined Watchtower", async () => {
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
          elements: [{
            type: "node",
            id: 101,
            lat: 35.69,
            lon: 139.78,
            tags: { man_made: "tower", "name:ja": "街の見晴らし塔" }
          }]
        };
      }
    })
  });

  const discoveries = await provider.discover({ location: { latitude: 35.69, longitude: 139.78 } });
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].baseTitle, "崩れた物見台");
  assert.equal(discoveries[0].title, "街の見晴らし塔の崩れた物見台");
  assert.equal(discoveries[0].contentKind, "dungeon");
  assert.deepEqual(discoveries[0].features, ["height"]);
  assert.equal(discoveries[0].sourceRef, "node:101");
});