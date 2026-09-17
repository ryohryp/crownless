"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateLocation } = require("../src/location-simulation");
const { resolveWeekendJourney } = require("../src/weekend-journey");

test("a familiar region keeps the normal expedition tone", () => {
  const result = resolveWeekendJourney(simulateLocation("home"));
  assert.equal(result.state, "familiar");
  assert.equal(result.theme, "近郊の街道");
});

test("a faraway region changes journey flavor without bonus rewards", () => {
  const result = resolveWeekendJourney(simulateLocation("faraway"));
  assert.equal(result.state, "journey");
  assert.equal(result.theme, "灰風の境界地");
  assert.equal(result.encounter, "旅人の焚き火跡");
  assert.equal(result.rewardMultiplier, 1);
});

test("journey presentation does not expose precise movement data", () => {
  const result = resolveWeekendJourney(simulateLocation("faraway"));
  assert.equal("latitude" in result, false);
  assert.equal("longitude" in result, false);
  assert.equal("route" in result, false);
  assert.equal("history" in result, false);
});
