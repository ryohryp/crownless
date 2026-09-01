const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const runtimeSource = fs.readFileSync(path.join(__dirname, "../src/location-discovery-runtime.js"), "utf8");

function loadRuntime(sequence) {
  const outcomes = sequence.slice();
  let calls = 0;
  let tick = 0;
  const core = {
    discoverLocation(state) { return state; },
    generateExplorationChoices() { return []; },
    explorationAreaFromLocation() { return { id: "area:test" }; }
  };
  const context = {
    window: {
      CrownlessCore: core,
      CrownlessDiscovery: {},
      CrownlessGeographyApi: {},
      location: { search: "" }
    },
    navigator: {
      geolocation: {
        getCurrentPosition(success, failure) {
          calls += 1;
          const outcome = outcomes.shift();
          if (!outcome) throw new Error("unexpected geolocation call");
          if (outcome.type === "success") {
            success({ coords: { latitude: outcome.latitude, longitude: outcome.longitude } });
            return;
          }
          failure({ code: outcome.code, message: outcome.message || "geolocation failed" });
        }
      }
    },
    document: { getElementById() { return null; } },
    performance: { now() { tick += 5; return tick; } },
    URLSearchParams,
    URL,
    Promise
  };
  vm.createContext(context);
  vm.runInContext(runtimeSource, context);
  return {
    runtime: context.window.CrownlessLocationDiscoveryRuntime,
    calls: () => calls
  };
}

test("geolocation success completes without retry", async () => {
  const harness = loadRuntime([{ type: "success", latitude: 35.7, longitude: 139.8 }]);
  const location = await harness.runtime.getCurrentLocation();

  assert.equal(harness.calls(), 1);
  assert.equal(location.latitude, 35.7);
  assert.equal(location.longitude, 139.8);
  assert.equal(harness.runtime.diagnostics.gps, "ok");
  assert.equal(harness.runtime.diagnostics.gpsAttempt, 1);
  assert.equal(harness.runtime.diagnostics.gpsRetrying, false);
});

test("permission denial fails immediately without retry", async () => {
  const harness = loadRuntime([{ type: "error", code: 1, message: "denied" }]);

  await assert.rejects(harness.runtime.getCurrentLocation(), (error) => error.code === 1);
  assert.equal(harness.calls(), 1);
  assert.equal(harness.runtime.diagnostics.gps, "denied");
  assert.equal(harness.runtime.diagnostics.gpsAttempt, 1);
  assert.equal(harness.runtime.diagnostics.gpsRetrying, false);
  assert.equal(harness.runtime.diagnostics.gpsLastFailure.name, "PERMISSION_DENIED");
});

test("timeout retries once and preserves the first failure diagnostics when retry succeeds", async () => {
  const harness = loadRuntime([
    { type: "error", code: 3, message: "first timeout" },
    { type: "success", latitude: 35.71, longitude: 139.81 }
  ]);

  const location = await harness.runtime.getCurrentLocation();
  const diagnostics = harness.runtime.diagnostics;

  assert.equal(harness.calls(), 2);
  assert.equal(location.latitude, 35.71);
  assert.equal(location.longitude, 139.81);
  assert.equal(diagnostics.gps, "ok");
  assert.equal(diagnostics.gpsAttempt, 2);
  assert.equal(diagnostics.gpsTotal, 2);
  assert.equal(diagnostics.gpsRetrying, false);
  assert.equal(diagnostics.gpsLastFailure.attempt, 1);
  assert.equal(diagnostics.gpsLastFailure.name, "TIMEOUT");
  assert.equal(diagnostics.gpsLastFailure.message, "first timeout");
});

test("timeout retries at most once before falling back", async () => {
  const harness = loadRuntime([
    { type: "error", code: 3, message: "first timeout" },
    { type: "error", code: 3, message: "second timeout" }
  ]);

  await assert.rejects(harness.runtime.getCurrentLocation(), (error) => error.code === 3);
  const diagnostics = harness.runtime.diagnostics;

  assert.equal(harness.calls(), 2);
  assert.equal(diagnostics.gps, "timeout");
  assert.equal(diagnostics.gpsAttempt, 2);
  assert.equal(diagnostics.gpsRetrying, false);
  assert.equal(diagnostics.gpsLastFailure.attempt, 2);
  assert.equal(diagnostics.gpsLastFailure.name, "TIMEOUT");
  assert.equal(diagnostics.gpsLastFailure.message, "second timeout");
});

test("position unavailable is transient but permission denial is not", () => {
  const harness = loadRuntime([{ type: "success", latitude: 0, longitude: 0 }]);

  assert.equal(harness.runtime.shouldRetryGeolocation({ code: 2 }, 1), true);
  assert.equal(harness.runtime.shouldRetryGeolocation({ code: 3 }, 1), true);
  assert.equal(harness.runtime.shouldRetryGeolocation({ code: 1 }, 1), false);
  assert.equal(harness.runtime.shouldRetryGeolocation({ code: 2 }, 2), false);
});
