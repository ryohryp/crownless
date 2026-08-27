"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const system = require("../src/expedition-system.js");

function dispatch(policyId, extras = {}) {
  return system.dispatchExpedition(system.initialState(), {
    destinationId: extras.destinationId || "ashen-wood",
    companionIds: extras.companionIds || ["mira"],
    equipmentIds: extras.equipmentIds || [],
    policyId,
    objective: extras.objective || "explore",
    seed: extras.seed == null ? 7 : extras.seed,
    durationMs: extras.durationMs == null ? 1000 : extras.durationMs,
  }, 1_000_000);
}

test("dispatch persists immutable timing inputs and survives normalization", () => {
  const state = dispatch("standard", { equipmentIds: ["rope"] });
  assert.equal(state.activeExpedition.startedAt, 1_000_000);
  assert.equal(state.activeExpedition.expectedReturnAt, 1_001_000);
  assert.equal(state.activeExpedition.rulesVersion, system.RULES_VERSION);
  assert.deepEqual(state.activeExpedition.inputs.equipmentIds, ["rope"]);
  const restored = system.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.activeExpedition.seed, state.activeExpedition.seed);
});

test("advance can inject time and completes only after expected return", () => {
  const state = dispatch("standard");
  assert.equal(system.advance(state, 1_000_999).status, "active");
  const completed = system.advance(state, 1_001_000);
  assert.equal(completed.status, "completed");
  assert.equal(completed.state.activeExpedition, null);
  assert.equal(completed.state.completedReports.length, 1);
});

test("policy changes deterministic outcome tendency for the same seed", () => {
  const seed = 3;
  const cautiousState = dispatch("cautious", { seed, companionIds: ["ed"], destinationId: "black-mine" });
  const greedyState = dispatch("greedy", { seed, companionIds: ["ed"], destinationId: "black-mine" });
  const cautious = system.resolveExpedition(cautiousState.activeExpedition, cautiousState);
  const greedy = system.resolveExpedition(greedyState.activeExpedition, greedyState);
  assert.notDeepEqual(cautious.log.map((x) => x.type), greedy.log.map((x) => x.type));
  assert.ok(cautious.log.some((x) => x.type === "retreat") || greedy.log.some((x) => x.type === "policy"));
});

test("companion traits and equipment capabilities leave legible causal events", () => {
  const forest = dispatch("standard", { seed: 11, equipmentIds: ["herb-kit"], companionIds: ["mira"] });
  const report = system.resolveExpedition(forest.activeExpedition, forest);
  assert.ok(report.log.some((x) => x.causes.includes("woodsman")));

  const cave = dispatch("standard", { seed: 11, equipmentIds: ["rope"], companionIds: ["ed"], destinationId: "black-mine" });
  const caveReport = system.resolveExpedition(cave.activeExpedition, cave);
  assert.ok(caveReport.log.some((x) => x.causes.includes("climb")));
});

test("applying a completed report is idempotent", () => {
  const state = dispatch("greedy", { seed: 9, equipmentIds: ["rope", "old-knife"], destinationId: "hollow-village" });
  const report = system.resolveExpedition(state.activeExpedition, state);
  const once = system.applyReport(state, report);
  const lootCount = once.securedLoot.length;
  const reportCount = once.completedReports.length;
  const twice = system.applyReport(once, report);
  assert.equal(twice.securedLoot.length, lootCount);
  assert.equal(twice.completedReports.length, reportCount);
  assert.equal(twice.appliedExpeditionIds.filter((id) => id === report.expeditionId).length, 1);
});

test("resolved report exposes summary-worthy loot injury or discovery and chronology", () => {
  const state = dispatch("greedy", { seed: 21, destinationId: "black-mine", companionIds: ["sella"], equipmentIds: ["rope"] });
  const report = system.resolveExpedition(state.activeExpedition, state);
  assert.ok(report.log.length >= 5);
  assert.ok(report.loot.length + report.injuries.length + report.discoveries.length >= 1);
  assert.ok(report.notableEvent && report.notableEvent.text);
});
