const test = require("node:test");
const assert = require("node:assert/strict");
const geography = require("../api/geography.js");

test("production geography uses current global Overpass fallbacks", () => {
  assert.deepEqual(geography.PRODUCTION_OVERPASS_ENDPOINTS, [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.maprva.org/api/interpreter",
    "https://ethiopia.overpass.openplaceguide.org/api/interpreter"
  ]);
});

test("production geography caps dense-area discovery radius at 500m", () => {
  assert.equal(geography.PRODUCTION_MAX_RADIUS_METRES, 500);
  assert.equal(geography.productionRadius(undefined), 500);
  assert.equal(geography.productionRadius("650"), 500);
  assert.equal(geography.productionRadius(5000), 500);
  assert.equal(geography.productionRadius(350), 350);
  assert.equal(geography.productionRadius(10), 100);
});
