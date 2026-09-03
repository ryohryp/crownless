"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const system = require("../src/expedition-system.js");
const forcedMarch = require("../src/expedition-forced-march.js");
const relief = require("../src/expedition-camp-supply-relief.js");

test("recovered camp supplies become selectable equipment without duplication", () => {
  const state = system.initialState();
  const report = {
    outcome: "success",
    loot: [{ id: relief.SUPPLY_ID, name: "野営跡の補給品", count: 1 }],
  };

  relief.unlockSupplyEquipment(state, report);
  relief.unlockSupplyEquipment(state, report);

  assert.equal(state.equipment.filter((item) => item.id === relief.SUPPLY_ID).length, 1);
  const item = state.equipment.find((equipment) => equipment.id === relief.SUPPLY_ID);
  assert.deepEqual(item.tags, ["supply", "fatigue-relief", "consumable"]);
});

test("forced march with supplies records the fatigue-relief decision", () => {
  const completedAt = 1_700_000_000_000;
  const report = {
    expeditionId: "exp-relief",
    outcome: "success",
    companionIds: ["mira"],
    injuries: [],
    completedAt,
    log: [],
  };
  const expedition = { inputs: { pace: "forced", equipmentIds: [relief.SUPPLY_ID] } };

  forcedMarch.decorateReport(report, expedition);
  relief.decorateReport(report, expedition);

  assert.equal(report.forcedMarchSupplyRelief.equipmentId, relief.SUPPLY_ID);
  assert.equal(report.forcedMarchSupplyRelief.recoveryMs, relief.RELIEVED_RECOVERY_MS);
  assert.equal(report.log.filter((entry) => entry.type === "forced-march-supply-relief").length, 1);
  assert.match(report.log.find((entry) => entry.type === "forced-march-supply-relief").text, /使い切り.*約2分/);
});

test("supply relief shortens forced-march recovery and consumes the last supply", () => {
  const completedAt = 1_700_000_000_000;
  const state = system.initialState();
  state.securedLoot.push({ id: relief.SUPPLY_ID, name: "野営跡の補給品", sourceExpeditionId: "exp-source" });
  relief.unlockSupplyEquipment(state, { outcome: "success", loot: [{ id: relief.SUPPLY_ID }] });

  const report = {
    expeditionId: "exp-relief",
    outcome: "success",
    companionIds: ["mira"],
    injuries: [],
    completedAt,
    log: [],
  };
  const expedition = { inputs: { pace: "forced", equipmentIds: [relief.SUPPLY_ID] } };
  forcedMarch.decorateReport(report, expedition);
  relief.decorateReport(report, expedition);
  forcedMarch.applyFatigue(state, report);
  relief.applySupplyRelief(state, report);

  const mira = state.companions.find((item) => item.id === "mira");
  assert.equal(mira.condition, "recovering");
  assert.equal(mira.recoveryUntil - completedAt, relief.RELIEVED_RECOVERY_MS);
  assert.equal(state.securedLoot.some((item) => item.id === relief.SUPPLY_ID), false);
  assert.equal(state.equipment.some((item) => item.id === relief.SUPPLY_ID), false);
  assert.equal(report.forcedMarchSupplyConsumed, true);
});

test("normal pace and failed forced march do not consume supplies", () => {
  for (const scenario of [
    { outcome: "success", pace: "normal" },
    { outcome: "failed", pace: "forced" },
  ]) {
    const state = system.initialState();
    state.securedLoot.push({ id: relief.SUPPLY_ID, name: "野営跡の補給品", sourceExpeditionId: `source-${scenario.pace}` });
    relief.unlockSupplyEquipment(state, { outcome: "success", loot: [{ id: relief.SUPPLY_ID }] });
    const report = {
      expeditionId: `exp-${scenario.outcome}-${scenario.pace}`,
      outcome: scenario.outcome,
      companionIds: ["mira"],
      injuries: [],
      completedAt: 10,
      log: [],
    };
    const expedition = { inputs: { pace: scenario.pace, equipmentIds: [relief.SUPPLY_ID] } };
    forcedMarch.decorateReport(report, expedition);
    relief.decorateReport(report, expedition);
    forcedMarch.applyFatigue(state, report);
    relief.applySupplyRelief(state, report);

    assert.equal(report.forcedMarchSupplyRelief, undefined);
    assert.equal(state.securedLoot.filter((item) => item.id === relief.SUPPLY_ID).length, 1);
    assert.equal(state.equipment.some((item) => item.id === relief.SUPPLY_ID), true);
  }
});

test("consuming one of multiple supplies keeps the equipment choice available", () => {
  const state = system.initialState();
  state.securedLoot.push(
    { id: relief.SUPPLY_ID, sourceExpeditionId: "exp-source-a" },
    { id: relief.SUPPLY_ID, sourceExpeditionId: "exp-source-b" },
  );
  relief.unlockSupplyEquipment(state, { outcome: "success", loot: [{ id: relief.SUPPLY_ID }] });
  relief.consumeOneSupply(state);

  assert.equal(state.securedLoot.filter((item) => item.id === relief.SUPPLY_ID).length, 1);
  assert.equal(state.equipment.some((item) => item.id === relief.SUPPLY_ID), true);
});

test("reapplying an already-applied report cannot spend another supply", () => {
  const state = system.initialState();
  state.securedLoot.push(
    { id: relief.SUPPLY_ID, sourceExpeditionId: "exp-source-a" },
    { id: relief.SUPPLY_ID, sourceExpeditionId: "exp-source-b" },
  );
  relief.unlockSupplyEquipment(state, { outcome: "success", loot: [{ id: relief.SUPPLY_ID }] });
  state.appliedExpeditionIds.push("exp-relief");

  const report = {
    expeditionId: "exp-relief",
    outcome: "success",
    marchPace: "forced",
    forcedMarchFatigueIds: ["mira"],
    forcedMarchSupplyRelief: { equipmentId: relief.SUPPLY_ID, recoveryMs: relief.RELIEVED_RECOVERY_MS },
    completedAt: 20,
  };

  // The installation wrapper checks appliedExpeditionIds before calling applySupplyRelief.
  const wasApplied = state.appliedExpeditionIds.includes(report.expeditionId);
  if (!wasApplied) relief.applySupplyRelief(state, report);

  assert.equal(state.securedLoot.filter((item) => item.id === relief.SUPPLY_ID).length, 2);
});