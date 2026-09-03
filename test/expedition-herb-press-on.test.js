"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

function freshSystem() {
  const systemPath = path.join(__dirname, "..", "src", "expedition-system.js");
  delete require.cache[require.resolve(systemPath)];
  return require(systemPath);
}

const opportunities = require("../src/expedition-equipment-opportunities.js");

function dispatch(system, seed, equipmentIds, policyId = "greedy") {
  return system.dispatchExpedition(system.initialState(), {
    destinationId: "black-mine",
    companionIds: ["mira"],
    equipmentIds,
    policyId,
    objective: "explore",
    seed,
    durationMs: 0,
  }, 1_000_000);
}

function findBoundarySeed(system) {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const state = dispatch(system, seed, ["herb-kit"]);
    const report = system.resolveExpedition(state.activeExpedition, state);
    const encounters = report.combat && report.combat.encounters || [];
    const first = encounters[0];
    if (report.outcome === "early-return"
      && encounters.length === 1
      && first
      && first.result === "victory"
      && first.hpAfter > 0
      && first.hpAfter / first.maxHp <= system.policies.greedy.retreatHpRatio) {
      return seed;
    }
  }
  return null;
}

test("greedy expedition can spend herb-kit once to press past the post-victory retreat boundary", () => {
  const baseline = freshSystem();
  const seed = findBoundarySeed(baseline);
  assert.notEqual(seed, null, "expected a deterministic seed at the greedy post-victory retreat boundary");

  const baselineState = dispatch(baseline, seed, ["herb-kit"]);
  const baselineReport = baseline.resolveExpedition(baselineState.activeExpedition, baselineState);
  assert.equal(baselineReport.outcome, "early-return");
  assert.equal(baselineReport.combat.encounters.length, 1);

  const wrapped = freshSystem();
  opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  const state = dispatch(wrapped, seed, ["herb-kit"]);
  const report = wrapped.resolveExpedition(state.activeExpedition, state);

  assert.equal(report.supplyOpportunity.id, "herb-press-on");
  assert.equal(report.supplyOpportunity.spent, true);
  assert.ok(report.combat.encounters.length >= 2);
  assert.equal(report.log.filter((entry) => entry.type === "supply-use").length, 1);
  assert.match(report.log.find((entry) => entry.type === "supply-use").text, /薬草包み.*次の遭遇/);
});

test("press-on branch is not available without herb-kit or outside greedy policy", () => {
  const baseline = freshSystem();
  const seed = findBoundarySeed(baseline);
  assert.notEqual(seed, null);

  for (const [equipmentIds, policyId] of [
    [[], "greedy"],
    [["old-knife"], "greedy"],
    [["herb-kit"], "cautious"],
    [["herb-kit"], "standard"],
  ]) {
    const wrapped = freshSystem();
    opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
    const state = dispatch(wrapped, seed, equipmentIds, policyId);
    const report = wrapped.resolveExpedition(state.activeExpedition, state);
    assert.equal(report.supplyOpportunity, undefined);
    assert.equal(report.log.some((entry) => entry.type === "supply-use"), false);
  }
});

test("advance applies the extended report exactly once and keeps deterministic re-resolution", () => {
  const baseline = freshSystem();
  const seed = findBoundarySeed(baseline);
  assert.notEqual(seed, null);

  const wrapped = freshSystem();
  opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  const state = dispatch(wrapped, seed, ["herb-kit"]);
  const previewA = wrapped.resolveExpedition(state.activeExpedition, state);
  const previewB = wrapped.resolveExpedition(state.activeExpedition, state);
  assert.deepEqual(previewB, previewA);

  const completed = wrapped.advance(state, 1_000_000);
  assert.equal(completed.status, "completed");
  assert.equal(completed.report.supplyOpportunity.id, "herb-press-on");
  assert.equal(completed.state.completedReports.filter((item) => item.expeditionId === completed.report.expeditionId).length, 1);
  assert.equal(completed.state.appliedExpeditionIds.filter((id) => id === completed.report.expeditionId).length, 1);
});
