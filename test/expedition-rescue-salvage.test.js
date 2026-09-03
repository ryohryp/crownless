"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const salvage = require("../src/expedition-rescue-salvage.js");

function report(overrides = {}) {
  return {
    expeditionId: "exp-rescue-salvage",
    outcome: "success",
    destinationId: "black-mine",
    destinationName: "黒爪の廃坑",
    rescueTargetId: "rescue-exp-missing-mira",
    rescueCompanionId: "mira",
    rescueCompanionName: "ミラ",
    rescueResolved: true,
    loot: [],
    log: [{ minute: 106, type: "rescue", text: "ミラを救助した。", causes: ["rescue-exp-missing-mira", "mira", "rescued"] }],
    ...overrides,
  };
}

function expedition(policyId = "greedy") {
  return {
    inputs: {
      destinationId: "black-mine",
      companionIds: ["ed"],
      equipmentIds: ["old-knife"],
      policyId,
      objective: "explore",
      rescueTargetId: "rescue-exp-missing-mira",
      rescueCompanionId: "mira",
      rescueCompanionName: "ミラ",
    },
  };
}

test("greedy successful rescue adds one abandoned pack and explains the tradeoff", () => {
  const value = report();
  salvage.decorateReport(value, expedition("greedy"));

  assert.equal(value.rescueSalvaged, true);
  assert.equal(value.loot.filter((item) => item.id === salvage.RESCUE_SALVAGE_LOOT_ID).length, 1);
  const entry = value.log.find((item) => item.type === "rescue-salvage");
  assert.ok(entry);
  assert.match(entry.text, /置き去り.*荷.*危険/);
  assert.ok(entry.causes.includes("greedy"));
  assert.equal(value.notableEvent, entry);
});

test("standard and cautious rescue do not salvage the abandoned pack", () => {
  for (const policyId of ["standard", "cautious"]) {
    const value = report();
    salvage.decorateReport(value, expedition(policyId));
    assert.equal(value.rescueSalvaged, false);
    assert.equal(value.loot.some((item) => item.id === salvage.RESCUE_SALVAGE_LOOT_ID), false);
    assert.equal(value.log.some((item) => item.type === "rescue-salvage"), false);
  }
});

test("failed or unresolved rescue never earns salvage", () => {
  const failed = report({ outcome: "failed", rescueResolved: false });
  salvage.decorateReport(failed, expedition("greedy"));
  assert.equal(failed.rescueSalvaged, false);
  assert.equal(failed.loot.length, 0);

  const unresolved = report({ rescueResolved: false });
  salvage.decorateReport(unresolved, expedition("greedy"));
  assert.equal(unresolved.rescueSalvaged, false);
  assert.equal(unresolved.loot.length, 0);
});

test("report decoration and state application are idempotent per expedition", () => {
  const value = report();
  salvage.decorateReport(value, expedition("greedy"));
  salvage.decorateReport(value, expedition("greedy"));
  const state = system.initialState();

  salvage.applyState(state, value);
  salvage.applyState(state, value);

  assert.equal(value.loot.filter((item) => item.id === salvage.RESCUE_SALVAGE_LOOT_ID).length, 1);
  assert.equal(value.log.filter((item) => item.type === "rescue-salvage").length, 1);
  assert.equal(state.securedLoot.filter((item) => item.id === salvage.RESCUE_SALVAGE_LOOT_ID && item.sourceExpeditionId === value.expeditionId).length, 1);
});

test("browser bridge loads rescue salvage after rescue stabilization", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-rescue-salvage\.js/);
  assert.match(bridgeSource, /loadRescueSalvage/);
  assert.ok(bridgeSource.indexOf("api.loadRescueStabilization(root)") < bridgeSource.indexOf("api.loadRescueSalvage(root)"));
});
