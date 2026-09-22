"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const createCore = require("../src/slice-engine");
const installSafeHaven = require("../src/safe-haven");

const Core = installSafeHaven(createCore);

function playable(cleared = []) {
  const state = Core.initial();
  state.mode = "demo";
  state.cleared = [...cleared];
  return state;
}

test("a known forest haven gives one extra herb on revisit", () => {
  const state = playable(["wood"]);
  const next = Core.start(state, "wood");

  assert.equal(next.expedition.potions, 3);
  assert.match(next.expedition.log[0], /根洞の火床/);
});

test("the haven benefit does not apply before the forest is cleared", () => {
  const next = Core.start(playable(), "wood");
  assert.equal(next.expedition.potions, 2);
  assert.doesNotMatch(next.expedition.log.join(" "), /根洞の火床/);
});

test("the haven benefit is local to the forest", () => {
  const state = playable(["wood"]);
  state.unlocked.push("tower");
  const next = Core.start(state, "tower");
  assert.equal(next.expedition.potions, 2);
});

test("safe-haven installation does not add new persistent save fields", () => {
  const state = playable(["wood"]);
  const roundTrip = Core.parse(Core.serialize(state));
  assert.deepEqual(roundTrip, state);
  assert.equal(Object.prototype.hasOwnProperty.call(state, "safeHavens"), false);
});
