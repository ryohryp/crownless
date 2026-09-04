"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const recovery = require("../src/expedition-lost-loot-recovery.js");

function failedReport(overrides = {}) {
  return {
    expeditionId: "exp-lost-loot",
    outcome: "early-return",
    destinationId: "hollow-village",
    destinationName: "空鐘の廃村",
    loot: [
      { id: "bandit-silver-1", name: "盗賊の銀貨袋", tags: ["valuable"] },
      { id: "bandit-cleaver-2", name: "盗賊の鉈", tags: ["cut"] },
    ],
    injuries: [],
    discoveries: [],
    log: [
      { minute: 80, type: "combat-retreat", text: "撤退した。", causes: ["cautious"] },
      { minute: 110, type: "return", text: "予定より早く灰炉へ戻った。", causes: ["early return"] },
    ],
    ...overrides,
  };
}

function sourceExpedition() {
  return {
    id: "exp-lost-loot",
    inputs: { destinationId: "hollow-village", companionIds: ["mira"], equipmentIds: [], policyId: "cautious", objective: "explore" },
  };
}

function recoveryState() {
  const state = system.initialState();
  const report = failedReport();
  recovery.decorateLoss(report, sourceExpedition());
  recovery.registerRecovery(state, report);
  return { state, report, destination: state.destinations.find((item) => item.id === report.lostLoot.recoveryDestinationId) };
}

test("retreat turns the last carried loot into a recoverable loss instead of secured loot", () => {
  const report = failedReport();
  recovery.decorateLoss(report, sourceExpedition());

  assert.equal(report.loot.length, 1);
  assert.equal(report.lostLoot.id, "bandit-cleaver-2");
  assert.equal(report.lostLoot.recoveryDestinationId, "recovery:exp-lost-loot");
  assert.match(report.notableEvent.text, /落とした.*取り戻し/);

  const state = system.initialState();
  state.securedLoot.push({ id: "bandit-cleaver-2", name: "盗賊の鉈", sourceExpeditionId: report.expeditionId });
  recovery.applySideEffects(state, report);

  assert.equal(state.securedLoot.some((item) => item.id === "bandit-cleaver-2" && item.sourceExpeditionId === report.expeditionId), false);
  const destination = state.destinations.find((item) => item.id === "recovery:exp-lost-loot");
  assert.ok(destination);
  assert.equal(destination.recoveryItem.id, "bandit-cleaver-2");
  assert.ok(state.discoveredDestinationIds.includes(destination.id));
  assert.equal(report.recoveryDestinations.length, 1);
});

test("recovery destination is a real dispatch target using the existing expedition loop", () => {
  const { state, destination } = recoveryState();
  const dispatched = system.dispatchExpedition(state, {
    id: "exp-recovery-attempt",
    destinationId: destination.id,
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "cautious",
    objective: "explore",
    durationMs: 0,
    seed: 12,
  }, 1000);

  assert.equal(dispatched.activeExpedition.inputs.destinationId, destination.id);
  assert.equal(dispatched.activeExpedition.id, "exp-recovery-attempt");
});

test("successful recovery adds the lost item once and retires the recovery destination", () => {
  const { state, destination } = recoveryState();
  const expedition = { id: "exp-recovery-success", inputs: { destinationId: destination.id } };
  const report = {
    expeditionId: expedition.id,
    outcome: "success",
    destinationId: destination.id,
    destinationName: destination.name,
    loot: [],
    log: [{ minute: 110, type: "return", text: "灰炉へ帰還した。", causes: ["returned"] }],
  };

  recovery.decorateRecovery(report, expedition, state);
  recovery.decorateRecovery(report, expedition, state);
  recovery.applySideEffects(state, report);
  recovery.applySideEffects(state, report);

  assert.equal(report.recoverySucceeded, true);
  assert.equal(report.loot.filter((item) => item.id === "bandit-cleaver-2").length, 1);
  assert.equal(report.log.filter((entry) => entry.type === "loot-recovered").length, 1);
  assert.equal(state.securedLoot.filter((item) => item.id === "bandit-cleaver-2" && item.sourceExpeditionId === expedition.id).length, 1);
  assert.equal(state.destinations.some((item) => item.id === destination.id), false);
  assert.equal(state.discoveredDestinationIds.includes(destination.id), false);
});

test("failed recovery keeps the lead available and never grants the lost item", () => {
  const { state, destination } = recoveryState();
  const expedition = { id: "exp-recovery-failed", inputs: { destinationId: destination.id } };
  const report = { expeditionId: expedition.id, outcome: "failed", loot: [], log: [] };

  recovery.decorateRecovery(report, expedition, state);
  recovery.applySideEffects(state, report);

  assert.equal(report.recoveryAttempt, true);
  assert.equal(report.recoverySucceeded, false);
  assert.equal(report.loot.length, 0);
  assert.ok(state.destinations.some((item) => item.id === destination.id));
  assert.equal(state.securedLoot.some((item) => item.id === "bandit-cleaver-2" && item.sourceExpeditionId === expedition.id), false);
});

test("successful expeditions and recovery expeditions do not create recursive loss leads", () => {
  const success = failedReport({ outcome: "success" });
  recovery.decorateLoss(success, sourceExpedition());
  assert.equal(success.lostLoot, undefined);
  assert.equal(success.loot.length, 2);

  const recoveryFailure = failedReport({ expeditionId: "exp-recovery-failed", outcome: "failed" });
  const recoveryExpedition = { inputs: { destinationId: "recovery:exp-lost-loot" } };
  recovery.decorateLoss(recoveryFailure, recoveryExpedition);
  assert.equal(recoveryFailure.lostLoot, undefined);
  assert.equal(recoveryFailure.loot.length, 2);
});

test("browser bridge loads lost-loot recovery after existing expedition sidecars", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(source, /src\/expedition-lost-loot-recovery\.js/);
  assert.match(source, /loadLostLootRecovery/);
  assert.ok(source.indexOf("api.loadCampSupplyRelief(root)") < source.indexOf("api.loadLostLootRecovery(root)"));
});
