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

test("leader selection only accepts a selected member of a two-person party", () => {
  const selected = [{ value: "mira" }, { value: "ed" }];
  const form = {
    querySelectorAll(selector) {
      if (selector === 'input[name="companion"]:checked') return selected;
      return [];
    },
    querySelector(selector) {
      if (selector === 'input[name="leader"]:checked') return { value: "ed" };
      return null;
    },
  };
  assert.equal(party.selectedLeaderId(form), "ed");
  assert.equal(party.selectedLeaderId(form, ["mira"]), null);

  form.querySelector = () => ({ value: "sella" });
  assert.equal(party.selectedLeaderId(form, ["mira", "ed"]), "mira", "an invalid leader falls back to a current party member");
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
    { type: "radio", checked: true, disabled: false, value: "mira", closest: () => group },
    { type: "radio", checked: false, disabled: false, value: "ed", closest: () => group },
    { type: "radio", checked: false, disabled: false, value: "sella", closest: () => group },
  ];
  const form = {
    querySelectorAll: (selector) => selector === 'input[name="companion"]' ? inputs : [],
    querySelector: () => null,
  };
  const root = { document: { querySelector: () => form } };

  assert.equal(party.enhancePrepare(root), true);
  assert.equal(legendWrites, 1);
  assert.equal(datasetWrites, 1);
  assert.ok(inputs.every((input) => input.type === "checkbox"));

  assert.equal(party.enhancePrepare(root), false);
  assert.equal(legendWrites, 1, "stable prepare DOM must not rewrite legend text and retrigger childList observers");
  assert.equal(datasetWrites, 1);
});

test("dispatch hook stores the chosen leader only for the selected two-person party", () => {
  const form = {
    querySelectorAll(selector) {
      if (selector === 'input[name="companion"]:checked') return [{ value: "mira" }, { value: "ed" }];
      return [];
    },
    querySelector(selector) {
      if (selector === 'input[name="leader"]:checked') return { value: "ed" };
      return null;
    },
  };
  const fakeSystem = {
    dispatchExpedition(state, input) {
      return { ...state, activeExpedition: { inputs: { ...input } } };
    },
  };
  const root = { CrownlessExpeditionSystem: fakeSystem, document: { querySelector: () => form } };
  assert.equal(party.installDispatchHook(root), true);
  const next = fakeSystem.dispatchExpedition({}, { destinationId: "ashen-wood" }, 1000);
  assert.deepEqual(next.activeExpedition.inputs.companionIds, ["mira", "ed"]);
  assert.equal(next.activeExpedition.inputs.leaderId, "ed");
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

test("party and leader slices are loaded by the runtime bridge without save or GPS writes", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  const partySource = fs.readFileSync(path.join(__dirname, "../src/expedition-party-selection.js"), "utf8");
  const leaderSource = fs.readFileSync(path.join(__dirname, "../src/expedition-leader.js"), "utf8");
  assert.match(bridge, /loadPartySelection/);
  assert.match(bridge, /src\/expedition-party-selection\.js/);
  assert.match(bridge, /loadLeaderOutcomes/);
  assert.match(bridge, /src\/expedition-leader\.js/);
  assert.doesNotMatch(partySource, /localStorage\.setItem/);
  assert.doesNotMatch(leaderSource, /localStorage\.setItem/);
  assert.doesNotMatch(`${partySource}\n${leaderSource}`, /latitude|longitude|GPS/i);
});
