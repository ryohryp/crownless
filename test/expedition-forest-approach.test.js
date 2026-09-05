"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const forest = require("../src/expedition-forest-approach.js");

function expedition(approachId, destinationId = forest.DESTINATION_ID) {
  return {
    id: `exp-${approachId}`,
    inputs: {
      destinationId,
      forestApproach: approachId,
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
      id: forest.DESTINATION_ID,
      name: "灰の森",
      family: "forest",
      dangerTags: ["beast", "thicket"],
      opportunityTags: ["herbs", "tracks", "ruin"],
      durationMs: 180000,
    }],
    discoveredDestinationIds: [forest.DESTINATION_ID],
    completedReports: [],
  };
}

test("following the howl reveals a riskier beast route", () => {
  const value = report();
  forest.decorateReport(value, expedition(forest.FOLLOW_HOWL));

  assert.equal(value.forestApproach.approachId, forest.FOLLOW_HOWL);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "遠吠えが集まる谷筋");
  assert.match(value.log.find((entry) => entry.type === "forest-approach").text, /巣/);

  const current = state();
  const unlocked = forest.unlockFollowup(current, value);
  assert.deepEqual(unlocked.dangerTags, ["beast", "thicket", "pack"]);
  assert.deepEqual(unlocked.opportunityTags, ["tracks", "lair", "trophy"]);
  assert.equal(unlocked.durationMs, 207000);
  assert.ok(unlocked.durationMs > current.destinations[0].durationMs);
});

test("marking the game trail reveals a shorter safer route", () => {
  const value = report();
  forest.decorateReport(value, expedition(forest.MARK_TRAIL));

  assert.equal(value.forestApproach.approachId, forest.MARK_TRAIL);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "印を残した獣道");

  const current = state();
  const unlocked = forest.unlockFollowup(current, value);
  assert.deepEqual(unlocked.dangerTags, ["thicket"]);
  assert.deepEqual(unlocked.opportunityTags, ["herbs", "tracks", "passage"]);
  assert.equal(unlocked.durationMs, 126000);
  assert.ok(unlocked.durationMs < current.destinations[0].durationMs);
});

test("one expedition cannot produce both forest branches and apply is idempotent", () => {
  const value = report();
  forest.decorateReport(value, expedition(forest.FOLLOW_HOWL));
  forest.decorateReport(value, expedition(forest.FOLLOW_HOWL));
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.log.filter((entry) => entry.type === "forest-approach").length, 1);

  const current = state();
  forest.unlockFollowup(current, value);
  forest.unlockFollowup(current, value);
  assert.equal(current.destinations.filter((item) => item.id === value.forestApproach.destinationId).length, 1);
  assert.equal(current.discoveredDestinationIds.filter((id) => id === value.forestApproach.destinationId).length, 1);
});

test("failure, unrelated destinations, and missing choice do not create a forest branch", () => {
  const failed = report("retreat");
  forest.decorateReport(failed, expedition(forest.FOLLOW_HOWL));
  assert.equal(failed.forestApproach, undefined);
  assert.deepEqual(failed.discoveries, []);

  const unrelated = report();
  forest.decorateReport(unrelated, expedition(forest.MARK_TRAIL, "hollow-village"));
  assert.equal(unrelated.forestApproach, undefined);
  assert.deepEqual(unrelated.discoveries, []);

  const unchosen = report();
  forest.decorateReport(unchosen, expedition(undefined));
  assert.equal(unchosen.forestApproach, undefined);
  assert.deepEqual(unchosen.discoveries, []);
});

test("forest choice has no silent default and unknown bridge loads the sidecar", () => {
  assert.equal(forest.setSelectedApproach("not-a-choice"), null);
  assert.equal(forest.setSelectedApproach(forest.FOLLOW_HOWL), forest.FOLLOW_HOWL);

  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(bridge, /loadForestApproach\(root\)/);
  assert.match(bridge, /CrownlessExpeditionForestApproach/);
  assert.match(bridge, /src\/expedition-forest-approach\.js/);
});