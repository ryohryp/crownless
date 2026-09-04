"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const appraisal = require("../src/expedition-loot-appraisal.js");

function state(overrides = {}) {
  return {
    destinations: [
      { id: "bandit-road", name: "荒れた街道", dangerTags: ["bandit"], opportunityTags: [], durationMs: 1000 },
      { id: "quiet-wood", name: "静かな森", dangerTags: ["beast"], opportunityTags: [], durationMs: 1000 },
    ],
    securedLoot: [],
    discoveredDestinationIds: ["bandit-road", "quiet-wood"],
    completedReports: [],
    ...overrides,
  };
}

function expedition(destinationId = "bandit-road") {
  return { id: "exp-1", inputs: { destinationId } };
}

test("successful bandit expedition returns a marked clue loot", () => {
  const current = state();
  const report = { expeditionId: "exp-1", outcome: "success", loot: [], log: [] };
  appraisal.decorateMarkedLoot(report, expedition(), current);

  assert.equal(report.loot.some((item) => item.id === appraisal.MARKED_LOOT.id), true);
  assert.equal(report.lootAppraisalLead.status, "unappraised");
  assert.equal(report.log.some((entry) => entry.type === "clue-loot"), true);
});

test("non-bandit or unsuccessful expedition does not create appraisal loot", () => {
  const current = state();
  const forestReport = { expeditionId: "exp-forest", outcome: "success", loot: [], log: [] };
  appraisal.decorateMarkedLoot(forestReport, expedition("quiet-wood"), current);
  assert.equal(forestReport.loot.length, 0);

  const failedReport = { expeditionId: "exp-fail", outcome: "failed", loot: [], log: [] };
  appraisal.decorateMarkedLoot(failedReport, expedition(), current);
  assert.equal(failedReport.loot.length, 0);
});

test("marked loot is persisted once and remains available for appraisal", () => {
  const current = state();
  const report = {
    expeditionId: "exp-1",
    outcome: "success",
    loot: [{ id: appraisal.MARKED_LOOT.id, name: appraisal.MARKED_LOOT.name, tags: [...appraisal.MARKED_LOOT.tags] }],
  };
  appraisal.persistMarkedLoot(current, report);
  appraisal.persistMarkedLoot(current, report);

  assert.equal(current.securedLoot.filter((item) => item.id === appraisal.MARKED_LOOT.id).length, 1);
  assert.equal(appraisal.unappraisedMarkedLoot(current).sourceExpeditionId, "exp-1");
});

test("Marco appraisal unlocks the trade-route lead and records who read it", () => {
  const current = state({
    securedLoot: [{ id: appraisal.MARKED_LOOT.id, name: appraisal.MARKED_LOOT.name, tags: [...appraisal.MARKED_LOOT.tags] }],
  });
  const next = appraisal.appraiseMarkedLoot(current, "marco");

  assert.notEqual(next, current);
  assert.equal(next.securedLoot[0].appraisedBy, "marco");
  assert.equal(next.lastLootAppraisal.npcName, "マルコ");
  assert.equal(next.destinations.some((item) => item.id === "bandit-toll-backroad"), true);
  assert.equal(next.discoveredDestinationIds.includes("bandit-toll-backroad"), true);
  assert.equal(current.destinations.some((item) => item.id === "bandit-toll-backroad"), false);
});

test("Edgar appraisal unlocks a different weapon-repair lead", () => {
  const current = state({
    securedLoot: [{ id: appraisal.MARKED_LOOT.id, name: appraisal.MARKED_LOOT.name, tags: [...appraisal.MARKED_LOOT.tags] }],
  });
  const next = appraisal.appraiseMarkedLoot(current, "edgar");

  assert.equal(next.securedLoot[0].appraisedBy, "edgar");
  assert.equal(next.destinations.some((item) => item.id === "bandit-repair-shelter"), true);
  assert.equal(next.destinations.some((item) => item.id === "bandit-toll-backroad"), false);
});

test("appraisal is a one-time decision; re-appraisal cannot unlock both leads", () => {
  const current = state({
    securedLoot: [{ id: appraisal.MARKED_LOOT.id, name: appraisal.MARKED_LOOT.name, tags: [...appraisal.MARKED_LOOT.tags] }],
  });
  const afterMarco = appraisal.appraiseMarkedLoot(current, "marco");
  const afterEdgar = appraisal.appraiseMarkedLoot(afterMarco, "edgar");

  assert.equal(afterEdgar, afterMarco);
  assert.equal(afterEdgar.destinations.some((item) => item.id === "bandit-toll-backroad"), true);
  assert.equal(afterEdgar.destinations.some((item) => item.id === "bandit-repair-shelter"), false);
});
