"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const leader = require("../src/expedition-leader.js");

function expedition(leaderId, objective, companionIds = ["mira", "ed"]) {
  return { inputs: { leaderId, objective, companionIds } };
}

function report(overrides = {}) {
  return {
    expeditionId: "exp-leader-test",
    destinationId: "ashen-wood",
    outcome: "success",
    loot: [],
    discoveries: [],
    combat: { encounters: [{ encounterId: "wolves", encounterName: "灰狼の群れ", result: "victory" }] },
    log: [{ minute: 90, time: "08:10", type: "combat-victory", text: "勝利" }],
    ...overrides,
  };
}

test("mira leading explore creates a visible route clue and causal report log", () => {
  const value = report();
  leader.applyLeaderOutcome(value, expedition("mira", "explore"));
  assert.equal(value.leaderName, "ミラ");
  assert.equal(value.leaderOutcome.objectiveId, "explore");
  assert.ok(value.discoveries.some((item) => item.kind === "leader-route-clue"));
  assert.ok(value.log.some((entry) => entry.type === "leader-outcome" && entry.causes.includes("leader:mira")));

  const discoveryCount = value.discoveries.length;
  const logCount = value.log.length;
  leader.applyLeaderOutcome(value, expedition("mira", "explore"));
  assert.equal(value.discoveries.length, discoveryCount);
  assert.equal(value.log.length, logCount);
});

test("ed leading a victorious hunt brings back an idempotent trophy", () => {
  const value = report();
  leader.applyLeaderOutcome(value, expedition("ed", "hunt"));
  const trophy = value.loot.find((item) => item.tags.includes("leader-outcome"));
  assert.ok(trophy);
  assert.match(trophy.name, /討伐証/);

  const state = { securedLoot: [] };
  leader.persistLeaderRewards(state, value);
  leader.persistLeaderRewards(state, value);
  assert.equal(state.securedLoot.filter((item) => item.id === trophy.id).length, 1);
  assert.equal(state.securedLoot[0].sourceExpeditionId, value.expeditionId);
});

test("sella leading scavenge creates extra valuable loot", () => {
  const value = report({ combat: { encounters: [] }, log: [] });
  leader.applyLeaderOutcome(value, expedition("sella", "scavenge", ["sella", "mira"]));
  const cache = value.loot.find((item) => item.id === "leader-scavenge-cache-ashen-wood");
  assert.ok(cache);
  assert.ok(cache.tags.includes("valuable"));
  assert.ok(value.log.some((entry) => entry.causes.includes("leader:sella")));
});

test("leader bonus does not trigger for a solo party, mismatched objective, failure, or hunt without victory", () => {
  const solo = report();
  leader.applyLeaderOutcome(solo, expedition("mira", "explore", ["mira"]));
  assert.equal(solo.leaderOutcome, undefined);

  const mismatch = report();
  leader.applyLeaderOutcome(mismatch, expedition("mira", "hunt"));
  assert.equal(mismatch.leaderOutcome, undefined);

  const failed = report({ outcome: "failure" });
  leader.applyLeaderOutcome(failed, expedition("sella", "scavenge", ["sella", "mira"]));
  assert.equal(failed.leaderOutcome, undefined);

  const noVictory = report({ combat: { encounters: [{ encounterId: "wolves", result: "retreat" }] }, log: [] });
  leader.applyLeaderOutcome(noVictory, expedition("ed", "hunt"));
  assert.equal(noVictory.leaderOutcome, undefined);
});
