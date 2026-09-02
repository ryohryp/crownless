"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const party = require("../src/expedition-party-selection.js");
const system = require("../src/expedition-system.js");

test("party selection keeps at most two selected companion ids", () => {
  const form = {
    querySelectorAll(selector) {
      assert.equal(selector, 'input[name="companion"]:checked');
      return [{ value: "mira" }, { value: "ed" }, { value: "sella" }];
    },
  };
  assert.deepEqual(party.selectedCompanionIds(form), ["mira", "ed"]);
  assert.equal(party.MAX_COMPANIONS, 2);
});

test("existing expedition resolver accepts two companions as immutable dispatch input", () => {
  const state = system.dispatchExpedition(system.initialState(), {
    destinationId: "ashen-wood",
    companionIds: ["mira", "ed"],
    equipmentIds: ["rope"],
    policyId: "standard",
    objective: "explore",
    durationMs: 0,
    seed: 347,
  }, 1000);
  assert.deepEqual(state.activeExpedition.inputs.companionIds, ["mira", "ed"]);
  const advanced = system.advance(state, 1000);
  assert.ok(advanced.report);
  assert.deepEqual(advanced.report.companionIds, ["mira", "ed"]);
});

test("party slice is loaded by the runtime bridge without save or GPS writes", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "../src/expedition-party-selection.js"), "utf8");
  assert.match(bridge, /loadPartySelection/);
  assert.match(bridge, /src\/expedition-party-selection\.js/);
  assert.doesNotMatch(source, /localStorage\.setItem/);
  assert.doesNotMatch(source, /latitude|longitude|GPS/i);
});
