"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const village = require("../src/expedition-village-bell.js");

function expedition(approachId, destinationId = village.DESTINATION_ID) {
  return {
    id: `exp-${approachId}`,
    inputs: {
      destinationId,
      villageApproach: approachId,
      companionIds: ["mira"],
      policyId: "standard",
    },
  };
}

function report(outcome = "success") {
  return { expeditionId: "exp-test", outcome, discoveries: [], log: [] };
}

function state() {
  return {
    destinations: [{
      id: village.DESTINATION_ID,
      name: "空鐘の廃村",
      family: "village",
      dangerTags: ["bandit", "collapse"],
      opportunityTags: ["salvage", "rumor", "cellar"],
      durationMs: 240000,
    }],
    discoveredDestinationIds: [village.DESTINATION_ID],
    completedReports: [],
  };
}

test("ringing the village bell reveals an answering-smoke lead", () => {
  const value = report();
  village.decorateReport(value, expedition(village.RING));

  assert.equal(value.villageChoice.approachId, village.RING);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "鐘に応えた遠い煙");
  assert.match(value.log.find((entry) => entry.type === "village-choice").text, /煙/);

  const current = state();
  const unlocked = village.unlockFollowup(current, value);
  assert.equal(unlocked.name, "鐘に応えた遠い煙");
  assert.deepEqual(unlocked.opportunityTags, ["survivor", "rumor", "contact"]);
});

test("quiet search reveals a sealed cellar instead of the human-response lead", () => {
  const value = report();
  village.decorateReport(value, expedition(village.QUIET));

  assert.equal(value.villageChoice.approachId, village.QUIET);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "足音のない封鎖地下蔵");
  assert.doesNotMatch(value.discoveries[0].id, /answering-smoke/);
  assert.match(value.log.find((entry) => entry.type === "village-choice").text, /地下蔵/);
});

test("one expedition cannot produce both village branches and apply is idempotent", () => {
  const value = report();
  village.decorateReport(value, expedition(village.RING));
  village.decorateReport(value, expedition(village.RING));
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.log.filter((entry) => entry.type === "village-choice").length, 1);

  const current = state();
  village.unlockFollowup(current, value);
  village.unlockFollowup(current, value);
  assert.equal(current.destinations.filter((item) => item.id === value.villageChoice.destinationId).length, 1);
  assert.equal(current.discoveredDestinationIds.filter((id) => id === value.villageChoice.destinationId).length, 1);
});

test("failure and unrelated destinations do not create a village branch", () => {
  const failed = report("retreat");
  village.decorateReport(failed, expedition(village.RING));
  assert.equal(failed.villageChoice, undefined);
  assert.deepEqual(failed.discoveries, []);

  const unrelated = report();
  village.decorateReport(unrelated, expedition(village.RING, "ashen-wood"));
  assert.equal(unrelated.villageChoice, undefined);
  assert.deepEqual(unrelated.discoveries, []);
});

test("unknown bridge loads the village bell sidecar", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(bridge, /loadVillageBell\(root\)/);
  assert.match(bridge, /CrownlessExpeditionVillageBell/);
  assert.match(bridge, /src\/expedition-village-bell\.js/);
});