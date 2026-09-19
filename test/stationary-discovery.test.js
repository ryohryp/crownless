"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { queueDiscoveryAfterMovement, resolveStationaryDiscovery } = require("../src/stationary-discovery");

const FARAWAY = { regionKey: "35.70,139.80", label: "遠くの地域" };

test("movement queues discovery without requiring an immediate interaction", () => {
  const queued = queueDiscoveryAfterMovement("35.60,139.70", FARAWAY);
  assert.ok(queued.pending);
  assert.equal(queued.pending.regionKey, FARAWAY.regionKey);

  const moving = resolveStationaryDiscovery(queued.pending, { stationary: false });
  assert.equal(moving.discovery, null);
  assert.deepEqual(moving.pending, queued.pending);
});

test("arrival resolves the queued discovery once stationary", () => {
  const queued = queueDiscoveryAfterMovement("35.60,139.70", FARAWAY);
  const arrived = resolveStationaryDiscovery(queued.pending, { stationary: true });

  assert.ok(arrived.discovery);
  assert.equal(arrived.discovery.resolvedAfterArrival, true);
  assert.equal(arrived.discovery.regionLabel, FARAWAY.label);
  assert.equal(arrived.pending, null);
});

test("same-region samples do not create a pending discovery", () => {
  const queued = queueDiscoveryAfterMovement(FARAWAY.regionKey, FARAWAY);
  assert.equal(queued.pending, null);
});

test("stationary resolution does not expose movement history or raw coordinates", () => {
  const queued = queueDiscoveryAfterMovement("35.60,139.70", FARAWAY);
  const arrived = resolveStationaryDiscovery(queued.pending, { stationary: true });
  const serialized = JSON.stringify(arrived);

  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes("route"), false);
  assert.equal(serialized.includes("history"), false);
});
