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
    discoveries: [],
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

test("Mira has two-layer origin that survives save/load shaped data", () => {
  const state = system.initialState();
  opportunities.ensureGeographicOrigins(state);
  const saved = JSON.parse(JSON.stringify(state));
  opportunities.ensureGeographicOrigins(saved);
  const mira = saved.companions.find((item) => item.id === "mira");

  assert.deepEqual(mira.geographicOrigin, { region: "灰炉北辺", localArea: "灰の森" });
  assert.deepEqual(mira.geographicFamiliarity, {});
});

test("Mira local affinity reveals a route that a non-local companion does not", () => {
  assert.equal(opportunities.geographicAffinity("mira", "ashen-wood"), "local");
  assert.equal(opportunities.geographicAffinity("mira", "hollow-village"), "region");
  assert.equal(opportunities.geographicAffinity("mira", "black-mine"), "none");

  const localReport = successfulReport();
  opportunities.applyGeographicCompanion(localReport, expedition({ companionIds: ["mira"], objective: "explore" }));
  assert.equal(localReport.geographicCompanionEffect.affinity, "local");
  assert.ok(localReport.discoveries.some((item) => item.id === opportunities.MIRA_LOCAL_ROUTE.id));
  assert.match(localReport.log.find((entry) => entry.type === "geographic-companion").text, /鹿道/);

  const outsider = successfulReport();
  opportunities.applyGeographicCompanion(outsider, expedition({ companionIds: ["ed"], objective: "explore" }));
  assert.equal(outsider.geographicCompanionEffect, undefined);
  assert.equal(outsider.discoveries.some((item) => item.id === opportunities.MIRA_LOCAL_ROUTE.id), false);
});

test("regional affinity adds knowledge but does not grant the stronger local route", () => {
  const value = successfulReport({ destinationId: "hollow-village" });
  opportunities.applyGeographicCompanion(value, expedition({ destinationId: "hollow-village", companionIds: ["mira"], objective: "explore" }));

  assert.equal(value.geographicCompanionEffect.affinity, "region");
  assert.equal(value.discoveries.some((item) => item.id === opportunities.MIRA_LOCAL_ROUTE.id), false);
  assert.match(value.log.find((entry) => entry.type === "geographic-companion").text, /灰炉北辺/);
});

test("local geographic route unlock is idempotent and preserves origin on state", () => {
  const state = system.initialState();
  const value = successfulReport();
  opportunities.applyGeographicCompanion(value, expedition({ companionIds: ["mira"], objective: "explore" }));
  opportunities.unlockGeographicCompanionRoute(state, value);
  opportunities.unlockGeographicCompanionRoute(state, value);

  assert.equal(state.destinations.filter((item) => item.id === opportunities.MIRA_LOCAL_ROUTE.id).length, 1);
  assert.equal(state.discoveredDestinationIds.filter((id) => id === opportunities.MIRA_LOCAL_ROUTE.id).length, 1);
  assert.deepEqual(state.companions.find((item) => item.id === "mira").geographicOrigin, { region: "灰炉北辺", localArea: "灰の森" });
});

test("prepare hint makes local and regional party value visible before dispatch", () => {
  assert.match(opportunities.geographicPartyHint("mira", "ashen-wood"), /鹿道の抜け道/);
  assert.match(opportunities.geographicPartyHint("mira", "hollow-village"), /広域の土地勘/);
  assert.equal(opportunities.geographicPartyHint("mira", "black-mine"), "");
  assert.equal(opportunities.geographicPartyHint("ed", "ashen-wood"), "");
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
  assert.equal(selected.state.companions.find((item) => item.id === "mira").geographicOrigin.localArea, "灰の森");

  const once = wrapped.applyReport(selected.state, selected.report);
  const twice = wrapped.applyReport(once, selected.report);
  assert.equal(twice.securedLoot.filter((item) => item.id === "coordinated-hunt-alpha-hide").length, 1);
});

test("browser bridge loads the party opportunity sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-party-opportunities\.js/);
  assert.match(bridgeSource, /loadPartyOpportunities/);
});
