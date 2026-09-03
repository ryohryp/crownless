"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const opportunities = require("../src/expedition-party-opportunities.js");

function expedition(overrides = {}) {
  return {
    id: "exp-coordinated-hunt",
    inputs: {
      destinationId: "ashen-wood",
      companionIds: ["mira", "ed"],
      equipmentIds: [],
      policyId: "standard",
      objective: "hunt",
      ...overrides,
    },
  };
}

function successfulReport(overrides = {}) {
  return {
    expeditionId: "exp-coordinated-hunt",
    outcome: "success",
    destinationId: "ashen-wood",
    loot: [],
    log: [
      { minute: 80, time: "08:00", type: "combat-encounter", text: "灰狼の群れと遭遇した。", causes: [] },
      { minute: 90, time: "08:10", type: "combat-victory", text: "灰狼の群れを退けた。", causes: [] },
    ],
    ...overrides,
  };
}

test("Mira and Ed unlock the coordinated hunt reward exactly once", () => {
  const report = successfulReport();
  const exp = expedition();

  opportunities.applyCoordinatedHunt(report, exp);
  opportunities.applyCoordinatedHunt(report, exp);

  assert.equal(report.partyOpportunity.id, "mira-ed-coordinated-hunt");
  assert.equal(report.loot.filter((item) => item.id === "coordinated-hunt-alpha-hide").length, 1);
  assert.equal(report.log.filter((entry) => entry.type === "party-opportunity").length, 1);
  assert.match(report.log.find((entry) => entry.type === "party-opportunity").text, /ミラ.*エド.*二人/);
});

test("coordinated hunt stays locked unless party, place, objective, victory and outcome all match", () => {
  const cases = [
    [successfulReport(), expedition({ companionIds: ["mira"] })],
    [successfulReport(), expedition({ companionIds: ["mira", "sella"] })],
    [successfulReport(), expedition({ objective: "explore" })],
    [successfulReport(), expedition({ objective: "scavenge" })],
    [successfulReport({ destinationId: "black-mine" }), expedition({ destinationId: "black-mine" })],
    [successfulReport({ outcome: "early-return" }), expedition()],
    [successfulReport({ outcome: "failed" }), expedition()],
    [successfulReport({ log: [{ minute: 90, type: "combat-retreat", text: "撤退した。", causes: [] }] }), expedition()],
  ];

  for (const [report, exp] of cases) {
    opportunities.applyCoordinatedHunt(report, exp);
    assert.equal(report.partyOpportunity, undefined);
    assert.equal(report.loot.some((item) => item.id === "coordinated-hunt-alpha-hide"), false);
  }
});

test("party opportunity reward is secured idempotently", () => {
  const state = system.initialState();
  const report = opportunities.applyCoordinatedHunt(successfulReport(), expedition());

  opportunities.persistPartyOpportunityReward(state, report);
  opportunities.persistPartyOpportunityReward(state, report);

  const secured = state.securedLoot.filter((item) => item.id === "coordinated-hunt-alpha-hide");
  assert.equal(secured.length, 1);
  assert.equal(secured[0].sourceExpeditionId, report.expeditionId);
});

test("installed hook exposes a real coordinated hunt through report and secured loot", () => {
  const wrapped = { ...system };
  opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  let selected = null;

  for (let seed = 1; seed <= 300 && !selected; seed += 1) {
    const startedAt = 1_000_000 + seed;
    const state = wrapped.dispatchExpedition(wrapped.initialState(), {
      destinationId: "ashen-wood",
      companionIds: ["mira", "ed"],
      equipmentIds: ["shortbow"],
      policyId: "standard",
      objective: "hunt",
      seed,
      durationMs: 0,
    }, startedAt);
    const report = wrapped.resolveExpedition(state.activeExpedition, state);
    if (report.partyOpportunity) selected = { state, report };
  }

  assert.ok(selected, "expected at least one successful coordinated hunt");
  assert.equal(selected.report.partyOpportunity.id, "mira-ed-coordinated-hunt");
  assert.ok(selected.report.loot.some((item) => item.id === "coordinated-hunt-alpha-hide"));

  const once = wrapped.applyReport(selected.state, selected.report);
  const twice = wrapped.applyReport(once, selected.report);
  assert.equal(twice.securedLoot.filter((item) => item.id === "coordinated-hunt-alpha-hide").length, 1);
});

test("browser bridge loads the party opportunity sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-party-opportunities\.js/);
  assert.match(bridgeSource, /loadPartyOpportunities/);
});
