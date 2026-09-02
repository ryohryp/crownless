"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const rescue = require("../src/expedition-rescue.js");

function failedReport(overrides = {}) {
  return {
    expeditionId: "exp-missing",
    outcome: "failed",
    destinationId: "black-mine",
    destinationName: "黒爪の廃坑",
    companionIds: ["mira"],
    policyId: "greedy",
    policyName: "強欲",
    injuries: ["mira"],
    loot: [],
    discoveries: [],
    log: [{ minute: 110, type: "return", text: "傷ついた隊が灰炉へ運び戻された。", causes: ["defeat"] }],
    ...overrides,
  };
}

function greedySoloExpedition(overrides = {}) {
  return {
    id: "exp-missing",
    inputs: {
      destinationId: "black-mine",
      companionIds: ["mira"],
      equipmentIds: [],
      policyId: "greedy",
      objective: "explore",
      ...overrides,
    },
  };
}

test("only a non-rescue greedy solo defeat becomes missing", () => {
  assert.equal(rescue.qualifiesForMissing(failedReport(), greedySoloExpedition()), true);
  assert.equal(rescue.qualifiesForMissing(failedReport(), greedySoloExpedition({ policyId: "standard" })), false);
  assert.equal(rescue.qualifiesForMissing(failedReport(), greedySoloExpedition({ companionIds: ["mira", "ed"] })), false);
  assert.equal(rescue.qualifiesForMissing(failedReport({ outcome: "early-return" }), greedySoloExpedition()), false);
  assert.equal(rescue.qualifiesForMissing(failedReport(), greedySoloExpedition({ rescueTargetId: "rescue-old" })), false);
});

test("missing report creates a deterministic rescue opportunity without a new quest store", () => {
  const state = system.initialState();
  const report = rescue.decorateMissingReport(failedReport(), greedySoloExpedition(), state);
  rescue.applyRescueState(state, report);
  state.completedReports = [report];

  assert.equal(report.outcome, "missing");
  assert.deepEqual(report.missingCompanionIds, ["mira"]);
  assert.equal(state.companions.find((item) => item.id === "mira").condition, "missing");
  const opportunities = rescue.availableRescueOpportunities(state);
  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].companionId, "mira");
  assert.equal(opportunities[0].destinationId, "black-mine");
  assert.match(opportunities[0].id, /^rescue-exp-missing-mira$/);
});

test("successful rescue returns missing companion injured and is idempotent", () => {
  const state = system.initialState();
  state.companions.find((item) => item.id === "mira").condition = "missing";
  const report = {
    expeditionId: "exp-rescue",
    outcome: "success",
    destinationId: "black-mine",
    destinationName: "黒爪の廃坑",
    companionIds: ["ed"],
    injuries: [],
    loot: [],
    discoveries: [],
    log: [],
  };
  const expedition = {
    inputs: {
      destinationId: "black-mine",
      rescueTargetId: "rescue-exp-missing-mira",
      rescueCompanionId: "mira",
      rescueCompanionName: "ミラ",
    },
  };

  rescue.decorateRescueReport(report, expedition, state);
  rescue.applyRescueState(state, report);
  rescue.applyRescueState(state, report);

  assert.equal(report.rescueResolved, true);
  assert.deepEqual(report.rescuedCompanionIds, ["mira"]);
  assert.equal(state.companions.find((item) => item.id === "mira").condition, "injured");
  assert.equal(report.log.filter((entry) => entry.type === "rescue").length, 1);
});

test("failed rescue keeps the target missing and does not create another missing companion", () => {
  const state = system.initialState();
  state.companions.find((item) => item.id === "mira").condition = "missing";
  const report = failedReport({ expeditionId: "exp-rescue-failed", companionIds: ["ed"], injuries: ["ed"] });
  const expedition = greedySoloExpedition({
    companionIds: ["ed"],
    rescueTargetId: "rescue-exp-missing-mira",
    rescueCompanionId: "mira",
    rescueCompanionName: "ミラ",
  });

  rescue.decorateMissingReport(report, expedition, state);
  rescue.decorateRescueReport(report, expedition, state);
  rescue.applyRescueState(state, report);

  assert.equal(report.outcome, "failed");
  assert.equal(report.missingCompanionIds, undefined);
  assert.equal(report.rescueResolved, false);
  assert.equal(state.companions.find((item) => item.id === "mira").condition, "missing");
  assert.notEqual(state.companions.find((item) => item.id === "ed").condition, "missing");
});

test("installed hook completes defeat -> missing -> rescue -> injured using existing expedition flow", () => {
  const wrapped = { ...system, __objectiveChoiceInstalled: true, __equipmentOpportunitiesInstalled: true };
  const root = { document: { querySelector: () => null }, CrownlessExpeditionSystem: wrapped };
  assert.equal(rescue.installSystemHooks(root), true);

  let missingState = null;
  let missingReport = null;
  for (let seed = 1; seed <= 800; seed += 1) {
    const startedAt = 1_000_000 + seed;
    const dispatched = wrapped.dispatchExpedition(wrapped.initialState(), {
      destinationId: "black-mine",
      companionIds: ["mira"],
      equipmentIds: [],
      policyId: "greedy",
      objective: "explore",
      seed,
      durationMs: 0,
    }, startedAt);
    const completed = wrapped.advance(dispatched, startedAt);
    if (completed.report && completed.report.outcome === "missing") {
      missingState = completed.state;
      missingReport = completed.report;
      break;
    }
  }

  assert.ok(missingState, "expected at least one deterministic greedy solo defeat seed");
  assert.equal(missingState.companions.find((item) => item.id === "mira").condition, "missing");
  const target = rescue.availableRescueOpportunities(missingState)[0];
  assert.ok(target);
  assert.equal(target.sourceExpeditionId, missingReport.expeditionId);

  let rescued = null;
  for (let seed = 1; seed <= 800; seed += 1) {
    const candidate = JSON.parse(JSON.stringify(missingState));
    const startedAt = 2_000_000 + seed;
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
  assert.equal(rescued.state.companions.find((item) => item.id === "mira").condition, "injured");
  assert.equal(rescue.availableRescueOpportunities(rescued.state).length, 0);
  const rescueLog = rescued.report.log.find((entry) => entry.type === "rescue");
  assert.ok(rescueLog);
  assert.match(rescueLog.text, /発見.*連れ帰/);
});

test("browser bridge loads the rescue sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-rescue\.js/);
  assert.match(bridgeSource, /loadRescueLoop/);
});