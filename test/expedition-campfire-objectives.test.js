"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const objectives = require("../src/expedition-campfire-objectives.js");

function expedition(objective) {
  return { id: "exp-camp", inputs: { destinationId: objectives.CAMPFIRE_DESTINATION_ID, companionIds: ["mira"], equipmentIds: [], policyId: "standard", objective } };
}

function report() {
  return {
    expeditionId: "exp-camp", destinationId: objectives.CAMPFIRE_DESTINATION_ID, outcome: "success",
    loot: [{ id: objectives.STONE_ID, name: "刻印のある石片", count: 1 }],
    signalEncounter: { id: "roadside-suspicious-campfire", kind: "suspicious-campfire", signalSource: "suspicious-campfire", aid: { id: "campfire-investigate-aid", outcome: "clue-found" } },
    log: [
      { minute: 90, time: "08:00", type: "signal-encounter", text: "暗がりの火影を追った遠征隊は、古い焚き火の跡から石片を見つけ出した。", causes: ["roadside-suspicious-campfire", "suspicious-campfire"] },
      { minute: 91, time: "08:00", type: "signal-aid", text: "古い石片を回収した。", causes: ["campfire-investigate-aid", "relic-clue"] }
    ]
  };
}

test("explore preserves the existing relic clue result", () => {
  const value = report();
  const before = JSON.stringify(value);
  objectives.applyCampfireObjective(value, expedition("explore"));
  assert.equal(JSON.stringify(value), before);
});

test("scavenge trades the relic clue for usable supplies", () => {
  const value = report();
  objectives.applyCampfireObjective(value, expedition("scavenge"));
  assert.equal(value.loot.some((item) => item.id === objectives.STONE_ID), false);
  assert.equal(value.loot.some((item) => item.id === objectives.SUPPLY_ID), true);
  assert.equal(value.signalEncounter.approach.outcome, "supplies-recovered");
  assert.match(value.notableEvent.text, /補給品.*遺構の手掛かり/);
});

test("hunt gives trail intel without relic or supply loot", () => {
  const value = report();
  objectives.applyCampfireObjective(value, expedition("hunt"));
  assert.equal(value.loot.some((item) => item.id === objectives.STONE_ID || item.id === objectives.SUPPLY_ID), false);
  assert.equal(value.signalEncounter.approach.outcome, "trail-learned");
  assert.match(value.notableEvent.text, /三、四人.*北側/);
});

test("campfire objective application is idempotent", () => {
  const value = report();
  const exp = expedition("scavenge");
  objectives.applyCampfireObjective(value, exp);
  objectives.applyCampfireObjective(value, exp);
  assert.equal(value.loot.filter((item) => item.id === objectives.SUPPLY_ID).length, 1);
  assert.equal(value.log.filter((entry) => entry.type === "signal-salvage").length, 1);
});

test("unrelated destinations are untouched", () => {
  const value = report();
  const exp = expedition("hunt");
  exp.inputs.destinationId = "ashen-wood";
  const before = JSON.stringify(value);
  objectives.applyCampfireObjective(value, exp);
  assert.equal(JSON.stringify(value), before);
});