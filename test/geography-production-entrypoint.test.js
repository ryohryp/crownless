const test = require("node:test");
const assert = require("node:assert/strict");
const geography = require("../api/geography.js");

test("production geography uses global-coverage Overpass fallbacks", () => {
  assert.deepEqual(geography.PRODUCTION_OVERPASS_ENDPOINTS, [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  ]);
  assert.equal(geography.PRODUCTION_OVERPASS_ENDPOINTS.some((endpoint) => endpoint.includes("maprva.org")), false);
  assert.equal(geography.PRODUCTION_OVERPASS_ENDPOINTS.some((endpoint) => endpoint.includes("ethiopia.overpass")), false);
});

test("production geography caps dense-area discovery radius at 500m", () => {
  assert.equal(geography.PRODUCTION_MAX_RADIUS_METRES, 500);
  assert.equal(geography.productionRadius(undefined), 500);
  assert.equal(geography.productionRadius("650"), 500);
  assert.equal(geography.productionRadius(5000), 500);
  assert.equal(geography.productionRadius(350), 350);
  assert.equal(geography.productionRadius(10), 100);
});
