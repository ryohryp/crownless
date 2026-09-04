"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const policy = require("../src/expedition-bandit-policy.js");
const followups = require("../src/expedition-followup-destinations.js");

function expedition(policyId = "standard") {
  return {
    id: "exp-bandit",
    inputs: {
      destinationId: policy.BANDIT_DESTINATION_ID,
      companionIds: ["mira"],
      equipmentIds: ["shortbow"],
      policyId,
      objective: "explore"
    }
  };
}

function banditReport() {
  return {
    expeditionId: "exp-bandit",
    destinationId: policy.BANDIT_DESTINATION_ID,
    outcome: "success",
    loot: [{ id: "iron-scrap", name: "鉄屑", count: 1 }],
    signalEncounter: {
      id: "roadside-bandit-ambush",
      kind: "bandit-ambush",
      signalSource: "bandit-ambush",
      aid: { id: policy.BANDIT_REPEL_AID_ID, outcome: "repelled" }
    },
    log: [
      {
        minute: 90,
        time: "08:00",
        type: "signal-encounter",
        text: "街道の物陰から盗賊が現れた。遠征隊は交戦し、盗賊を撃退して街道の安全を確保した。",
        causes: ["roadside-bandit-ambush", "bandit-ambush", "roadside-signal"]
      },
      {
        minute: 91,
        time: "08:00",
        type: "signal-aid",
        text: "備えていた武器と武勇で盗賊を完全に打ち負かした。",
        causes: [policy.BANDIT_REPEL_AID_ID, "bandit-repelled"]
      }
    ]
  };
}

function banditState() {
  const state = system.initialState();
  state.destinations.push({
    id: policy.BANDIT_DESTINATION_ID,
    name: "街道の物陰",
    family: "forest",
    dangerTags: ["bandit"],
    opportunityTags: ["road"],
    durationMs: 180000
  });
  state.discoveredDestinationIds.push(policy.BANDIT_DESTINATION_ID);
  return state;
}

function alertReport(policyId = "standard") {
  return {
    expeditionId: `exp-alert-${policyId}`,
    destinationId: policy.BANDIT_ALERT_DESTINATION_ID,
    destinationName: "警戒を固めた盗賊の街道",
    companionIds: ["mira"],
    policyId,
    policyName: policyId,
    outcome: "success",
    loot: [],
    injuries: [],
    discoveries: [],
    log: [{ minute: 110, type: "return", text: "灰炉へ帰還した。", causes: ["returned"] }]
  };
}

test("cautious policy scouts the bandits instead of claiming a repelled encounter", () => {
  const report = banditReport();
  policy.applyBanditPolicy(report, expedition("cautious"));

  assert.equal(report.signalEncounter.approach.outcome, "scouted");
  assert.equal(report.signalEncounter.aid, undefined);
  assert.equal(report.loot.some((item) => item.id === "iron-scrap"), false);
  assert.match(report.log.find((entry) => entry.type === "signal-encounter").text, /交戦せず.*人数と見張り位置/);
  assert.match(report.log.find((entry) => entry.type === "signal-intel").text, /少人数.*迂回路/);
  assert.equal(report.log.some((entry) => entry.type === "signal-aid"), false);
  assert.equal(report.notableEvent.type, "signal-intel");
});

test("cautious scouting creates a structured route discovery that unlocks a follow-up expedition", () => {
  const report = banditReport();
  policy.applyBanditPolicy(report, expedition("cautious"));

  const discovery = report.discoveries.find((item) => item.id === policy.BANDIT_ROUTE_DISCOVERY_ID);
  assert.ok(discovery);
  assert.equal(discovery.kind, "route");
  assert.equal(discovery.sourceDestinationId, policy.BANDIT_DESTINATION_ID);
  assert.match(discovery.detail, /見張り.*経路.*次の遠征/);

  const state = {
    destinations: [
      {
        id: policy.BANDIT_DESTINATION_ID,
        name: "街道の物陰",
        family: "forest",
        dangerTags: ["bandits"],
        opportunityTags: ["road"],
        durationMs: 180000
      }
    ],
    discoveredDestinationIds: [policy.BANDIT_DESTINATION_ID]
  };
  followups.unlockFollowupDestinations(state, report);

  const followupId = followups.followupDestinationId(policy.BANDIT_DESTINATION_ID);
  assert.ok(state.discoveredDestinationIds.includes(followupId));
  assert.ok(state.destinations.some((item) => item.id === followupId && item.followupDiscoveryId === policy.BANDIT_ROUTE_DISCOVERY_ID));
  assert.ok(report.log.some((entry) => entry.type === "followup-unlocked" && entry.causes.includes(followupId)));
});

test("cautious policy application is idempotent", () => {
  const report = banditReport();
  const exp = expedition("cautious");
  policy.applyBanditPolicy(report, exp);
  policy.applyBanditPolicy(report, exp);

  assert.equal(report.log.filter((entry) => entry.type === "signal-intel").length, 1);
  assert.equal(report.loot.filter((item) => item.id === "iron-scrap").length, 0);
  assert.equal(report.discoveries.filter((item) => item.id === policy.BANDIT_ROUTE_DISCOVERY_ID).length, 1);
});

test("greedy policy pursues fleeing bandits for one extra carried reward", () => {
  const report = banditReport();
  policy.applyBanditPolicy(report, expedition("greedy"));

  assert.equal(report.signalEncounter.approach.outcome, "pursued");
  assert.equal(report.signalEncounter.approach.policyId, "greedy");
  assert.equal(report.signalEncounter.aid.outcome, "repelled");
  assert.ok(report.loot.some((item) => item.id === "iron-scrap"));
  assert.equal(report.loot.filter((item) => item.id === policy.BANDIT_PURSUIT_LOOT_ID).length, 1);
  assert.match(report.log.find((entry) => entry.type === "signal-encounter").text, /強欲方針.*追った/);
  assert.match(report.log.find((entry) => entry.type === "signal-pursuit").text, /深追い.*持ち帰る物が増えた/);
  assert.equal(report.notableEvent.type, "signal-pursuit");
});

test("greedy pursuit application is idempotent", () => {
  const report = banditReport();
  const exp = expedition("greedy");
  policy.applyBanditPolicy(report, exp);
  policy.applyBanditPolicy(report, exp);

  assert.equal(report.loot.filter((item) => item.id === policy.BANDIT_PURSUIT_LOOT_ID).length, 1);
  assert.equal(report.log.filter((entry) => entry.type === "signal-pursuit").length, 1);
});

test("standard policy preserves the existing bandit combat result", () => {
  const report = banditReport();
  const before = JSON.stringify(report);
  policy.applyBanditPolicy(report, expedition("standard"));

  assert.equal(JSON.stringify(report), before);
  assert.equal(report.signalEncounter.aid.outcome, "repelled");
  assert.ok(report.loot.some((item) => item.id === "iron-scrap"));
  assert.equal(Array.isArray(report.discoveries), false);
});

test("unrelated successful expeditions are untouched", () => {
  const report = banditReport();
  const exp = expedition("cautious");
  exp.inputs.destinationId = "ashen-wood";
  const before = JSON.stringify(report);
  policy.applyBanditPolicy(report, exp);
  assert.equal(JSON.stringify(report), before);
});

test("retreating from the bandit signal makes the bandits alert and leaves a real retry destination", () => {
  const state = banditState();
  const report = {
    expeditionId: "exp-bandit-retreat",
    destinationId: policy.BANDIT_DESTINATION_ID,
    destinationName: "街道の物陰",
    policyId: "cautious",
    outcome: "early-return",
    log: [{ minute: 110, type: "return", text: "予定より早く灰炉へ戻った。", causes: ["early return"] }]
  };

  policy.applyBanditWorldResponse(state, report);
  policy.applyBanditWorldResponse(state, report);

  const alert = state.destinations.find((item) => item.id === policy.BANDIT_ALERT_DESTINATION_ID);
  assert.ok(alert);
  assert.equal(alert.banditWorldState, "alerted");
  assert.ok(alert.dangerTags.includes("alerted"));
  assert.ok(state.discoveredDestinationIds.includes(alert.id));
  assert.equal(report.worldChanges.filter((item) => item.id === policy.BANDIT_ALERT_CAUSE_ID).length, 1);
  assert.equal(report.log.filter((entry) => entry.type === "world-shift" && entry.causes.includes(policy.BANDIT_ALERT_CAUSE_ID)).length, 1);
  assert.match(report.notableEvent.text, /撤退を見た盗賊.*見張り/);
});

test("the alerted bandit state is a dispatchable destination in the existing expedition loop", () => {
  const state = banditState();
  const failed = { expeditionId: "exp-bandit-failed", destinationId: policy.BANDIT_DESTINATION_ID, outcome: "failed", log: [] };
  policy.applyBanditWorldResponse(state, failed);

  const dispatched = system.dispatchExpedition(state, {
    id: "exp-counter-bandit",
    destinationId: policy.BANDIT_ALERT_DESTINATION_ID,
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "cautious",
    objective: "explore",
    durationMs: 0,
    seed: 44
  }, 1000);

  assert.equal(dispatched.activeExpedition.id, "exp-counter-bandit");
  assert.equal(dispatched.activeExpedition.inputs.destinationId, policy.BANDIT_ALERT_DESTINATION_ID);
});

test("cautious success against alerted bandits retires the alert and opens a blind-route expedition", () => {
  const state = banditState();
  policy.applyBanditWorldResponse(state, { expeditionId: "failed", destinationId: policy.BANDIT_DESTINATION_ID, outcome: "failed", log: [] });
  const report = alertReport("cautious");

  policy.applyBanditWorldResponse(state, report);
  policy.applyBanditWorldResponse(state, report);

  assert.equal(state.destinations.some((item) => item.id === policy.BANDIT_ALERT_DESTINATION_ID), false);
  const branch = state.destinations.find((item) => item.id === policy.BANDIT_ALERT_CAUTIOUS_DESTINATION_ID);
  assert.ok(branch);
  assert.ok(branch.opportunityTags.includes("intel"));
  assert.ok(state.discoveredDestinationIds.includes(branch.id));
  assert.equal(report.log.filter((entry) => entry.type === "world-shift" && entry.causes.includes("bandit-alert-cautious-branch")).length, 1);
  assert.match(report.notableEvent.text, /見張りの交代.*脇道/);
});

test("greedy success against alerted bandits opens the moving supply trail instead", () => {
  const state = banditState();
  policy.applyBanditWorldResponse(state, { expeditionId: "failed", destinationId: policy.BANDIT_DESTINATION_ID, outcome: "failed", log: [] });
  const report = alertReport("greedy");

  policy.applyBanditWorldResponse(state, report);

  assert.equal(state.destinations.some((item) => item.id === policy.BANDIT_ALERT_DESTINATION_ID), false);
  const branch = state.destinations.find((item) => item.id === policy.BANDIT_ALERT_GREEDY_DESTINATION_ID);
  assert.ok(branch);
  assert.ok(branch.opportunityTags.includes("salvage"));
  assert.equal(state.destinations.some((item) => item.id === policy.BANDIT_ALERT_CAUTIOUS_DESTINATION_ID), false);
  assert.match(report.notableEvent.text, /荷車.*戦利品/);
});

test("standard success clears the alerted bandit state without creating a side lead", () => {
  const state = banditState();
  policy.applyBanditWorldResponse(state, { expeditionId: "failed", destinationId: policy.BANDIT_DESTINATION_ID, outcome: "early-return", log: [] });
  const report = alertReport("standard");

  policy.applyBanditWorldResponse(state, report);

  assert.equal(state.destinations.some((item) => item.id === policy.BANDIT_ALERT_DESTINATION_ID), false);
  assert.equal(state.destinations.some((item) => item.id === policy.BANDIT_ALERT_CAUTIOUS_DESTINATION_ID), false);
  assert.equal(state.destinations.some((item) => item.id === policy.BANDIT_ALERT_GREEDY_DESTINATION_ID), false);
  assert.match(report.notableEvent.text, /盗賊を退かせた.*解消/);
});

test("non-bandit failures do not create an alerted bandit world state", () => {
  const state = banditState();
  const report = { expeditionId: "exp-other", destinationId: "ashen-wood", outcome: "failed", log: [] };
  const before = JSON.stringify(state);

  policy.applyBanditWorldResponse(state, report);

  assert.equal(JSON.stringify(state), before);
  assert.equal(report.worldChanges, undefined);
});

test("browser bridge loads the bandit policy sidecar after signal encounters", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(source, /src\/expedition-bandit-policy\.js/);
  assert.ok(source.indexOf("loadSignalEncounters(root)") < source.indexOf("loadBanditPolicy(root)"));
});