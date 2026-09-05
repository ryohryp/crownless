"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Feature = require("../src/issue352-roadside-rescue.js");

function report(outcome = "success", repelled = true) {
  return {
    expeditionId: "exp-352",
    destinationId: Feature.BANDIT_DESTINATION_ID,
    outcome,
    signalEncounter: {
      kind: "bandit-ambush",
      ...(repelled ? { aid: { id: "bandit-repel-aid" } } : {})
    },
    log: []
  };
}

test("system hooks apply Marco rescue state through applyReport", () => {
  const system = {
    resolveExpedition(_expedition, _state) { return report(); },
    applyReport(state, _report) { return state; },
    advance(state) { return { state, report: null }; }
  };
  const root = { CrownlessExpeditionSystem: system };
  assert.equal(Feature.installSystemHooks(root), true);

  const state = {};
  const result = system.resolveExpedition({}, state);
  system.applyReport(state, result);

  assert.equal(state[Feature.INCIDENT_KEY].marcoStatus, "recovered");
  assert.equal(result.npcOutcome.outcome, "rescued");
  assert.equal(result.worldChanges.find((entry) => entry.id === Feature.RESCUE_CAUSE).state, "rescued");
});

test("system hooks preserve unresolved Marco on failed return", () => {
  const system = {
    resolveExpedition() { return report("failed", false); },
    applyReport(state, _report) { return state; },
    advance(state) { return { state, report: report("failed", false) }; }
  };
  const root = { CrownlessExpeditionSystem: system };
  Feature.installSystemHooks(root);

  const state = {};
  const advanced = system.advance(state, Date.now());
  assert.equal(advanced.state[Feature.INCIDENT_KEY].marcoStatus, "missing");
  assert.equal(advanced.state[Feature.INCIDENT_KEY].resolved, false);
  assert.equal(advanced.report.npcOutcome.outcome, "missing");
});
