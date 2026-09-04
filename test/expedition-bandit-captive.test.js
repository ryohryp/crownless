"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const captive = require("../src/expedition-bandit-captive.js");

function state(overrides = {}) {
  return {
    destinations: [],
    discoveredDestinationIds: [],
    completedReports: [],
    ...overrides,
  };
}

function banditReport(overrides = {}) {
  return {
    expeditionId: "exp-bandit-1",
    destinationId: "world:geo:signal:bandit-ambush",
    outcome: "success",
    signalEncounter: { kind: "bandit-ambush" },
    log: [],
    ...overrides,
  };
}

test("successful bandit encounter leaves one unresolved captive at the hearth", () => {
  const current = state();
  const report = banditReport();
  captive.captureScout(current, report);

  assert.equal(current.banditCaptive.id, captive.CAPTIVE_ID);
  assert.equal(current.banditCaptive.status, "unresolved");
  assert.equal(current.banditCaptiveHistory.captured, true);
  assert.equal(report.log.some((entry) => entry.type === "captive"), true);

  const secondReport = banditReport({ expeditionId: "exp-bandit-2", log: [] });
  captive.captureScout(current, secondReport);
  assert.equal(secondReport.banditCaptive, undefined);
});

test("failed or non-bandit expedition never creates a captive", () => {
  const failed = state();
  captive.captureScout(failed, banditReport({ outcome: "failed" }));
  assert.equal(failed.banditCaptive, undefined);

  const other = state();
  captive.captureScout(other, banditReport({ signalEncounter: { kind: "roadside-trader" } }));
  assert.equal(other.banditCaptive, undefined);
});

test("interrogating then releasing opens the dangerous supply route", () => {
  const current = state({ banditCaptive: { id: captive.CAPTIVE_ID, status: "unresolved" } });
  const next = captive.resolveCaptive(current, "interrogate");

  assert.notEqual(next, current);
  assert.equal(next.banditCaptive.status, "resolved");
  assert.equal(next.banditCaptive.choice, "interrogate");
  assert.equal(next.discoveredDestinationIds.includes(captive.INTERROGATE_DESTINATION.id), true);
  assert.equal(next.destinations.some((item) => item.id === captive.RELEASE_DESTINATION.id), false);
});

test("releasing immediately opens the thinner-watch route instead", () => {
  const current = state({ banditCaptive: { id: captive.CAPTIVE_ID, status: "unresolved" } });
  const next = captive.resolveCaptive(current, "release");

  assert.equal(next.banditCaptive.choice, "release");
  assert.equal(next.discoveredDestinationIds.includes(captive.RELEASE_DESTINATION.id), true);
  assert.equal(next.destinations.some((item) => item.id === captive.INTERROGATE_DESTINATION.id), false);
});

test("captive decision is exclusive and idempotent", () => {
  const current = state({ banditCaptive: { id: captive.CAPTIVE_ID, status: "unresolved" } });
  const afterInterrogate = captive.resolveCaptive(current, "interrogate");
  const afterRelease = captive.resolveCaptive(afterInterrogate, "release");

  assert.equal(afterRelease, afterInterrogate);
  assert.equal(afterRelease.discoveredDestinationIds.filter((id) => id === captive.INTERROGATE_DESTINATION.id).length, 1);
  assert.equal(afterRelease.discoveredDestinationIds.includes(captive.RELEASE_DESTINATION.id), false);
});
