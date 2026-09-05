"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Feature = require("../src/issue352-roadside-rescue.js");

function baseState() {
  return {
    destinations: [],
    discoveredDestinationIds: [],
    completedReports: []
  };
}

function banditReport({ outcome = "success", repelled = true } = {}) {
  return {
    expeditionId: "exp-352",
    destinationId: Feature.BANDIT_DESTINATION_ID,
    outcome,
    signalEncounter: {
      id: "roadside-bandit-ambush",
      kind: "bandit-ambush",
      signalSource: Feature.BANDIT_SIGNAL_SOURCE,
      ...(repelled ? { aid: { id: "bandit-repel-aid", outcome: "repelled" } } : {})
    },
    log: []
  };
}

test("coarseCellId keeps only an existing coarse cell identifier", () => {
  assert.equal(Feature.coarseCellId({ id: "cell:35:139", latitude: 35.1, longitude: 139.2 }), "cell:35:139");
  assert.equal(Feature.coarseCellId({ latitude: 35.1, longitude: 139.2 }), "");
});

test("bandit signal stays sensed in the same coarse cell and becomes discovered after moving cells", () => {
  const first = Feature.recordScanProgress(baseState(), Feature.BANDIT_SIGNAL_SOURCE, { id: "cell:a", latitude: 35, longitude: 139 }, 100);
  assert.equal(first[Feature.INCIDENT_KEY].stage, "sensed");
  assert.equal(first[Feature.INCIDENT_KEY].anchorCellId, "cell:a");
  assert.equal(first[Feature.INCIDENT_KEY].marcoStatus, "traveling");

  const same = Feature.recordScanProgress(first, Feature.BANDIT_SIGNAL_SOURCE, { id: "cell:a" }, 200);
  assert.equal(same[Feature.INCIDENT_KEY].stage, "sensed");
  assert.equal(same[Feature.INCIDENT_KEY].marcoStatus, "traveling");

  const moved = Feature.recordScanProgress(same, Feature.BANDIT_SIGNAL_SOURCE, { id: "cell:b" }, 300);
  assert.equal(moved[Feature.INCIDENT_KEY].stage, "discovered");
  assert.equal(moved[Feature.INCIDENT_KEY].discoveredCellId, "cell:b");
  assert.equal(moved[Feature.INCIDENT_KEY].marcoStatus, "missing");
  assert.doesNotMatch(JSON.stringify(moved[Feature.INCIDENT_KEY]), /latitude|longitude|35|139/);
});

test("repelling the bandits rescues Marco and writes an idempotent report consequence", () => {
  const state = Feature.recordScanProgress(
    Feature.recordScanProgress(baseState(), Feature.BANDIT_SIGNAL_SOURCE, { id: "cell:a" }, 100),
    Feature.BANDIT_SIGNAL_SOURCE,
    { id: "cell:b" },
    200
  );
  const report = banditReport();

  Feature.applyMarcoOutcome(state, report);
  Feature.applyMarcoOutcome(state, report);

  assert.equal(state[Feature.INCIDENT_KEY].marcoStatus, "recovered");
  assert.equal(state[Feature.INCIDENT_KEY].resolved, true);
  assert.equal(report.npcOutcome.outcome, "rescued");
  assert.equal(report.log.filter((entry) => entry.type === "npc-outcome").length, 1);
  assert.equal(report.worldChanges.filter((entry) => /マルコを街道から救出/.test(entry)).length, 1);
});

test("scouting or unresolved bandit contact leaves Marco missing instead of auto-success", () => {
  const state = Feature.recordScanProgress(
    Feature.recordScanProgress(baseState(), Feature.BANDIT_SIGNAL_SOURCE, { id: "cell:a" }, 100),
    Feature.BANDIT_SIGNAL_SOURCE,
    { id: "cell:b" },
    200
  );
  const report = banditReport({ outcome: "success", repelled: false });

  Feature.applyMarcoOutcome(state, report);

  assert.equal(state[Feature.INCIDENT_KEY].marcoStatus, "missing");
  assert.equal(state[Feature.INCIDENT_KEY].resolved, false);
  assert.equal(report.npcOutcome.outcome, "missing");
  assert.match(report.worldChanges[0], /行方不明のまま/);
});

test("NPC snapshot overlay removes missing Marco from Hearth and returns him after rescue", () => {
  const snapshot = [{
    id: "marco", name: "マルコ", role: "行商人", location: "market", locationLabel: "市場",
    state: "normal", stateLabel: "普段どおり", atHearth: false, activity: ""
  }];

  const missingState = baseState();
  missingState[Feature.INCIDENT_KEY] = { marcoStatus: "missing" };
  const missing = Feature.overlaySnapshot(snapshot, missingState)[0];
  assert.equal(missing.state, "missing");
  assert.equal(missing.atHearth, false);
  assert.equal(missing.location, "north-road");

  const rescuedState = baseState();
  rescuedState[Feature.INCIDENT_KEY] = { marcoStatus: "recovered" };
  const rescued = Feature.overlaySnapshot(snapshot, rescuedState)[0];
  assert.equal(rescued.state, "recovered");
  assert.equal(rescued.atHearth, true);
  assert.equal(rescued.location, "grey-hearth");
  assert.match(rescued.activity, /救出され/);
});

test("runtime bridge loads the #352 sidecar after signal rescan support", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(source, /loadIssue352RoadsideRescue\(root\)/);
  assert.match(source, /src\/issue352-roadside-rescue\.js/);
  assert.ok(source.indexOf("loadSignalRescanFeedback(root)") < source.indexOf("loadIssue352RoadsideRescue(root)"));
});
