"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ARCHETYPES,
  chooseAction,
  simulateExpedition,
  runPlaytestSuite,
} = require("../scripts/simulate-playtest.cjs");
const Engine = require("../src/slice-engine.js");

test("all four archetypes are defined", () => {
  assert.deepEqual(ARCHETYPES, ["tactician", "cautious", "greedy", "rusher"]);
});

test("tactician appropriately counters enemy intents", () => {
  let state = Engine.initial();
  state.mode = "trial";
  state = Engine.start(state, "wood");

  // Force stage to fight with wolf
  state.expedition.stage = "fight";
  state.expedition.enemy = {
    kind: "wolf",
    hp: 16,
    maxHp: 16,
    turn: 0,
    depth: 1,
  };
  state.expedition.stamina = 3;
  state.expedition.hp = 25;

  // Turn 0: wolf pattern[0] is 'quick' -> tactician should guard against quick
  const actionQuick = chooseAction("tactician", state);
  assert.equal(actionQuick, "guard");

  // Turn 1: wolf pattern[1] is 'heavy' -> tactician should dodge heavy
  state.expedition.enemy.turn = 1;
  const actionHeavy = chooseAction("tactician", state);
  assert.equal(actionHeavy, "dodge");

  // Turn 2: wolf pattern[2] is 'open' -> tactician should strike or heavy attack
  state.expedition.enemy.turn = 2;
  const actionOpen = chooseAction("tactician", state);
  assert.ok(["strike", "heavy"].includes(actionOpen));
});

test("cautious heals when wounded and flees at critical low HP", () => {
  let state = Engine.initial();
  state.mode = "trial";
  state = Engine.start(state, "wood");
  state.expedition.stage = "fight";
  state.expedition.enemy = { kind: "wolf", hp: 16, maxHp: 16, turn: 0, depth: 1, elite: false };
  state.expedition.hp = 4;
  state.expedition.potions = 0; // No potions left

  const action = chooseAction("cautious", state);
  assert.equal(action, "flee");
});

test("simulateExpedition runs to completion and produces valid trace structure", () => {
  const trace = simulateExpedition({ archetype: "tactician", place: "wood" });

  assert.equal(typeof trace.archetype, "string");
  assert.equal(trace.place, "wood");
  assert.equal(typeof trace.cleared, "boolean");
  assert.equal(typeof trace.died, "boolean");
  assert.equal(typeof trace.finalHp, "number");
  assert.equal(typeof trace.maxHp, "number");
  assert.equal(typeof trace.minHp, "number");
  assert.ok(trace.minHp <= trace.maxHp);
  assert.ok(trace.totalTurns > 0);
  assert.ok(Array.isArray(trace.decisions));
  assert.ok(trace.decisions.length > 0);
  assert.equal(typeof trace.metrics.intentResponseAccuracy, "number");
  assert.ok(trace.metrics.intentResponseAccuracy >= 0 && trace.metrics.intentResponseAccuracy <= 1);
  assert.ok(Array.isArray(trace.logs));
  assert.equal(typeof trace.hearthOutcome, "object");
  assert.ok(Array.isArray(trace.gearQualities));
  assert.ok(Array.isArray(trace.duplicateLoot));
  assert.equal(typeof trace.hearthOutcome.equippedQuality, "number");
});

test("runPlaytestSuite executes specified number of runs for all archetypes", () => {
  const traces = runPlaytestSuite({ runs: 1, place: "wood" });
  assert.equal(traces.length, 4);

  const seenArchetypes = new Set(traces.map((t) => t.archetype));
  assert.equal(seenArchetypes.size, 4);
  for (const arch of ARCHETYPES) {
    assert.ok(seenArchetypes.has(arch));
  }
});

test("playtest harness uses the live telegraphed enemy adaptation runtime", () => {
  let state = Engine.initial();
  state.mode = "trial";
  state = Engine.start(state, "wood");
  state = Engine.act(state, "careful");

  // Repeat the successful shallow-wolf response pattern from #740.
  state = Engine.act(state, "guard");
  state = Engine.act(state, "dodge");
  state = Engine.act(state, "strike");
  state = Engine.act(state, "guard");

  const nextIntent = Engine.intent(state.expedition.enemy);
  assert.equal(nextIntent.id, "feint");
  assert.equal(nextIntent.adaptive, true);
  assert.equal(nextIntent.responseAdaptive, true);
  assert.equal(chooseAction("tactician", state), "strike");
});
