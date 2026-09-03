"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const rescue = require("../src/expedition-rescue.js");
const stabilization = require("../src/expedition-rescue-stabilization.js");

function rescueReport() {
  return {
    expeditionId: "exp-rescue",
    outcome: "success",
    destinationId: "black-mine",
    destinationName: "黒爪の廃坑",
    rescueTargetId: "rescue-exp-missing-mira",
    rescueCompanionId: "mira",
    rescueCompanionName: "ミラ",
    rescueResolved: true,
    log: [{
      minute: 106,
      type: "rescue",
      text: "ミラを発見し、負傷したまま灰炉へ連れ帰ることができた。",
      causes: ["rescue-exp-missing-mira", "mira", "rescued"],
    }],
  };
}

function rescueExpedition(equipmentIds = []) {
  return {
    inputs: {
      destinationId: "black-mine",
      companionIds: ["ed"],
      equipmentIds,
      policyId: "cautious",
      objective: "explore",
      rescueTargetId: "rescue-exp-missing-mira",
      rescueCompanionId: "mira",
      rescueCompanionName: "ミラ",
    },
  };
}

test("successful rescue with herb kit records stabilization in the report", () => {
  const report = rescueReport();
  stabilization.decorateReport(report, rescueExpedition(["herb-kit"]));

  assert.equal(report.rescueStabilized, true);
  const entry = report.log.find((item) => item.type === "rescue");
  assert.match(entry.text, /薬草包み.*応急処置/);
  assert.ok(entry.causes.includes("rescue-stabilized"));
  assert.equal(report.notableEvent, entry);
});

test("rescue without herb kit keeps the existing injured outcome", () => {
  const report = rescueReport();
  stabilization.decorateReport(report, rescueExpedition([]));
  const state = system.initialState();
  state.companions.find((item) => item.id === "mira").condition = "injured";
  stabilization.applyState(state, report);

  assert.equal(report.rescueStabilized, false);
  assert.equal(state.companions.find((item) => item.id === "mira").condition, "injured");
  assert.doesNotMatch(report.log[0].text, /薬草包み/);
});

test("failed rescue cannot be stabilized even when herb kit is carried", () => {
  const report = rescueReport();
  report.outcome = "failed";
  report.rescueResolved = false;
  stabilization.decorateReport(report, rescueExpedition(["herb-kit"]));

  assert.equal(report.rescueStabilized, false);
});

test("applying a stabilized rescue is idempotent and returns the target healthy", () => {
  const report = rescueReport();
  stabilization.decorateReport(report, rescueExpedition(["herb-kit"]));
  const state = system.initialState();
  const mira = state.companions.find((item) => item.id === "mira");
  mira.condition = "injured";

  stabilization.applyState(state, report);
  stabilization.applyState(state, report);

  assert.equal(mira.condition, "healthy");
  assert.equal(report.log.filter((item) => item.type === "rescue").length, 1);
});

test("installed hooks complete missing -> herb rescue -> healthy through the expedition flow", () => {
  const wrapped = { ...system, __objectiveChoiceInstalled: true, __equipmentOpportunitiesInstalled: true };
  const root = { document: { querySelector: () => null }, CrownlessExpeditionSystem: wrapped };
  assert.equal(rescue.installSystemHooks(root), true);
  assert.equal(stabilization.installSystemHooks(root), true);

  const missingState = wrapped.initialState();
  const mira = missingState.companions.find((item) => item.id === "mira");
  mira.condition = "missing";
  missingState.completedReports = [{
    expeditionId: "exp-missing",
    outcome: "missing",
    destinationId: "black-mine",
    destinationName: "黒爪の廃坑",
    missingCompanionIds: ["mira"],
    missingCompanionNames: ["ミラ"],
    log: [],
  }];
  const target = rescue.availableRescueOpportunities(missingState)[0];
  assert.ok(target);

  let rescued = null;
  for (let seed = 1; seed <= 800; seed += 1) {
    const candidate = JSON.parse(JSON.stringify(missingState));
    const startedAt = 2_500_000 + seed;
    const dispatched = wrapped.dispatchExpedition(candidate, {
      destinationId: target.destinationId,
      companionIds: ["ed"],
      equipmentIds: ["old-knife", "herb-kit", "shortbow"],
      policyId: "cautious",
      objective: "explore",
      rescueTargetId: target.id,
      seed,
      durationMs: 0,
    }, startedAt);
    const completed = wrapped.advance(dispatched, startedAt);
    if (completed.report && completed.report.rescueResolved) {
      rescued = completed;
      break;
    }
  }

  assert.ok(rescued, "expected at least one deterministic rescue success seed");
  assert.equal(rescued.report.rescueStabilized, true);
  assert.equal(rescued.state.companions.find((item) => item.id === "mira").condition, "healthy");
  assert.match(rescued.report.log.find((item) => item.type === "rescue").text, /薬草包み.*応急処置/);
  const stored = rescued.state.completedReports.find((item) => item.expeditionId === rescued.report.expeditionId);
  assert.equal(stored.rescueStabilized, true);
});

test("browser bridge loads rescue stabilization after the rescue sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-rescue-stabilization\.js/);
  assert.match(bridgeSource, /loadRescueStabilization/);
  assert.ok(bridgeSource.indexOf("api.loadRescueLoop(root)") < bridgeSource.indexOf("api.loadRescueStabilization(root)"));
});