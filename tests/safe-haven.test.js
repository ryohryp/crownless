"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/slice-engine");
const installSafeHaven = require("../src/safe-haven");

installSafeHaven(Core);

function playable(cleared = []) {
  const state = Core.initial();
  state.mode = "demo";
  state.cleared = [...cleared];
  return state;
}

test("a known forest haven gives a small visible revisit bonus", () => {
  const state = playable(["wood"]);
  const next = Core.start(state, "wood");

  assert.equal(next.expedition.scrap, 2);
  assert.match(next.expedition.log[0], /根洞の火床/);
  assert.match(next.expedition.log[0], /鉄片 \+2/);
});

test("the haven bonus does not apply before the forest is cleared", () => {
  const next = Core.start(playable(), "wood");
  assert.equal(next.expedition.scrap, 0);
  assert.doesNotMatch(next.expedition.log.join(" "), /根洞の火床/);
});

test("the haven bonus is local to the forest", () => {
  const state = playable(["wood"]);
  state.unlocked.push("tower");
  const next = Core.start(state, "tower");
  assert.equal(next.expedition.scrap, 0);
});

test("a haven-assisted expedition remains valid through save/load", () => {
  const next = Core.start(playable(["wood"]), "wood");
  const roundTrip = Core.parse(Core.serialize(next));
  assert.deepEqual(roundTrip, next);
  assert.equal(Object.prototype.hasOwnProperty.call(next, "safeHavens"), false);
});
