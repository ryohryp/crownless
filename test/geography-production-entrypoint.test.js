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

test("production geography converts all-upstream failure into an explicit simulated fallback", () => {
  const payload = geography.productionFallbackPayload({
    error: "Geographic upstreams could not be loaded",
    attempts: [
      { endpoint: "https://first.test", state: "failed", failureKind: "timeout" },
      { endpoint: "https://second.test", state: "failed", failureKind: "http", httpStatus: 503 }
    ],
    total: 2,
    timeoutMs: 15000
  });

  assert.equal(geography.PRODUCTION_FALLBACK, "simulated");
  assert.equal(payload.degraded, true);
  assert.equal(payload.fallback, "simulated");
  assert.equal(payload.endpoint, null);
  assert.deepEqual(payload.elements, []);
  assert.equal(payload.attempts.length, 2);
  assert.equal(payload.error, "Geographic upstreams could not be loaded");
});

test("production response maps only upstream 502 failures to HTTP 200 fallback", () => {
  const writes = [];
  const response = {
    status(code) {
      writes.push(["status", code]);
      return this;
    },
    json(payload) {
      writes.push(["json", payload]);
      return payload;
    },
    setHeader() {},
    end() {}
  };

  geography.createProductionResponse(response)
    .status(502)
    .json({ error: "upstream failed", attempts: [{ endpoint: "x", state: "failed" }], total: 1 });

  assert.equal(writes[0][1], 200);
  assert.equal(writes[1][1].degraded, true);
  assert.equal(writes[1][1].fallback, "simulated");
  assert.deepEqual(writes[1][1].elements, []);

  writes.length = 0;
  geography.createProductionResponse(response)
    .status(400)
    .json({ error: "Invalid latitude", attempts: [] });

  assert.equal(writes[0][1], 400);
  assert.equal(writes[1][1].degraded, undefined);
});
