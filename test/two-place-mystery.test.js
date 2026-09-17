"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateJourney } = require("../src/location-simulation");
const { resolveTwoPlaceMystery } = require("../src/two-place-mystery");

test("one coarse region reveals only half of the mystery", () => {
  const result = resolveTwoPlaceMystery(simulateJourney(["home"]));
  assert.equal(result.state, "fragment");
  assert.match(result.clue, /灰の鐘/);
  assert.equal("latitude" in result, false);
  assert.equal("longitude" in result, false);
  assert.equal("route" in result, false);
});

test("a second distinct coarse region completes the discovery", () => {
  const result = resolveTwoPlaceMystery(simulateJourney(["home", "nearby"]));
  assert.equal(result.state, "solved");
  assert.equal(result.discovery, "灰鐘の道標");
  assert.match(result.message, /新しい道標/);
});

test("revisiting the same region does not count as travel progress", () => {
  const home = simulateJourney(["home"])[0];
  const result = resolveTwoPlaceMystery([home, { ...home }]);
  assert.equal(result.state, "fragment");
});
