"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const followups = require("../src/expedition-followup-destinations.js");

function discoveryReport(overrides = {}) {
  return {
    expeditionId: "exp-followup",
    outcome: "success",
    destinationId: "ashen-wood",
    destinationName: "灰の森",
    discoveries: [{ id: "rumor-ashen-wood-42", name: "灰の森の奥へ続く印", sourceDestinationId: "ashen-wood" }],
    log: [{ minute: 104, time: "10:44", type: "discovery", text: "灰の森の奥へ続く印を記録した。", causes: ["learned value"] }],
    ...overrides,
  };
}

test("a successful report discovery unlocks one playable follow-up destination", () => {
  const state = system.initialState();
  const report = discoveryReport();

  followups.unlockFollowupDestinations(state, report);

  const destination = state.destinations.find((item) => item.id === "followup:ashen-wood");
  assert.ok(destination);
  assert.equal(destination.name, "灰の森・痕跡の先");
  assert.equal(destination.family, "forest");
  assert.deepEqual(destination.dangerTags, ["beast", "thicket"]);
  assert.ok(destination.opportunityTags.includes("tracks"));
  assert.ok(state.discoveredDestinationIds.includes(destination.id));
  assert.equal(report.followupDestinations.length, 1);
  assert.match(report.log.find((entry) => entry.type === "followup-unlocked").text, /次の遠征先/);

  const dispatched = system.dispatchExpedition(state, {
    destinationId: destination.id,
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
    durationMs: 0,
    seed: 7,
  }, 1_000_000);
  assert.equal(dispatched.activeExpedition.inputs.destinationId, destination.id);
});

test("the same source unlocks only one destination and report application is idempotent", () => {
  const state = system.initialState();
  const report = discoveryReport({
    discoveries: [
      { id: "rumor-a", name: "最初の印", sourceDestinationId: "ashen-wood" },
      { id: "rumor-b", name: "別の印", sourceDestinationId: "ashen-wood" },
    ],
  });

  followups.unlockFollowupDestinations(state, report);
  followups.unlockFollowupDestinations(state, report);

  assert.equal(state.destinations.filter((item) => item.id === "followup:ashen-wood").length, 1);
  assert.equal(state.discoveredDestinationIds.filter((id) => id === "followup:ashen-wood").length, 1);
  assert.equal(report.followupDestinations.filter((item) => item.id === "followup:ashen-wood").length, 1);
  assert.equal(report.log.filter((entry) => entry.type === "followup-unlocked").length, 1);
});

test("failed, empty, and follow-up-origin reports do not create new destinations", () => {
  const failedState = system.initialState();
  followups.unlockFollowupDestinations(failedState, discoveryReport({ outcome: "failed" }));
  assert.equal(failedState.destinations.some((item) => item.id.startsWith("followup:")), false);

  const emptyState = system.initialState();
  followups.unlockFollowupDestinations(emptyState, discoveryReport({ discoveries: [] }));
  assert.equal(emptyState.destinations.some((item) => item.id.startsWith("followup:")), false);

  const chainedState = system.initialState();
  chainedState.destinations.push({
    id: "followup:ashen-wood",
    name: "灰の森・痕跡の先",
    family: "forest",
    dangerTags: ["beast"],
    opportunityTags: ["tracks"],
    durationMs: 180000,
    followupDepth: 1,
    followupSourceDestinationId: "ashen-wood",
  });
  followups.unlockFollowupDestinations(chainedState, discoveryReport({
    destinationId: "followup:ashen-wood",
    discoveries: [{ id: "rumor-deeper", name: "さらに奥へ続く印", sourceDestinationId: "followup:ashen-wood" }],
  }));
  assert.equal(chainedState.destinations.some((item) => item.id === "followup:followup:ashen-wood"), false);
});

test("installed advance hook exposes a discovered follow-up through the real resolver", () => {
  const wrapped = { ...system };
  followups.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  let advanced = null;

  for (let seed = 1; seed <= 500 && !advanced; seed += 1) {
    const startedAt = 2_000_000 + seed;
    const state = wrapped.dispatchExpedition(wrapped.initialState(), {
      destinationId: "ashen-wood",
      companionIds: ["mira"],
      equipmentIds: [],
      policyId: "standard",
      objective: "explore",
      durationMs: 0,
      seed,
    }, startedAt);
    const candidate = wrapped.advance(state, startedAt);
    if (candidate.report && candidate.report.discoveries.length) advanced = candidate;
  }

  assert.ok(advanced, "expected a real exploration report with a discovery");
  assert.ok(advanced.state.destinations.some((item) => item.id === "followup:ashen-wood"));
  assert.ok(advanced.report.log.some((entry) => entry.type === "followup-unlocked"));
});

test("browser bridge loads the follow-up destination sidecar", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-followup-destinations\.js/);
  assert.match(bridgeSource, /loadFollowupDestinations/);
});
