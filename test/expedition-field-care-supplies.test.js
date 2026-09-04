"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const relief = require("../src/expedition-camp-supply-relief.js");

function state() {
  return {
    companions: [
      { id: "mira", name: "ミラ", condition: "healthy" },
      { id: "ed", name: "エド", condition: "healthy" },
    ],
    equipment: [{ id: relief.SUPPLY_ID, name: "野営跡の補給品", tags: ["supply", "consumable"] }],
    securedLoot: [{ id: relief.SUPPLY_ID, name: "野営跡の補給品", sourceExpeditionId: "exp-camp" }],
  };
}

function expedition(extras = {}) {
  return {
    inputs: {
      equipmentIds: [relief.SUPPLY_ID],
      fieldCareReserve: true,
      ...extras,
    },
  };
}

function injuredReport() {
  return {
    expeditionId: "exp-care-1",
    outcome: "success",
    injuries: ["mira", "ed"],
    log: [
      { minute: 51, time: "10:51", type: "injury", text: "ミラが戦闘で負傷した。", causes: ["combat damage"] },
      { minute: 82, time: "11:22", type: "injury", text: "エドが戦闘で負傷した。", causes: ["combat damage"] },
    ],
  };
}

test("field care requires explicit reserve, equipped supply, and an actual injury", () => {
  assert.equal(relief.qualifiesForFieldCare(injuredReport(), expedition()), true);
  assert.equal(relief.qualifiesForFieldCare(injuredReport(), expedition({ fieldCareReserve: false })), false);
  assert.equal(relief.qualifiesForFieldCare(injuredReport(), expedition({ equipmentIds: [] })), false);
  assert.equal(relief.qualifiesForFieldCare({ ...injuredReport(), injuries: [] }, expedition()), false);
});

test("field care treats only the first injury and explains the consequence in the report", () => {
  const report = relief.decorateFieldCareReport(injuredReport(), expedition(), state());
  assert.deepEqual(report.injuries, ["ed"]);
  assert.equal(report.fieldCareUsed.companionId, "mira");
  assert.equal(report.fieldCareUsed.companionName, "ミラ");
  assert.ok(report.log.some((entry) => entry.type === "field-care" && entry.text.includes("ミラ") && entry.text.includes("野営跡の補給品")));
  assert.equal(report.notableEvent.type, "field-care");
});

test("field care consumes one supply once, while a no-injury expedition keeps it", () => {
  const usedState = state();
  const usedReport = relief.decorateFieldCareReport(injuredReport(), expedition(), usedState);
  relief.applyFieldCare(usedState, usedReport);
  assert.equal(usedState.securedLoot.some((item) => item.id === relief.SUPPLY_ID), false);
  assert.equal(usedState.equipment.some((item) => item.id === relief.SUPPLY_ID), false);
  assert.equal(usedReport.fieldCareConsumed, true);

  const afterFirstApply = JSON.stringify(usedState);
  relief.applyFieldCare(usedState, usedReport);
  assert.equal(JSON.stringify(usedState), afterFirstApply);

  const keptState = state();
  const noInjury = { expeditionId: "exp-safe", outcome: "success", injuries: [], log: [] };
  relief.decorateFieldCareReport(noInjury, expedition(), keptState);
  relief.applyFieldCare(keptState, noInjury);
  assert.equal(keptState.securedLoot.some((item) => item.id === relief.SUPPLY_ID), true);
  assert.equal(keptState.equipment.some((item) => item.id === relief.SUPPLY_ID), true);
});

test("one supply cannot pay for both field care and forced-march fatigue relief", () => {
  const report = relief.decorateFieldCareReport(injuredReport(), expedition({ pace: "forced" }), state());
  report.forcedMarchFatigueIds = ["mira"];
  assert.equal(relief.qualifiesForRelief(report, expedition({ pace: "forced" })), false);

  const fatigueOnly = {
    expeditionId: "exp-march",
    outcome: "success",
    injuries: [],
    forcedMarchFatigueIds: ["mira"],
    log: [],
  };
  assert.equal(relief.qualifiesForRelief(fatigueOnly, expedition({ pace: "forced", fieldCareReserve: false })), true);
});
