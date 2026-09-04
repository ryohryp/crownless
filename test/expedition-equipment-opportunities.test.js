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

function geographicRoadState() {
  const state = system.initialState();
  state.destinations.push({
    id: "world:aoto-road",
    name: "青砥街道",
    family: "village",
    dangerTags: ["bandit"],
    opportunityTags: ["tracks", "rumor"],
    durationMs: 0,
    geographic: true,
  });
  state.discoveredDestinationIds.push("world:aoto-road");
  return state;
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

test("successful geographic road expedition returns a regional cloak that becomes prepare equipment", () => {
  const state = geographicRoadState();
  const exp = expedition({ destinationId: "world:aoto-road", equipmentIds: [], objective: "explore" });
  const report = successfulReport({
    expeditionId: exp.id,
    destinationId: "world:aoto-road",
    log: [{ minute: 104, time: "08:00", type: "discovery", text: "街道を調べた", causes: [] }],
  });

  opportunities.applyRegionalRoadLoot(report, exp, state);
  opportunities.persistRegionalGear(state, report);
  opportunities.persistRegionalGear(state, report);

  const cloak = report.loot.find((item) => item.id === opportunities.REGIONAL_ROAD_CLOAK.id);
  assert.ok(cloak);
  assert.equal(cloak.affinity, "road-bandit");
  assert.equal(cloak.originDestinationId, "world:aoto-road");
  assert.equal(state.equipment.filter((item) => item.id === cloak.id).length, 1);
  assert.equal(state.securedLoot.filter((item) => item.id === cloak.id).length, 1);
  assert.match(report.log.find((entry) => entry.type === "regional-loot").text, /待ち伏せ/);
});

test("road cloak grants ambush-reading capability only on matching geographic roads", () => {
  const state = geographicRoadState();
  state.equipment.push({
    ...opportunities.REGIONAL_ROAD_CLOAK,
    tags: Array.from(opportunities.REGIONAL_ROAD_CLOAK.tags),
    originDestinationId: "world:aoto-road",
    originName: "青砥街道",
  });
  const roadExpedition = expedition({
    destinationId: "world:aoto-road",
    equipmentIds: [opportunities.REGIONAL_ROAD_CLOAK.id],
    objective: "explore",
  });
  const villageExpedition = expedition({
    destinationId: "hollow-village",
    equipmentIds: [opportunities.REGIONAL_ROAD_CLOAK.id],
    objective: "explore",
  });

  const roadState = opportunities.stateWithRegionalRoadCapability(roadExpedition, state);
  const villageState = opportunities.stateWithRegionalRoadCapability(villageExpedition, state);
  const roadGear = roadState.equipment.find((item) => item.id === opportunities.REGIONAL_ROAD_CLOAK.id);
  const villageGear = villageState.equipment.find((item) => item.id === opportunities.REGIONAL_ROAD_CLOAK.id);

  assert.ok(roadGear.tags.includes("conceal"));
  assert.equal(villageGear.tags.includes("conceal"), false);

  const report = successfulReport({ destinationId: "world:aoto-road", log: [] });
  opportunities.annotateRegionalRoadEffect(report, roadExpedition, state);
  opportunities.annotateRegionalRoadEffect(report, roadExpedition, state);
  assert.equal(report.geographicEquipmentEffect.effect, "ambush-sense");
  assert.equal(report.log.filter((entry) => entry.type === "regional-gear").length, 1);
});

test("installed hook applies the regional cloak effect during completed expedition resolution", () => {
  const wrapped = { ...system };
  opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  const startedAt = 2_000_000;
  let state = geographicRoadState();
  state.equipment.push({
    ...opportunities.REGIONAL_ROAD_CLOAK,
    tags: Array.from(opportunities.REGIONAL_ROAD_CLOAK.tags),
    originDestinationId: "world:aoto-road",
    originName: "青砥街道",
  });
  state = wrapped.dispatchExpedition(state, {
    destinationId: "world:aoto-road",
    companionIds: ["mira", "ed", "sella"],
    equipmentIds: [opportunities.REGIONAL_ROAD_CLOAK.id],
    policyId: "standard",
    objective: "explore",
    seed: 44,
    durationMs: 0,
  }, startedAt);

  const completed = wrapped.advance(state, startedAt);
  assert.equal(completed.status, "completed");
  assert.equal(completed.report.geographicEquipmentEffect.effect, "ambush-sense");
  assert.ok(completed.report.log.some((entry) => entry.type === "regional-gear"));
  assert.ok(completed.report.combat.encounters[0].causes.includes("conceal"));
});

test("browser bridge loads the equipment opportunity sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-equipment-opportunities\.js/);
  assert.match(bridgeSource, /loadEquipmentOpportunities/);
});