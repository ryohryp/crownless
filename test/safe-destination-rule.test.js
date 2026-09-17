"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateLocation } = require("../src/location-simulation");
const { safeDestination, containsPreciseDestination, assertSafeDestination } = require("../src/safe-destination-rule");

test("simulated faraway travel becomes an abstract safe-region instruction", () => {
  const simulated = simulateLocation("faraway");
  const destination = safeDestination({ id: "faraway", ...simulated });

  assert.equal(destination.kind, "abstract-region");
  assert.equal(destination.label, "遠くの地域");
  assert.match(destination.direction, /遠く離れた土地/);
  assert.equal(destination.requiresExactDestination, false);
  assert.equal(destination.requiresContinuousScreenUse, false);
  assert.equal(containsPreciseDestination(destination), false);
  assert.equal(assertSafeDestination(destination), true);
});

test("safe destination output does not retain region key or raw movement data", () => {
  const destination = safeDestination({
    id: "nearby",
    regionKey: "35.76,139.86",
    label: "隣の地域",
    visit: "first",
    latitude: 35.76,
    longitude: 139.86,
    routeHistory: [[35.75, 139.85]]
  });

  assert.equal("regionKey" in destination, false);
  assert.equal("latitude" in destination, false);
  assert.equal("longitude" in destination, false);
  assert.equal("routeHistory" in destination, false);
});

test("contract rejects exact destinations and continuous-screen movement requirements", () => {
  assert.equal(containsPreciseDestination({ address: "1-2-3" }), true);
  assert.throws(() => assertSafeDestination({ destination: "specific POI" }), /precise destination/);
  assert.throws(() => assertSafeDestination({ requiresContinuousScreenUse: true }), /unsafe movement/);
});
