"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateLocation } = require("../src/location-simulation");
const { discoverDistantHorizon } = require("../src/distant-horizon");

test("a large coarse-region journey opens one new game-world horizon", () => {
  const home = simulateLocation("home");
  const faraway = simulateLocation("faraway");
  const result = discoverDistantHorizon(home.regionKey, faraway);
  assert.ok(result.horizon);
  assert.equal(result.horizon.distanceBand, "far");
  assert.ok(result.horizon.title);
  assert.ok(result.horizon.followUp);
  assert.equal(result.state.openedRegions.length, 1);
});

test("nearby movement does not unlock a distant horizon", () => {
  const home = simulateLocation("home");
  const nearby = simulateLocation("nearby");
  const result = discoverDistantHorizon(home.regionKey, nearby);
  assert.equal(result.horizon, null);
});

test("the same coarse region cannot farm repeated horizon unlocks", () => {
  const home = simulateLocation("home");
  const faraway = simulateLocation("faraway");
  const first = discoverDistantHorizon(home.regionKey, faraway);
  const second = discoverDistantHorizon(home.regionKey, faraway, first.state);
  assert.ok(first.horizon);
  assert.equal(second.horizon, null);
});

test("horizon output exposes no raw coordinates or route history", () => {
  const home = simulateLocation("home");
  const faraway = simulateLocation("faraway");
  const result = discoverDistantHorizon(home.regionKey, faraway);
  const serialized = JSON.stringify(result.horizon);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes("route"), false);
  assert.equal(serialized.includes(faraway.regionKey), false);
});
