"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const system = require("../src/expedition-system.js");

function dispatch(policyId, extras = {}) {
  return system.dispatchExpedition(system.initialState(), {
    destinationId: extras.destinationId || "ashen-wood",
    companionIds: extras.companionIds || ["mira"],
    equipmentIds: extras.equipmentIds || [],
    policyId,
    objective: extras.objective || "explore",
    seed: extras.seed == null ? 7 : extras.seed,
    durationMs: extras.durationMs == null ? 1000 : extras.durationMs,
  }, 1_000_000);
}

test("dispatch persists immutable timing inputs and survives normalization", () => {
  const state = dispatch("standard", { equipmentIds: ["rope"] });
  assert.equal(state.activeExpedition.startedAt, 1_000_000);
  assert.equal(state.activeExpedition.expectedReturnAt, 1_001_000);
  assert.equal(state.activeExpedition.rulesVersion, system.RULES_VERSION);
  assert.deepEqual(state.activeExpedition.inputs.equipmentIds, ["rope"]);
  const restored = system.normalizeState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.activeExpedition.seed, state.activeExpedition.seed);
});

test("advance can inject time and completes only after expected return", () => {
  const state = dispatch("standard");
  assert.equal(system.advance(state, 1_000_999).status, "active");
  const completed = system.advance(state, 1_001_000);
  assert.equal(completed.status, "completed");
  assert.equal(completed.state.activeExpedition, null);
  assert.equal(completed.state.completedReports.length, 1);
});

test("policy changes deterministic outcome tendency for the same seed", () => {
  const seed = 3;
  const cautiousState = dispatch("cautious", { seed, companionIds: ["ed"], destinationId: "black-mine" });
  const greedyState = dispatch("greedy", { seed, companionIds: ["ed"], destinationId: "black-mine" });
  const cautious = system.resolveExpedition(cautiousState.activeExpedition, cautiousState);
  const greedy = system.resolveExpedition(greedyState.activeExpedition, greedyState);
  assert.notDeepEqual(cautious.log.map((x) => x.type), greedy.log.map((x) => x.type));
  assert.ok(cautious.combat.encounters.length < greedy.combat.encounters.length || cautious.outcome !== greedy.outcome);
});

test("companion traits and equipment capabilities leave legible causal events", () => {
  const forest = dispatch("standard", { seed: 11, equipmentIds: ["herb-kit"], companionIds: ["mira"] });
  const report = system.resolveExpedition(forest.activeExpedition, forest);
  assert.ok(report.log.some((x) => x.causes.includes("woodsman")));

  const cave = dispatch("standard", { seed: 11, equipmentIds: ["rope"], companionIds: ["ed"], destinationId: "black-mine" });
  const caveReport = system.resolveExpedition(cave.activeExpedition, cave);
  assert.ok(caveReport.log.some((x) => x.causes.includes("climb")));
});

test("applying a completed report is idempotent", () => {
  const state = dispatch("greedy", { seed: 9, equipmentIds: ["rope", "old-knife"], destinationId: "hollow-village" });
  const report = system.resolveExpedition(state.activeExpedition, state);
  const once = system.applyReport(state, report);
  const lootCount = once.securedLoot.length;
  const reportCount = once.completedReports.length;
  const twice = system.applyReport(once, report);
  assert.equal(twice.securedLoot.length, lootCount);
  assert.equal(twice.completedReports.length, reportCount);
  assert.equal(twice.appliedExpeditionIds.filter((id) => id === report.expeditionId).length, 1);
});

test("resolved report exposes summary-worthy loot injury or discovery and chronology", () => {
  const state = dispatch("greedy", { seed: 21, destinationId: "black-mine", companionIds: ["sella"], equipmentIds: ["rope"] });
  const report = system.resolveExpedition(state.activeExpedition, state);
  assert.ok(report.log.length >= 5);
  assert.ok(report.loot.length + report.injuries.length + report.discoveries.length >= 1);
  assert.ok(report.notableEvent && report.notableEvent.text);
});

test("expeditions always resolve at least one deterministic auto-combat encounter", () => {
  const firstState = dispatch("standard", { seed: 44, companionIds: ["ed"], equipmentIds: ["old-knife"], destinationId: "hollow-village" });
  const secondState = dispatch("standard", { seed: 44, companionIds: ["ed"], equipmentIds: ["old-knife"], destinationId: "hollow-village" });
  const first = system.resolveExpedition(firstState.activeExpedition, firstState);
  const second = system.resolveExpedition(secondState.activeExpedition, secondState);
  assert.ok(first.combat.encounters.length >= 1);
  assert.deepEqual(first.combat, second.combat);
  assert.deepEqual(first.log, second.log);
  assert.ok(first.log.some((entry) => entry.type === "combat-encounter"));
  assert.ok(first.log.some((entry) => ["combat-victory", "combat-retreat", "combat-defeat"].includes(entry.type)));
});

test("combat consumes HP and carries that damage into a later encounter", () => {
  let found = null;
  for (let seed = 1; seed <= 200 && !found; seed += 1) {
    const state = dispatch("greedy", { seed, companionIds: ["ed"], equipmentIds: ["old-knife"], destinationId: "hollow-village" });
    const report = system.resolveExpedition(state.activeExpedition, state);
    if (report.combat.encounters.length >= 2) found = report;
  }
  assert.ok(found, "expected a two-encounter greedy expedition");
  const [first, second] = found.combat.encounters;
  assert.ok(first.hpAfter < first.hpBefore);
  assert.equal(second.hpBefore, first.hpAfter);
  assert.equal(found.combat.endHp, found.combat.encounters.at(-1).hpAfter);
});

test("combat traits and equipment change the same seeded encounter", () => {
  const plainState = dispatch("standard", { seed: 31, companionIds: ["sella"], destinationId: "ashen-wood" });
  const preparedState = dispatch("standard", { seed: 31, companionIds: ["mira"], equipmentIds: ["shortbow"], destinationId: "ashen-wood" });
  const plain = system.resolveExpedition(plainState.activeExpedition, plainState);
  const prepared = system.resolveExpedition(preparedState.activeExpedition, preparedState);
  assert.notDeepEqual(plain.combat, prepared.combat);
  assert.ok(prepared.log.some((entry) => entry.causes.includes("ranged") || entry.causes.includes("woodsman")));
});

test("policy controls retreat threshold after combat", () => {
  let contrasting = null;
  for (let seed = 1; seed <= 400 && !contrasting; seed += 1) {
    const cautiousState = dispatch("cautious", { seed, companionIds: ["ed"], equipmentIds: ["old-knife"], destinationId: "hollow-village" });
    const greedyState = dispatch("greedy", { seed, companionIds: ["ed"], equipmentIds: ["old-knife"], destinationId: "hollow-village" });
    const cautious = system.resolveExpedition(cautiousState.activeExpedition, cautiousState);
    const greedy = system.resolveExpedition(greedyState.activeExpedition, greedyState);
    if (cautious.combat.encounters.length < greedy.combat.encounters.length) contrasting = { cautious, greedy };
  }
  assert.ok(contrasting, "expected policy to produce different continuation behavior");
  assert.ok(contrasting.cautious.combat.encounters.length < contrasting.greedy.combat.encounters.length);
});

test("combat victory can grant loot and duplicate application still stays idempotent", () => {
  let selected = null;
  for (let seed = 1; seed <= 200 && !selected; seed += 1) {
    const state = dispatch("standard", { seed, companionIds: ["ed"], equipmentIds: ["shortbow"], destinationId: "ashen-wood" });
    const report = system.resolveExpedition(state.activeExpedition, state);
    if (report.log.some((entry) => entry.type === "combat-loot")) selected = { state, report };
  }
  assert.ok(selected, "expected at least one combat victory with loot");
  const combatLootEntries = selected.report.log.filter((entry) => entry.type === "combat-loot");
  assert.ok(combatLootEntries.length >= 1);
  const once = system.applyReport(selected.state, selected.report);
  const twice = system.applyReport(once, selected.report);
  assert.equal(twice.securedLoot.length, once.securedLoot.length);
});

test("report chronology explains combat damage and continuation or return", () => {
  const state = dispatch("greedy", { seed: 12, companionIds: ["ed"], equipmentIds: ["old-knife", "herb-kit"], destinationId: "hollow-village" });
  const report = system.resolveExpedition(state.activeExpedition, state);
  const battleEntries = report.log.filter((entry) => entry.type.startsWith("combat-"));
  assert.ok(battleEntries.length >= 2);
  assert.ok(battleEntries.some((entry) => /HP \d+ → \d+/.test(entry.text)));
  assert.ok(report.log.some((entry) => ["policy", "retreat", "return", "combat-retreat", "combat-defeat"].includes(entry.type)));
});
