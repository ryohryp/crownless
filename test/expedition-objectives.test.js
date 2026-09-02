"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const objectives = require("../src/expedition-objectives.js");
const system = require("../src/expedition-system.js");

test("objective ids normalize safely to explore", () => {
  assert.equal(objectives.normalizeObjective("explore"), "explore");
  assert.equal(objectives.normalizeObjective("scavenge"), "scavenge");
  assert.equal(objectives.normalizeObjective("hunt"), "hunt");
  assert.equal(objectives.normalizeObjective("anything-else"), "explore");
  assert.equal(objectives.normalizeObjective(null), "explore");
});

test("decorated reports remember the expedition purpose", () => {
  const report = objectives.decorateReport({ expeditionId: "exp-test" }, "scavenge");
  assert.equal(report.objectiveId, "scavenge");
  assert.equal(report.objectiveName, "漁り");
});

test("hunt turns a hostile encounter into a persistent target trace", () => {
  const state = system.dispatchExpedition(system.initialState(), {
    destinationId: "ashen-wood",
    companionIds: ["mira", "ed"],
    equipmentIds: ["shortbow", "herb-kit"],
    policyId: "standard",
    objective: "hunt",
    seed: 44,
    durationMs: 0,
  }, 1_000_000);
  const report = objectives.decorateReport(system.resolveExpedition(state.activeExpedition, state), "hunt");
  const trace = report.discoveries.find((item) => item.kind === "hunt-trace");

  assert.ok(trace, "expected Hunt to record a target trace from the hostile encounter");
  assert.match(trace.name, /追跡痕$/);
  assert.ok(report.log.some((entry) => entry.type === "hunt-trace" && entry.causes.includes("learned value")));

  const applied = objectives.persistHuntTrace(system.applyReport(state, report), report);
  assert.ok(applied.discoveredDestinationIds.includes(trace.id));
  objectives.persistHuntTrace(applied, report);
  assert.equal(applied.discoveredDestinationIds.filter((id) => id === trace.id).length, 1);
});

test("non-hunt objectives do not manufacture a target trace", () => {
  const report = {
    destinationId: "ashen-wood",
    discoveries: [],
    combat: { encounters: [{ encounterId: "wolves", encounterName: "灰狼の群れ" }] },
    log: [],
  };
  objectives.decorateReport(report, "explore");
  assert.equal(report.discoveries.some((item) => item.kind === "hunt-trace"), false);
});

test("canonical resolver gives explore a discovery bias and scavenge a loot bias", () => {
  const resolverSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-system.js"), "utf8");

  assert.match(resolverSource, /objective === "scavenge" \? 0\.12 : 0/);
  assert.match(resolverSource, /objective === "explore" \? 0\.18 : 0/);
});

test("browser slice exposes three player-visible choices and is loaded by the existing expedition bridge", () => {
  const objectiveSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-objectives.js"), "utf8");
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");

  assert.match(objectiveSource, /name = "objective"/);
  assert.match(objectiveSource, /value = objective\.id/);
  assert.match(objectiveSource, /新しい手掛かりや発見を優先する/);
  assert.match(objectiveSource, /持ち帰れる戦利品を優先する/);
  assert.match(objectiveSource, /敵対遭遇から標的の痕跡を探す/);
  assert.match(objectiveSource, /目的: /);
  assert.match(bridgeSource, /src\/expedition-objectives\.js/);
});
