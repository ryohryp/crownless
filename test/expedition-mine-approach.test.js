"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mine = require("../src/expedition-mine-approach.js");

function expedition(approachId, destinationId = mine.DESTINATION_ID) {
  return {
    id: `exp-${approachId}`,
    inputs: {
      destinationId,
      mineApproach: approachId,
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
      id: mine.DESTINATION_ID,
      name: "黒爪の廃坑",
      family: "cave",
      dangerTags: ["dark", "fall", "beast"],
      opportunityTags: ["ore", "relic", "passage"],
      durationMs: 300000,
    }],
    discoveredDestinationIds: [mine.DESTINATION_ID],
    completedReports: [],
  };
}

test("reinforcing the return route reveals a shorter safer haulway", () => {
  const value = report();
  mine.decorateReport(value, expedition(mine.REINFORCE));

  assert.equal(value.mineApproach.approachId, mine.REINFORCE);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "補強した旧運搬路");
  assert.match(value.log.find((entry) => entry.type === "mine-approach").text, /旧運搬路/);

  const current = state();
  const unlocked = mine.unlockFollowup(current, value);
  assert.equal(unlocked.name, "補強した旧運搬路");
  assert.deepEqual(unlocked.dangerTags, ["dark"]);
  assert.equal(unlocked.durationMs, 195000);
  assert.ok(unlocked.durationMs < current.destinations[0].durationMs);
});

test("pushing deeper reveals a riskier high-opportunity sealed shaft", () => {
  const value = report();
  mine.decorateReport(value, expedition(mine.DEEP));

  assert.equal(value.mineApproach.approachId, mine.DEEP);
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.discoveries[0].name, "崩落の奥の封鎖坑");

  const current = state();
  const unlocked = mine.unlockFollowup(current, value);
  assert.deepEqual(unlocked.dangerTags, ["dark", "collapse", "beast"]);
  assert.deepEqual(unlocked.opportunityTags, ["relic", "ore", "passage"]);
  assert.equal(unlocked.durationMs, 345000);
  assert.ok(unlocked.durationMs > current.destinations[0].durationMs);
});

test("one expedition cannot produce both mine branches and apply is idempotent", () => {
  const value = report();
  mine.decorateReport(value, expedition(mine.DEEP));
  mine.decorateReport(value, expedition(mine.DEEP));
  assert.equal(value.discoveries.length, 1);
  assert.equal(value.log.filter((entry) => entry.type === "mine-approach").length, 1);

  const current = state();
  mine.unlockFollowup(current, value);
  mine.unlockFollowup(current, value);
  assert.equal(current.destinations.filter((item) => item.id === value.mineApproach.destinationId).length, 1);
  assert.equal(current.discoveredDestinationIds.filter((id) => id === value.mineApproach.destinationId).length, 1);
});

test("failure, unrelated destinations, and missing choice do not create a mine branch", () => {
  const failed = report("retreat");
  mine.decorateReport(failed, expedition(mine.REINFORCE));
  assert.equal(failed.mineApproach, undefined);
  assert.deepEqual(failed.discoveries, []);

  const unrelated = report();
  mine.decorateReport(unrelated, expedition(mine.DEEP, "ashen-wood"));
  assert.equal(unrelated.mineApproach, undefined);
  assert.deepEqual(unrelated.discoveries, []);

  const unchosen = report();
  mine.decorateReport(unchosen, expedition(undefined));
  assert.equal(unchosen.mineApproach, undefined);
  assert.deepEqual(unchosen.discoveries, []);
});

test("mine choice has no silent default and unknown bridge loads the sidecar", () => {
  assert.equal(mine.setSelectedApproach("not-a-choice"), null);
  assert.equal(mine.setSelectedApproach(mine.REINFORCE), mine.REINFORCE);

  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(bridge, /loadMineApproach\(root\)/);
  assert.match(bridge, /CrownlessExpeditionMineApproach/);
  assert.match(bridge, /src\/expedition-mine-approach\.js/);
});