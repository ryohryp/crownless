"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const system = require("../src/expedition-system.js");

function resolve({ seed = 7, policyId = "standard", companionIds = ["ed"], equipmentIds = [], destinationId = "ashen-wood" } = {}) {
  const state = system.dispatchExpedition(system.initialState(), {
    destinationId,
    companionIds,
    equipmentIds,
    policyId,
    objective: "explore",
    seed,
    durationMs: 0,
  }, 1_000_000);
  return system.resolveExpedition(state.activeExpedition, state);
}

test("multi-enemy encounters unfold across multiple rounds", () => {
  const report = resolve({ seed: 44, destinationId: "ashen-wood", companionIds: ["ed"] });
  const encounter = report.combat.encounters[0];
  assert.ok(encounter.initialEnemyCount > 1);
  assert.ok(encounter.rounds.length >= 2);
  assert.equal(encounter.rounds[0].enemyCountBefore, encounter.initialEnemyCount);
  assert.ok(encounter.rounds[0].remainingEnemyCount > 0, "first round must not erase a multi-enemy encounter");
});

test("remaining enemy count falls through rounds and lowers damage pressure", () => {
  let selected = null;
  for (let seed = 1; seed <= 300 && !selected; seed += 1) {
    const report = resolve({ seed, policyId: "greedy", destinationId: "ashen-wood", companionIds: ["ed"], equipmentIds: ["old-knife"] });
    const rounds = report.combat.encounters[0].rounds;
    if (rounds.length >= 3 && rounds[0].remainingEnemyCount > rounds.at(-1).remainingEnemyCount) selected = rounds;
  }
  assert.ok(selected, "expected a battle with at least three rounds");
  for (let i = 1; i < selected.length; i += 1) {
    assert.equal(selected[i].hpBefore, selected[i - 1].hpAfter);
    assert.ok(selected[i].remainingEnemyCount <= selected[i - 1].remainingEnemyCount);
  }
  const early = selected.find((round) => round.enemyCountBefore >= 3 && round.damage > 0);
  const late = [...selected].reverse().find((round) => round.enemyCountBefore <= 2 && round.damage > 0);
  if (early && late) assert.ok(late.damage <= early.damage + 8, "fewer enemies should not create sharply higher pressure");
});

test("defeating the final enemy prevents retaliation damage and report log", () => {
  const report = resolve({
    seed: 11,
    policyId: "standard",
    destinationId: "ashen-wood",
    companionIds: ["mira", "ed", "sella"],
  });
  const encounter = report.combat.encounters[0];
  const finalRoundIndex = encounter.rounds.length - 1;
  const finalRound = encounter.rounds[finalRoundIndex];

  assert.equal(encounter.result, "victory");
  assert.ok(encounter.rounds[0].remainingEnemyCount > 0);
  assert.ok(encounter.rounds[0].damage > 0, "enemies that remain should still deal retaliation damage");
  assert.equal(finalRound.remainingEnemyCount, 0);
  assert.equal(finalRound.damage, 0);
  assert.equal(finalRound.hpAfter, finalRound.hpBefore);

  const finalDamageMinute = 43 + 1 + finalRoundIndex * 2 + 1;
  assert.equal(
    report.log.some((entry) => entry.type === "combat-damage" && entry.minute === finalDamageMinute),
    false,
    "no retaliation log should be emitted after the final enemy falls",
  );
});

test("traits and equipment appear as readable round events", () => {
  const ranged = resolve({ seed: 31, companionIds: ["mira"], equipmentIds: ["shortbow"], destinationId: "ashen-wood" });
  const first = ranged.combat.encounters[0].rounds[0];
  assert.ok(first.events.includes("ranged-opener"));
  assert.ok(ranged.log.some((entry) => entry.type === "combat-tactic" && entry.causes.includes("ranged")));
  assert.ok(ranged.log.filter((entry) => entry.type.startsWith("combat-")).length >= 4);
});

test("same seed reproduces the complete round sequence", () => {
  const options = { seed: 92, policyId: "greedy", companionIds: ["ed"], equipmentIds: ["old-knife", "herb-kit"], destinationId: "hollow-village" };
  const first = resolve(options);
  const second = resolve(options);
  assert.deepEqual(first.combat.encounters.map((encounter) => encounter.rounds), second.combat.encounters.map((encounter) => encounter.rounds));
  assert.deepEqual(first.log, second.log);
});

test("encounter-to-encounter HP carry-over remains intact", () => {
  let report = null;
  for (let seed = 1; seed <= 400 && !report; seed += 1) {
    const candidate = resolve({ seed, policyId: "greedy", companionIds: ["ed"], equipmentIds: ["old-knife"], destinationId: "hollow-village" });
    if (candidate.combat.encounters.length >= 2) report = candidate;
  }
  assert.ok(report, "expected a greedy expedition with two encounters");
  const [first, second] = report.combat.encounters;
  assert.equal(second.hpBefore, first.hpAfter);
});

test("policy can end combat on a round boundary before every enemy is defeated", () => {
  let contrast = null;
  for (let seed = 1; seed <= 500 && !contrast; seed += 1) {
    const cautious = resolve({ seed, policyId: "cautious", companionIds: ["sella"], destinationId: "hollow-village" });
    const greedy = resolve({ seed, policyId: "greedy", companionIds: ["sella"], destinationId: "hollow-village" });
    const c = cautious.combat.encounters[0];
    const g = greedy.combat.encounters[0];
    if (c.result === "retreat" && c.remainingEnemyCount > 0 && (g.rounds.length > c.rounds.length || g.result === "victory")) contrast = { c, g };
  }
  assert.ok(contrast, "expected cautious and greedy policies to diverge inside battle");
});
