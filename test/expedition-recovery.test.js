"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const system = require("../src/expedition-system.js");

function injuredState(ids = ["mira"]) {
  const state = system.initialState();
  for (const companion of state.companions) {
    if (ids.includes(companion.id)) companion.condition = "injured";
  }
  return state;
}

test("starting recovery keeps an injured companion unavailable for ten minutes", () => {
  const startedAt = 1_000_000;
  const state = system.startRecovery(injuredState(), ["mira"], startedAt);
  const mira = state.companions.find((item) => item.id === "mira");
  assert.equal(system.RECOVERY_DURATION_MS, 10 * 60 * 1000);
  assert.equal(mira.condition, "recovering");
  assert.equal(mira.recoveryStartedAt, startedAt);
  assert.equal(mira.recoveryUntil, startedAt + system.RECOVERY_DURATION_MS);
  assert.match(mira.history, /灰炉で休養開始/);

  assert.throws(() => system.dispatchExpedition(state, {
    destinationId: "ashen-wood",
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
  }, startedAt + 1), /unavailable/);
});

test("recovery remains active at 9:59 and completes at 10:00", () => {
  const startedAt = 2_000_000;
  const state = system.startRecovery(injuredState(), ["mira"], startedAt);

  const before = system.reconcileRecoveries(state, startedAt + system.RECOVERY_DURATION_MS - 1000);
  const beforeMira = before.companions.find((item) => item.id === "mira");
  assert.equal(beforeMira.condition, "recovering");

  const completed = system.reconcileRecoveries(before, startedAt + system.RECOVERY_DURATION_MS);
  const mira = completed.companions.find((item) => item.id === "mira");
  assert.equal(mira.condition, "healthy");
  assert.equal(mira.recoveryStartedAt, undefined);
  assert.equal(mira.recoveryUntil, undefined);
  assert.match(mira.history, /灰炉で回復/);
});

test("recovery survives JSON round-trip and offline elapsed time", () => {
  const startedAt = 3_000_000;
  const recovering = system.startRecovery(injuredState(), ["mira"], startedAt);
  const restored = JSON.parse(JSON.stringify(recovering));
  const miraBefore = restored.companions.find((item) => item.id === "mira");
  assert.equal(miraBefore.recoveryUntil, startedAt + system.RECOVERY_DURATION_MS);

  const afterOfflineTime = system.reconcileRecoveries(restored, startedAt + system.RECOVERY_DURATION_MS + 1);
  const miraAfter = afterOfflineTime.companions.find((item) => item.id === "mira");
  assert.equal(miraAfter.condition, "healthy");
});

test("multiple companions recover independently", () => {
  const firstStart = 4_000_000;
  let state = system.startRecovery(injuredState(["mira", "ed"]), ["mira"], firstStart);
  state = system.startRecovery(state, ["ed"], firstStart + 60_000);

  const afterMira = system.reconcileRecoveries(state, firstStart + system.RECOVERY_DURATION_MS);
  assert.equal(afterMira.companions.find((item) => item.id === "mira").condition, "healthy");
  assert.equal(afterMira.companions.find((item) => item.id === "ed").condition, "recovering");

  const afterEd = system.reconcileRecoveries(afterMira, firstStart + 60_000 + system.RECOVERY_DURATION_MS);
  assert.equal(afterEd.companions.find((item) => item.id === "ed").condition, "healthy");
});

test("starting recovery does not alter healthy companions", () => {
  const state = system.initialState();
  const before = JSON.stringify(state.companions);
  const after = system.startRecovery(state, ["mira", "ed", "sella"], 5_000_000);
  assert.equal(JSON.stringify(after.companions), before);
});

test("dispatch lazily reconciles an expired recovery", () => {
  const startedAt = 6_000_000;
  const recovering = system.startRecovery(injuredState(), ["mira"], startedAt);
  const dispatched = system.dispatchExpedition(recovering, {
    destinationId: "ashen-wood",
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
  }, startedAt + system.RECOVERY_DURATION_MS);

  assert.equal(dispatched.companions.find((item) => item.id === "mira").condition, "healthy");
  assert.deepEqual(dispatched.activeExpedition.inputs.companionIds, ["mira"]);
});
