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
test("successful follow-up return rebuilds the village and changes revisit opportunities", () => {
  const current = state();
  const first = report();
  village.decorateReport(first, expedition(village.RING));
  const lead = village.unlockFollowup(current, first);
  const followup = { inputs: { destinationId: lead.id } };
  const returned = report();
  const changed = village.restoreVillage(current, returned, followup);
  assert.equal(changed.name, "見張り火の灯る村");
  assert.ok(changed.opportunityTags.includes("safe-camp"));
  assert.ok(!changed.dangerTags.includes("bandit"));
  assert.equal(returned.villageRestoration.stage, "watchfire");
  village.restoreVillage(current, returned, followup);
  assert.equal(returned.log.filter((entry) => entry.type === "village-restoration").length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(current)).destinations[0], changed);
});

test("cellar follow-up restores workshop; retreat never rebuilds village", () => {
  const current = state();
  const first = report();
  village.decorateReport(first, expedition(village.QUIET));
  const lead = village.unlockFollowup(current, first);
  const followup = { inputs: { destinationId: lead.id } };
  assert.equal(village.restoreVillage(current, report("retreat"), followup), null);
  assert.equal(current.destinations[0].villageRestoration, undefined);
  const changed = village.restoreVillage(current, report(), followup);
  assert.equal(changed.name, "物資庫を取り戻した村");
  assert.ok(changed.opportunityTags.includes("workshop"));
  assert.ok(!changed.dangerTags.includes("collapse"));
  assert.equal(village.restoreVillage(current, report(), { inputs: { destinationId: "unrelated" } }), null);
});

test("restored village revisits bank supplies through automatic advance without duplication", () => {
  const engine = require("../src/expedition-system.js");
  const system = { ...engine };
  village.installSystemHooks({ CrownlessExpeditionSystem: system });
  const current = engine.initialState();
  const source = current.destinations.find((item) => item.id === village.DESTINATION_ID);
  source.villageRestoration = "storehouse";
  const input = { destinationId: village.DESTINATION_ID, companionIds: ["mira"], equipmentIds: [], policyId: "standard", durationMs: 0, seed: 123 };
  const dispatched = system.dispatchExpedition(current, input, 1000);
  const result = system.advance(dispatched, 1001);
  assert.equal(result.status, "completed");
  if (result.report.outcome === "success") {
    assert.equal(result.report.loot.filter((item) => item.id === "village-storehouse-ore").length, 1);
    assert.equal(result.state.securedLoot.filter((item) => item.id === "village-storehouse-ore").length, 1);
    assert.equal(system.applyReport(result.state, result.report).securedLoot.filter((item) => item.id === "village-storehouse-ore").length, 1);
  } else {
    assert.equal(result.state.securedLoot.filter((item) => item.id === "village-storehouse-ore").length, 0);
  }
});
