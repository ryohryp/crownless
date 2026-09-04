"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const rescue = require("../src/expedition-rescue-salvage.js");

function state() {
  return {
    companions: [{ id: "mira", name: "ミラ", condition: "injured" }],
    destinations: [{ id: "ruins", name: "崩れた集落", family: "abandoned-village", dangerTags: ["ruins"], opportunityTags: ["salvage"], durationMs: 180000 }],
    discoveredDestinationIds: ["ruins"],
    completedReports: []
  };
}

function rescueReport() {
  return {
    expeditionId: "exp-rescue-1",
    destinationId: "ruins",
    destinationName: "崩れた集落",
    outcome: "success",
    rescueResolved: true,
    rescueCompanionId: "mira",
    rescueCompanionName: "ミラ",
    log: []
  };
}

test("successful rescue grants one available favor without duplicate stacking", () => {
  const s = state();
  const report = rescueReport();
  rescue.grantRescueFavor(s, report);
  const first = { ...s.companions[0].rescueFavor };
  rescue.grantRescueFavor(s, report);

  assert.equal(s.companions[0].rescueFavor.available, true);
  assert.equal(s.companions[0].rescueFavor.id, first.id);
  assert.equal(s.companions[0].rescueFavor.sourceReportId, "exp-rescue-1");
});

test("favor stays unused when the player does not request it", () => {
  const s = state();
  rescue.grantRescueFavor(s, rescueReport());
  const expedition = { inputs: { companionIds: ["mira"], destinationId: "ruins", policyId: "standard" } };
  const report = { expeditionId: "exp-normal", destinationId: "ruins", destinationName: "崩れた集落", outcome: "success", discoveries: [], log: [] };

  rescue.decorateFavorReport(report, expedition, s);
  rescue.applyFavorState(s, report);

  assert.equal(report.rescueFavorUsed, undefined);
  assert.equal(s.companions[0].rescueFavor.available, true);
});

test("favor use requires the rescued companion to be in the dispatched party", () => {
  const s = state();
  rescue.grantRescueFavor(s, rescueReport());
  const expedition = { inputs: { companionIds: ["edgar"], rescueFavorCompanionId: "mira", destinationId: "ruins" } };
  const report = { expeditionId: "exp-wrong-party", destinationId: "ruins", outcome: "success", discoveries: [], log: [] };

  assert.equal(rescue.qualifiesForFavorUse(report, expedition, s), false);
});

test("using a favor on a successful expedition discovers a dispatchable route and consumes it once", () => {
  const s = state();
  rescue.grantRescueFavor(s, rescueReport());
  const expedition = { inputs: { companionIds: ["mira"], rescueFavorCompanionId: "mira", destinationId: "ruins", policyId: "cautious" } };
  const report = { expeditionId: "exp-favor", destinationId: "ruins", destinationName: "崩れた集落", outcome: "success", discoveries: [], log: [] };

  rescue.decorateFavorReport(report, expedition, s);
  rescue.applyFavorState(s, report);
  rescue.applyFavorState(s, report);

  assert.ok(report.rescueFavorUsed);
  assert.match(report.notableEvent.text, /借り/);
  assert.equal(s.companions[0].rescueFavor.available, false);
  const routeId = report.rescueFavorUsed.routeId;
  assert.equal(s.destinations.filter((item) => item.id === routeId).length, 1);
  assert.ok(s.discoveredDestinationIds.includes(routeId));
  assert.equal(report.discoveries.filter((item) => item.id === routeId).length, 1);
});

test("failed expedition does not spend the favor or reveal the route", () => {
  const s = state();
  rescue.grantRescueFavor(s, rescueReport());
  const expedition = { inputs: { companionIds: ["mira"], rescueFavorCompanionId: "mira", destinationId: "ruins" } };
  const report = { expeditionId: "exp-failed", destinationId: "ruins", outcome: "failed", discoveries: [], log: [] };

  rescue.decorateFavorReport(report, expedition, s);
  rescue.applyFavorState(s, report);

  assert.equal(report.rescueFavorUsed, undefined);
  assert.equal(s.companions[0].rescueFavor.available, true);
  assert.equal(s.destinations.length, 1);
});
