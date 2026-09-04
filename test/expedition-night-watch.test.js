"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../src/expedition-system.js");
const fieldCamp = require("../src/expedition-field-camp.js");
const nightWatch = require("../src/expedition-night-watch.js");

test("each companion produces a distinct night-watch follow-up", () => {
  const profiles = ["mira", "ed", "sella"].map((id) => nightWatch.nightWatchProfile(id));
  assert.deepEqual(profiles.map((item) => item.companionName), ["ミラ", "エド", "セラ"]);
  assert.equal(new Set(profiles.map((item) => item.name)).size, 3);
  assert.equal(new Set(profiles.map((item) => nightWatch.followupId("ashen-wood", item.companionId))).size, 3);
});

test("successful two-person field camp adds exactly one chosen watcher clue", () => {
  const expedition = {
    id: "exp-watch-mira",
    inputs: {
      destinationId: "ashen-wood",
      companionIds: ["mira", "ed"],
      stayPlan: "field-camp",
      nightWatchId: "mira",
    },
  };
  const report = { expeditionId: expedition.id, outcome: "success", discoveries: [], log: [] };
  nightWatch.decorateReport(report, expedition);
  nightWatch.decorateReport(report, expedition);

  assert.equal(report.nightWatch.companionId, "mira");
  assert.equal(report.discoveries.filter((item) => item.kind === "night-watch-followup").length, 1);
  assert.match(report.discoveries[0].name, /ミラ/);
  assert.equal(report.log.filter((entry) => entry.type === "night-watch").length, 1);
  assert.ok(report.log[0].causes.includes("mira"));
});

test("failure, normal stay, one-person party, and non-party watcher yield no night-watch clue", () => {
  const cases = [
    { outcome: "failed", inputs: { stayPlan: "field-camp", companionIds: ["mira", "ed"], nightWatchId: "mira" } },
    { outcome: "success", inputs: { stayPlan: "normal", companionIds: ["mira", "ed"], nightWatchId: "mira" } },
    { outcome: "success", inputs: { stayPlan: "field-camp", companionIds: ["mira"], nightWatchId: "mira" } },
    { outcome: "success", inputs: { stayPlan: "field-camp", companionIds: ["mira", "ed"], nightWatchId: "sella" } },
  ];
  for (const [index, item] of cases.entries()) {
    const report = { expeditionId: `bad-${index}`, outcome: item.outcome, discoveries: [], log: [] };
    nightWatch.decorateReport(report, { id: `bad-${index}`, inputs: { destinationId: "ashen-wood", ...item.inputs } });
    assert.equal(report.nightWatch, undefined);
    assert.equal(report.discoveries.length, 0);
  }
});

test("night-watch destination is applied idempotently and preserves source geography", () => {
  const state = system.initialState();
  const expedition = {
    id: "exp-watch-ed",
    inputs: { destinationId: "hollow-village", companionIds: ["mira", "ed"], stayPlan: "field-camp", nightWatchId: "ed" },
  };
  const report = { expeditionId: expedition.id, outcome: "success", discoveries: [], log: [] };
  nightWatch.decorateReport(report, expedition);
  const first = nightWatch.unlockNightWatchDestination(state, report);
  const second = nightWatch.unlockNightWatchDestination(state, report);

  assert.equal(first.id, second.id);
  assert.equal(state.destinations.filter((item) => item.id === first.id).length, 1);
  assert.equal(state.discoveredDestinationIds.filter((id) => id === first.id).length, 1);
  assert.equal(first.family, "village");
  assert.equal(first.nightWatchLead.sourceDestinationId, "hollow-village");
  assert.equal(first.nightWatchLead.companionId, "ed");
});

test("dispatch hook persists only a selected watcher who is in a two-person field camp", () => {
  const wrapped = { ...system };
  fieldCamp.installSystemHooks({ CrownlessExpeditionSystem: wrapped });
  nightWatch.installSystemHooks({ CrownlessExpeditionSystem: wrapped });

  fieldCamp.setSelectedStay(fieldCamp.FIELD_CAMP);
  nightWatch.setSelectedNightWatch("sella");
  const dispatched = wrapped.dispatchExpedition(wrapped.initialState(), {
    destinationId: "ashen-wood",
    companionIds: ["mira", "sella"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
    seed: 41,
  }, 1_000_000);
  assert.equal(dispatched.activeExpedition.inputs.stayPlan, "field-camp");
  assert.equal(dispatched.activeExpedition.inputs.nightWatchId, "sella");

  fieldCamp.setSelectedStay(fieldCamp.FIELD_CAMP);
  nightWatch.setSelectedNightWatch("sella");
  const solo = wrapped.dispatchExpedition({ ...wrapped.initialState(), activeExpedition: null }, {
    destinationId: "ashen-wood",
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective: "explore",
    seed: 42,
  }, 2_000_000);
  assert.equal(solo.activeExpedition.inputs.nightWatchId, undefined);
});

test("night-watch prepare UI communicates the optional companion choice", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-night-watch.js"), "utf8");
  assert.match(source, /野営の夜番/);
  assert.match(source, /全員を休ませる/);
  assert.match(source, /夜番を任せる/);
  assert.match(source, /data-expedition-night-watch/);
});

test("browser bridge loads the night-watch sidecar after camp features", () => {
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");
  assert.match(bridgeSource, /src\/expedition-night-watch\.js/);
  assert.match(bridgeSource, /loadNightWatch/);
  assert.ok(bridgeSource.indexOf("api.loadFieldCamp(root)") < bridgeSource.indexOf("api.loadNightWatch(root)"));
});
