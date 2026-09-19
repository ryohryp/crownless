"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateLocation } = require("../src/location-simulation");
const { coarseJourneyBand, discoverTransitJourney } = require("../src/transit-expedition");

test("a large coarse-region change is treated as a journey regardless of travel mode", () => {
  const home = simulateLocation("home");
  const faraway = { ...simulateLocation("faraway"), travelMode: "train" };
  const result = discoverTransitJourney(home.regionKey, faraway);
  assert.equal(coarseJourneyBand(home.regionKey, faraway.regionKey), "journey");
  assert.ok(result.trace);
  assert.equal(result.trace.journey, true);
  assert.equal(result.trace.travelMode, "any");
  assert.match(result.trace.text, /大きく土地を移った先/);
});

test("nearby movement keeps the normal movement discovery pulse", () => {
  const home = simulateLocation("home");
  const nearby = simulateLocation("nearby");
  const result = discoverTransitJourney(home.regionKey, nearby);
  assert.equal(coarseJourneyBand(home.regionKey, nearby.regionKey), "nearby");
  assert.ok(result.trace);
  assert.equal(result.trace.journey, undefined);
});

test("staying in one region does not create a journey", () => {
  const home = simulateLocation("home");
  const result = discoverTransitJourney(home.regionKey, home);
  assert.equal(coarseJourneyBand(home.regionKey, home.regionKey), "same");
  assert.equal(result.trace, null);
});

test("transit output stores no speed, route history, or raw coordinates", () => {
  const home = simulateLocation("home");
  const faraway = simulateLocation("faraway");
  const result = discoverTransitJourney(home.regionKey, faraway);
  const serialized = JSON.stringify(result.trace);
  assert.equal(serialized.includes("speed"), false);
  assert.equal(serialized.includes("route"), false);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes(faraway.regionKey), false);
});
