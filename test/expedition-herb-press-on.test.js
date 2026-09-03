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

function dispatch(system, seed, equipmentIds, policyId = "greedy", destinationId = "black-mine", companionIds = ["mira"]) {
  return system.dispatchExpedition(system.initialState(), {
    destinationId,
    companionIds,
    equipmentIds,
    policyId,
    objective: "explore",
    seed,
    durationMs: 0,
  }, 1_000_000);
}

function findRetreatSeed(system) {
  const destinations = ["black-mine", "ash-forest", "old-road"];
  const companions = [["mira"], ["ed"], ["sella"]];
  for (const destinationId of destinations) {
    for (const companionIds of companions) {
      for (let seed = 1; seed <= 10_000; seed += 1) {
        let state;
        try {
          state = dispatch(system, seed, ["herb-kit"], "greedy", destinationId, companionIds);
        } catch (_error) {
          continue;
        }
        const report = system.resolveExpedition(state.activeExpedition, state);
        const encounters = report.combat && report.combat.encounters || [];
        const first = encounters[0];
        if (report.outcome === "early-return"
          && encounters.length === 1
          && first
          && first.result === "retreat"
          && first.hpAfter > 0) {
          return { seed, destinationId, companionIds };
        }
      }
    }
  }
  return null;
}

test("greedy expedition can spend herb-kit once to press past a reachable combat retreat", () => {
  const baseline = freshSystem();
  const fixture = findRetreatSeed(baseline);
  assert.notEqual(fixture, null, "expected a deterministic greedy combat-retreat seed with herb-kit");

  const baselineState = dispatch(baseline, fixture.seed, ["herb-kit"], "greedy", fixture.destinationId, fixture.companionIds);
  const baselineReport = baseline.resolveExpedition(baselineState.activeExpedition, baselineState);
  const baselineCombat = baselineReport.combat.encounters[0];
  assert.equal(baselineCombat.result, "retreat");

  const wrapped = freshSystem();
  opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  const state = dispatch(wrapped, fixture.seed, ["herb-kit"], "greedy", fixture.destinationId, fixture.companionIds);
  const report = wrapped.resolveExpedition(state.activeExpedition, state);
  const extendedCombat = report.combat.encounters[0];

  assert.equal(report.supplyOpportunity.id, "herb-press-on");
  assert.equal(report.supplyOpportunity.spent, true);
  assert.ok(extendedCombat.rounds.length > baselineCombat.rounds.length);
  assert.equal(report.log.filter((entry) => entry.type === "supply-use").length, 1);
  assert.match(report.log.find((entry) => entry.type === "supply-use").text, /薬草包み.*撤退判断/);
});

test("press-on branch is not available without herb-kit or outside greedy policy", () => {
  const baseline = freshSystem();
  const fixture = findRetreatSeed(baseline);
  assert.notEqual(fixture, null);

  for (const [equipmentIds, policyId] of [
    [[], "greedy"],
    [["old-knife"], "greedy"],
    [["herb-kit"], "cautious"],
    [["herb-kit"], "standard"],
  ]) {
    const wrapped = freshSystem();
    opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
    let state;
    try {
      state = dispatch(wrapped, fixture.seed, equipmentIds, policyId, fixture.destinationId, fixture.companionIds);
    } catch (_error) {
      continue;
    }
    const report = wrapped.resolveExpedition(state.activeExpedition, state);
    assert.equal(report.supplyOpportunity, undefined);
    assert.equal(report.log.some((entry) => entry.type === "supply-use"), false);
  }
});

test("advance applies the extended report exactly once and keeps deterministic re-resolution", () => {
  const baseline = freshSystem();
  const fixture = findRetreatSeed(baseline);
  assert.notEqual(fixture, null);

  const wrapped = freshSystem();
  opportunities.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  const state = dispatch(wrapped, fixture.seed, ["herb-kit"], "greedy", fixture.destinationId, fixture.companionIds);
  const previewA = wrapped.resolveExpedition(state.activeExpedition, state);
  const previewB = wrapped.resolveExpedition(state.activeExpedition, state);
  assert.deepEqual(previewB, previewA);

  const completed = wrapped.advance(state, 1_000_000);
  assert.equal(completed.status, "completed");
  assert.equal(completed.report.supplyOpportunity.id, "herb-press-on");
  assert.equal(completed.state.completedReports.filter((item) => item.expeditionId === completed.report.expeditionId).length, 1);
  assert.equal(completed.state.appliedExpeditionIds.filter((id) => id === completed.report.expeditionId).length, 1);
});
