"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { regionalGearCharacter } = require("../src/regional-gear-character");

const gear = [
  { id: "road-shield", type: "shield" },
  { id: "hunter-bow", type: "bow" },
  { id: "fang-dagger", type: "dagger" }
];

test("distant horizons give regions distinct gear tendencies", () => {
  const highland = regionalGearCharacter("wind-cut-highland", gear);
  const marsh = regionalGearCharacter("ashen-marsh", gear);

  assert.deepEqual(highland.favoredTypes, ["bow", "dagger"]);
  assert.deepEqual(marsh.favoredTypes, ["shield", "dagger"]);
  assert.equal(highland.candidates[0].type, "bow");
  assert.equal(marsh.candidates[0].type, "shield");
  assert.notEqual(highland.cue, marsh.cue);
});

test("regional character changes ordering without inventing or guaranteeing loot", () => {
  const result = regionalGearCharacter("red-cliff-road", gear);
  assert.equal(result.candidates.length, gear.length);
  assert.deepEqual(new Set(result.candidates.map((item) => item.id)), new Set(gear.map((item) => item.id)));
});

test("unknown horizons do not create a regional reward", () => {
  assert.equal(regionalGearCharacter("unknown", gear), null);
});
