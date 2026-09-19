"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateLocation } = require("../src/location-simulation");
const { discoverMovementTrace } = require("../src/movement-discovery-pulse");

test("moving to a different coarse region reveals one actionable trace", () => {
  const home = simulateLocation("home");
  const nearby = simulateLocation("nearby");
  const result = discoverMovementTrace(home.regionKey, nearby);
  assert.ok(result.trace);
  assert.equal(result.trace.regionLabel, nearby.label);
  assert.ok(result.trace.text.length > 0);
  assert.ok(result.trace.followUp.length > 0);
  assert.deepEqual(result.state.seenRegions, [nearby.regionKey]);
});

test("staying in the same region does not generate a trace", () => {
  const home = simulateLocation("home");
  const result = discoverMovementTrace(home.regionKey, home);
  assert.equal(result.trace, null);
});

test("repeated checks in the same arrived region cannot farm traces", () => {
  const home = simulateLocation("home");
  const nearby = simulateLocation("nearby");
  const first = discoverMovementTrace(home.regionKey, nearby);
  const second = discoverMovementTrace(home.regionKey, nearby, first.state);
  assert.ok(first.trace);
  assert.equal(second.trace, null);
});

test("trace output never exposes raw coordinates or route history", () => {
  const home = simulateLocation("home");
  const faraway = simulateLocation("faraway");
  const result = discoverMovementTrace(home.regionKey, faraway);
  const serialized = JSON.stringify(result.trace);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes("route"), false);
  assert.equal(serialized.includes(faraway.regionKey), false);
});
