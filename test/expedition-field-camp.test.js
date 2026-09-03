"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const camp = require("../src/expedition-field-camp.js");
const followups = require("../src/expedition-followup-destinations.js");

test("field camp extends destination duration by 1.5x", () => {
  const state = system.initialState();
  const base = state.destinations.find((item) => item.id === "ashen-wood");
  const prepared = camp.dispatchInputForStay(state, { destinationId: "ashen-wood" }, camp.FIELD_CAMP);
  assert.equal(prepared.stayPlan, camp.FIELD_CAMP);
  assert.equal(prepared.input.durationMs, Math.round(base.durationMs * 1.5));
});

test("successful explore field camp adds one concrete clue", () => {
  const expedition = {
    id: "exp-camp",
    inputs: { destinationId: "ashen-wood", objective: "explore", stayPlan: camp.FIELD_CAMP },
  };
  const report = { expeditionId: "exp-camp", outcome: "success", discoveries: [], log: [] };
  camp.decorateReport(report, expedition);
  camp.decorateReport(report, expedition);
  assert.equal(report.discoveries.filter((item) => item.kind === "camp-observation").length, 1);
  assert.equal(report.discoveries[0].sourceDestinationId, "ashen-wood");
  assert.equal(report.log.filter((entry) => entry.type === "field-camp-observation").length, 1);
});

test("field camp does not award clue on failure, early return, or non-explore objective", () => {
  for (const [outcome, objective] of [["failed", "explore"], ["early-return", "explore"], ["success", "hunt"]]) {
    const report = { outcome, discoveries: [], log: [] };
    camp.decorateReport(report, { id: "exp-x", inputs: { destinationId: "ashen-wood", objective, stayPlan: camp.FIELD_CAMP } });
    assert.equal(report.discoveries.length, 0);
  }
});

test("field camp clue unlocks the existing follow-up destination", () => {
  const state = system.initialState();
  const expedition = { id: "exp-camp-followup", inputs: { destinationId: "ashen-wood", objective: "explore", stayPlan: camp.FIELD_CAMP } };
  const report = { expeditionId: expedition.id, outcome: "success", discoveries: [], log: [] };
  camp.decorateReport(report, expedition);
  followups.unlockFollowupDestinations(state, report);
  assert.ok(state.destinations.some((item) => item.id === "followup:ashen-wood"));
  assert.ok(report.log.some((entry) => entry.type === "followup-unlocked"));
});

test("installed dispatch hook persists stay plan and changes expected return", () => {
  const wrapped = { ...system };
  camp.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  const state = wrapped.initialState();
  const base = state.destinations.find((item) => item.id === "ashen-wood");
  camp.setSelectedStay(camp.FIELD_CAMP);
  const startedAt = 1_000_000;
  const dispatched = wrapped.dispatchExpedition(state, {
    destinationId: "ashen-wood",
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
    seed: 7,
  }, startedAt);
  assert.equal(dispatched.activeExpedition.inputs.stayPlan, camp.FIELD_CAMP);
  assert.equal(dispatched.activeExpedition.expectedReturnAt, startedAt + Math.round(base.durationMs * 1.5));
});

test("browser bridge loads the field camp sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-field-camp\.js/);
  assert.match(bridgeSource, /loadFieldCamp/);
});