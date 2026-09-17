"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { PRESETS, simulateLocation, simulateJourney } = require("../src/location-simulation");

test("simulates revisit, first visit, and faraway region without raw GPS", () => {
  const journey = simulateJourney();
  assert.equal(journey.length, 3);
  assert.deepEqual(journey.map((entry) => entry.visit), ["revisit", "first", "first"]);
  assert.notEqual(journey[0].regionKey, journey[2].regionKey);
  for (const entry of journey) {
    assert.equal(entry.simulated, true);
    assert.equal("latitude" in entry, false);
    assert.equal("longitude" in entry, false);
    assert.equal("route" in entry, false);
    assert.equal("history" in entry, false);
  }
});

test("presets are deterministic and returned values cannot mutate the harness", () => {
  const first = simulateLocation("nearby");
  first.regionKey = "changed";
  assert.equal(simulateLocation("nearby").regionKey, PRESETS.nearby.regionKey);
});

test("rejects unknown simulation presets", () => {
  assert.throws(() => simulateLocation("ocean"), /Unknown simulated location/);
});
