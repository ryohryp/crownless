"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const systemFactory = require("../src/expedition-system.js");
const forcedMarch = require("../src/expedition-forced-march.js");

test("forced march halves destination wait while normal pace preserves it", () => {
  const state = systemFactory.initialState();
  const normal = forcedMarch.dispatchInputForPace(state, { destinationId: "ashen-wood" }, "normal");
  const forced = forcedMarch.dispatchInputForPace(state, { destinationId: "ashen-wood" }, "forced");
  assert.equal(normal.input.durationMs, undefined);
  assert.equal(forced.input.durationMs, state.destinations.find((item) => item.id === "ashen-wood").durationMs / 2);
});

test("explicit duration such as dev instant return is not overwritten", () => {
  const state = systemFactory.initialState();
  const forced = forcedMarch.dispatchInputForPace(state, { destinationId: "ashen-wood", durationMs: 0 }, "forced");
  assert.equal(forced.input.durationMs, 0);
});

test("forced march dispatch stores pace as immutable expedition input", () => {
  const system = require("../src/expedition-system.js");
  const root = { CrownlessExpeditionSystem: system };
  forcedMarch.installSystemHooks(root);
  forcedMarch.setSelectedPace("forced");
  const startedAt = 1_700_000_000_000;
  const state = system.dispatchExpedition(system.initialState(), {
    destinationId: "ashen-wood",
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "cautious",
    objective: "explore",
    seed: 7,
  }, startedAt);
  assert.equal(state.activeExpedition.inputs.pace, "forced");
  assert.equal(state.activeExpedition.expectedReturnAt - startedAt, 90_000);
});

test("successful forced march report records fatigue without replacing injuries", () => {
  const report = {
    expeditionId: "exp-test",
    outcome: "success",
    companionIds: ["mira", "ed"],
    injuries: ["ed"],
    completedAt: 1_700_000_090_000,
    log: [],
  };
  const expedition = { inputs: { pace: "forced" } };
  forcedMarch.decorateReport(report, expedition);
  assert.deepEqual(report.forcedMarchFatigueIds, ["mira"]);
  assert.equal(report.log.filter((item) => item.type === "forced-march-fatigue").length, 1);

  const state = systemFactory.initialState();
  state.companions.find((item) => item.id === "ed").condition = "injured";
  forcedMarch.applyFatigue(state, report);
  const mira = state.companions.find((item) => item.id === "mira");
  const ed = state.companions.find((item) => item.id === "ed");
  assert.equal(mira.condition, "recovering");
  assert.equal(mira.recoveryUntil - report.completedAt, forcedMarch.FORCED_RECOVERY_MS);
  assert.equal(ed.condition, "injured");
});

test("failed forced march does not invent fatigue recovery", () => {
  const report = { expeditionId: "exp-fail", outcome: "failed", companionIds: ["mira"], injuries: [], completedAt: 10, log: [] };
  forcedMarch.decorateReport(report, { inputs: { pace: "forced" } });
  assert.equal(report.forcedMarchFatigueIds, undefined);
  const state = systemFactory.initialState();
  forcedMarch.applyFatigue(state, report);
  assert.equal(state.companions.find((item) => item.id === "mira").condition, "healthy");
});

test("normal pace does not decorate report or alter companion state", () => {
  const report = { expeditionId: "exp-normal", outcome: "success", companionIds: ["mira"], injuries: [], completedAt: 10, log: [] };
  forcedMarch.decorateReport(report, { inputs: { pace: "normal" } });
  const state = systemFactory.initialState();
  forcedMarch.applyFatigue(state, report);
  assert.equal(report.marchPace, undefined);
  assert.equal(state.companions.find((item) => item.id === "mira").condition, "healthy");
});

test("forced march fatigue naturally rejoins existing recovery clock", () => {
  const completedAt = 1_700_000_000_000;
  const state = systemFactory.initialState();
  const report = {
    expeditionId: "exp-recovery",
    outcome: "success",
    marchPace: "forced",
    forcedMarchFatigueIds: ["mira"],
    completedAt,
  };
  forcedMarch.applyFatigue(state, report);
  assert.equal(systemFactory.reconcileRecoveries(state, completedAt + forcedMarch.FORCED_RECOVERY_MS - 1).companions[0].condition, "recovering");
  assert.equal(systemFactory.reconcileRecoveries(state, completedAt + forcedMarch.FORCED_RECOVERY_MS).companions[0].condition, "healthy");
});