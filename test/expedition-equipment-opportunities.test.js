"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const opportunities = require("../src/expedition-equipment-opportunities.js");

function expedition(overrides = {}) {
  return {
    id: "exp-rope-shaft",
    inputs: {
      destinationId: "black-mine",
      companionIds: ["mira", "ed", "sella"],
      equipmentIds: ["rope", "old-knife", "herb-kit", "shortbow", "hood"],
      policyId: "cautious",
      objective: "scavenge",
      ...overrides,
    },
  };
}

function successfulReport(overrides = {}) {
  return {
    expeditionId: "exp-rope-shaft",
    outcome: "success",
    destinationId: "black-mine",
    loot: [],
    log: [{ minute: 100, time: "08:00", type: "loot", text: "通常の探索成果", causes: [] }],
    ...overrides,
  };
}

test("black-mine scavenging with rope opens the shaft cache exactly once", () => {
  const report = successfulReport();
  const exp = expedition();

  opportunities.applyRopeShaftOpportunity(report, exp);
  opportunities.applyRopeShaftOpportunity(report, exp);

  assert.equal(report.equipmentOpportunity.id, "rope-shaft-cache");
  assert.equal(report.loot.filter((item) => item.id === "rope-shaft-miners-cache").length, 1);
  assert.equal(report.log.filter((entry) => entry.type === "equipment-opportunity").length, 1);
  assert.match(report.log.find((entry) => entry.type === "equipment-opportunity").text, /麻縄.*縦坑/);
});

test("rope shaft stays closed without the matching preparation and successful return", () => {
  const cases = [
    [successfulReport(), expedition({ equipmentIds: ["old-knife"] })],
    [successfulReport(), expedition({ objective: "explore" })],
    [successfulReport(), expedition({ objective: "hunt" })],
    [successfulReport({ destinationId: "ashen-wood" }), expedition({ destinationId: "ashen-wood" })],
    [successfulReport({ outcome: "early-return" }), expedition()],
    [successfulReport({ outcome: "failed" }), expedition()],
  ];

  for (const [report, exp] of cases) {
    opportunities.applyRopeShaftOpportunity(report, exp);
    assert.equal(report.equipmentOpportunity, undefined);
    assert.equal(report.loot.some((item) => item.id === "rope-shaft-miners-cache"), false);
  }
});

test("equipment opportunity reward is secured idempotently", () => {
  const state = system.initialState();
  const report = opportunities.applyRopeShaftOpportunity(successfulReport(), expedition());

  opportunities.persistEquipmentOpportunityReward(state, report);
  opportunities.persistEquipmentOpportunityReward(state, report);

  const secured = state.securedLoot.filter((item) => item.id === "rope-shaft-miners-cache");
  assert.equal(secured.length, 1);
  assert.equal(secured[0].sourceExpeditionId, report.expeditionId);
});

test("installed hook makes the preparation choice visible end-to-end in report and secured loot", () => {
  const wrapped = { ...system };
  opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  const startedAt = 1_000_000;
  const state = wrapped.dispatchExpedition(wrapped.initialState(), {
    destinationId: "black-mine",
    companionIds: ["mira", "ed", "sella"],
    equipmentIds: ["rope", "old-knife", "herb-kit", "shortbow", "hood"],
    policyId: "cautious",
    objective: "scavenge",
    seed: 44,
    durationMs: 0,
  }, startedAt);

  const completed = wrapped.advance(state, startedAt);
  assert.equal(completed.status, "completed");
  assert.equal(completed.report.outcome, "success");
  assert.equal(completed.report.equipmentOpportunity.id, "rope-shaft-cache");
  assert.ok(completed.report.loot.some((item) => item.id === "rope-shaft-miners-cache"));
  assert.ok(completed.state.securedLoot.some((item) => item.id === "rope-shaft-miners-cache"));
});

test("browser bridge loads the equipment opportunity sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-equipment-opportunities\.js/);
  assert.match(bridgeSource, /loadEquipmentOpportunities/);
});
