"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");

const presentation = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-presentation.js"), "utf8");
const START = Date.UTC(2026, 8, 1, 12, 0, 0);

function injuredState(ids = ["mira"]) {
  const state = system.initialState();
  ids.forEach((id) => {
    state.companions.find((companion) => companion.id === id).condition = "injured";
  });
  return state;
}

test("休養開始直後はhealthyにせず10分のrecoveryUntilを保存する", () => {
  const state = system.startRecovery(injuredState(), ["mira"], START);
  const mira = state.companions.find((companion) => companion.id === "mira");
  assert.equal(system.RECOVERY_DURATION_MS, 10 * 60 * 1000);
  assert.equal(mira.condition, "recovering");
  assert.equal(mira.recoveryStartedAt, START);
  assert.equal(mira.recoveryUntil, START + system.RECOVERY_DURATION_MS);
  assert.match(mira.history, /灰炉で休養開始/);
});

test("9分59秒では未回復、10分経過でhealthyへ戻る", () => {
  const resting = system.startRecovery(injuredState(), ["mira"], START);
  const early = system.reconcileRecoveries(JSON.parse(JSON.stringify(resting)), START + system.RECOVERY_DURATION_MS - 1000);
  assert.equal(early.companions.find((companion) => companion.id === "mira").condition, "recovering");

  const recovered = system.reconcileRecoveries(JSON.parse(JSON.stringify(resting)), START + system.RECOVERY_DURATION_MS);
  const mira = recovered.companions.find((companion) => companion.id === "mira");
  assert.equal(mira.condition, "healthy");
  assert.equal(mira.recoveryUntil, undefined);
  assert.match(mira.history, /灰炉で回復/);
});

test("save相当のJSON round-trip後も予定時刻を維持し、期限超過ならオフライン回復する", () => {
  const resting = system.startRecovery(injuredState(), ["mira"], START);
  const restored = system.normalizeState(JSON.parse(JSON.stringify(resting)));
  assert.equal(restored.companions.find((companion) => companion.id === "mira").recoveryUntil, START + system.RECOVERY_DURATION_MS);

  const afterOffline = system.advance(restored, START + system.RECOVERY_DURATION_MS + 1);
  assert.equal(afterOffline.state.companions.find((companion) => companion.id === "mira").condition, "healthy");
});

test("複数人を独立に休養でき、healthyな仲間は変更しない", () => {
  const state = injuredState(["mira", "ed"]);
  const resting = system.startRecovery(state, ["mira", "ed", "sella"], START);
  assert.equal(resting.companions.find((companion) => companion.id === "mira").condition, "recovering");
  assert.equal(resting.companions.find((companion) => companion.id === "ed").condition, "recovering");
  assert.equal(resting.companions.find((companion) => companion.id === "sella").condition, "healthy");
});

test("休養中は派遣不可、期限経過後はdispatch時の遅延評価で派遣可能になる", () => {
  const resting = system.startRecovery(injuredState(), ["mira"], START);
  const input = {
    destinationId: "ashen-wood",
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
    durationMs: 0,
  };
  assert.throws(() => system.dispatchExpedition(JSON.parse(JSON.stringify(resting)), input, START + 60_000), /unavailable/);
  const dispatched = system.dispatchExpedition(JSON.parse(JSON.stringify(resting)), input, START + system.RECOVERY_DURATION_MS);
  assert.ok(dispatched.activeExpedition);
  assert.equal(dispatched.companions.find((companion) => companion.id === "mira").condition, "healthy");
});

test("prepare UIは即時回復をやめ、休養開始と残り時間を表示する", () => {
  assert.match(presentation, /system\.startRecovery\(/);
  assert.match(presentation, /灰炉で休養を始める/);
  assert.match(presentation, /休養中・あと約\$\{remainingMinutes\}分/);
  assert.doesNotMatch(presentation, /companion\.condition\s*=\s*"healthy"/);
  assert.match(presentation, /hasRecoveringCompanion/);
});
