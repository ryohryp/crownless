"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

test("browser bridge loads the bandit policy sidecar after signal encounters", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(source, /src\/expedition-bandit-policy\.js/);
  assert.ok(source.indexOf("loadSignalEncounters(root)") < source.indexOf("loadBanditPolicy(root)"));
});