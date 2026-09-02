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

test("prepare enhancement becomes a no-op after the first DOM mutation pass", () => {
  let legendWrites = 0;
  let datasetWrites = 0;
  const legend = {
    _textContent: "仲間",
    get textContent() { return this._textContent; },
    set textContent(value) { this._textContent = value; legendWrites += 1; },
  };
  const dataset = {};
  Object.defineProperty(dataset, "partySelection", {
    get() { return this._partySelection; },
    set(value) { this._partySelection = value; datasetWrites += 1; },
    configurable: true,
  });
  const group = { dataset, querySelector: (selector) => selector === "legend" ? legend : null };
  const inputs = [
    { type: "radio", checked: true, disabled: false, closest: () => group },
    { type: "radio", checked: false, disabled: false, closest: () => group },
    { type: "radio", checked: false, disabled: false, closest: () => group },
  ];
  const form = { querySelectorAll: (selector) => selector === 'input[name="companion"]' ? inputs : [] };
  const root = { document: { querySelector: () => form } };

  assert.equal(party.enhancePrepare(root), true);
  assert.equal(legendWrites, 1);
  assert.equal(datasetWrites, 1);
  assert.ok(inputs.every((input) => input.type === "checkbox"));

  assert.equal(party.enhancePrepare(root), false);
  assert.equal(legendWrites, 1, "stable prepare DOM must not rewrite legend text and retrigger childList observers");
  assert.equal(datasetWrites, 1);
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
