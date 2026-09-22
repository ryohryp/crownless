"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { simulateLocation } = require("../src/location-simulation");
const { connectNeighboringLands } = require("../src/neighboring-lands");

test("neighboring coarse regions reveal one continuous world thread", () => {
  const home = simulateLocation("home");
  const nearby = simulateLocation("nearby");
  const result = connectNeighboringLands(home, nearby);
  assert.ok(result.connection);
  assert.equal(result.connection.connected, true);
  assert.equal(result.connection.fromLabel, home.label);
  assert.equal(result.connection.toLabel, nearby.label);
  assert.ok(result.connection.followUp.length > 0);
  assert.deepEqual(result.state.connectedRegions, [nearby.regionKey]);
});

test("same region and long journeys do not pretend to be neighboring continuity", () => {
  const home = simulateLocation("home");
  const faraway = simulateLocation("faraway");
  assert.equal(connectNeighboringLands(home, home).connection, null);
  assert.equal(connectNeighboringLands(home, faraway).connection, null);
});

test("a neighboring region only creates one connection", () => {
  const home = simulateLocation("home");
  const nearby = simulateLocation("nearby");
  const first = connectNeighboringLands(home, nearby);
  const second = connectNeighboringLands(home, nearby, first.state);
  assert.ok(first.connection);
  assert.equal(second.connection, null);
});

test("player-facing connection never exposes raw coordinates or route history", () => {
  const result = connectNeighboringLands(simulateLocation("home"), simulateLocation("nearby"));
  const serialized = JSON.stringify(result.connection);
  assert.equal(serialized.includes("latitude"), false);
  assert.equal(serialized.includes("longitude"), false);
  assert.equal(serialized.includes("route"), false);
  assert.equal(serialized.includes("35.75"), false);
  assert.equal(serialized.includes("35.76"), false);
});
