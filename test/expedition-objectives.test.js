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
  assert.equal(trace.encounterId, "wolves");
  assert.ok(report.log.some((entry) => entry.type === "hunt-trace" && entry.causes.includes("learned value")));

  const applied = objectives.persistHuntTrace(system.applyReport(state, report), report);
  assert.ok(applied.discoveredDestinationIds.includes(trace.id));
  objectives.persistHuntTrace(applied, report);
  assert.equal(applied.discoveredDestinationIds.filter((id) => id === trace.id).length, 1);
});

test("available hunt traces come from unresolved report knowledge", () => {
  const trace = {
    id: "hunt-trace-ashen-wood-wolves",
    name: "灰狼の群れの追跡痕",
    sourceDestinationId: "ashen-wood",
    kind: "hunt-trace",
  };
  const state = system.initialState();
  state.completedReports = [{
    expeditionId: "exp-old",
    discoveries: [trace],
    combat: { encounters: [{ encounterId: "wolves", encounterName: "灰狼の群れ", result: "victory" }] },
  }];
  state.discoveredDestinationIds.push(trace.id);

  const available = objectives.availableHuntTraces(state);
  assert.equal(available.length, 1);
  assert.equal(available[0].encounterId, "wolves");
  assert.equal(available[0].encounterName, "灰狼の群れ");

  state.discoveredDestinationIds = state.discoveredDestinationIds.filter((id) => id !== trace.id);
  assert.equal(objectives.availableHuntTraces(state).length, 0);
});

test("following a matching trace awards one trophy and resolves the trace on victory", () => {
  const trace = {
    id: "hunt-trace-ashen-wood-wolves",
    name: "灰狼の群れの追跡痕",
    sourceDestinationId: "ashen-wood",
    encounterId: "wolves",
    encounterName: "灰狼の群れ",
    kind: "hunt-trace",
  };
  const report = {
    expeditionId: "exp-track",
    destinationId: "ashen-wood",
    loot: [],
    discoveries: [],
    combat: { encounters: [{ encounterId: "wolves", encounterName: "灰狼の群れ", result: "victory" }] },
    log: [],
  };

  objectives.decorateReport(report, "hunt", trace);
  objectives.decorateReport(report, "hunt", trace);
  assert.equal(report.trackedHuntResolved, true);
  assert.equal(report.targetHuntTraceId, trace.id);
  assert.equal(report.loot.filter((item) => item.tags.includes("tracked-hunt")).length, 1);
  assert.equal(report.log.filter((entry) => entry.type === "tracked-hunt").length, 1);
  assert.equal(report.discoveries.some((item) => item.kind === "hunt-trace"), false, "tracking an existing trace should not manufacture a replacement trace");

  const state = system.initialState();
  state.discoveredDestinationIds.push(trace.id);
  objectives.resolveTrackedHuntState(state, report);
  assert.equal(state.discoveredDestinationIds.includes(trace.id), false);
});

test("failed or wrong-destination tracked hunts keep the trace for another attempt", () => {
  const trace = {
    id: "hunt-trace-ashen-wood-wolves",
    name: "灰狼の群れの追跡痕",
    sourceDestinationId: "ashen-wood",
    encounterId: "wolves",
    encounterName: "灰狼の群れ",
    kind: "hunt-trace",
  };
  const failed = {
    destinationId: "ashen-wood",
    loot: [], discoveries: [],
    combat: { encounters: [{ encounterId: "wolves", encounterName: "灰狼の群れ", result: "retreat" }] },
    log: [],
  };
  objectives.decorateReport(failed, "hunt", trace);
  assert.equal(failed.trackedHuntResolved, false);
  assert.equal(failed.loot.length, 0);

  const wrongPlace = {
    destinationId: "black-mine",
    loot: [], discoveries: [],
    combat: { encounters: [{ encounterId: "wolves", encounterName: "灰狼の群れ", result: "victory" }] },
    log: [],
  };
  objectives.decorateReport(wrongPlace, "hunt", trace);
  assert.equal(wrongPlace.trackedHuntResolved, false);

  const state = system.initialState();
  state.discoveredDestinationIds.push(trace.id);
  objectives.resolveTrackedHuntState(state, failed);
  objectives.resolveTrackedHuntState(state, wrongPlace);
  assert.equal(state.discoveredDestinationIds.includes(trace.id), true);
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

test("browser slice exposes objective and hunt-target choices through the existing expedition bridge", () => {
  const objectiveSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-objectives.js"), "utf8");
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");

  assert.match(objectiveSource, /name = "objective"/);
  assert.match(objectiveSource, /value = objective\.id/);
  assert.match(objectiveSource, /新しい手掛かりや発見を優先する/);
  assert.match(objectiveSource, /持ち帰れる戦利品を優先する/);
  assert.match(objectiveSource, /敵対遭遇から標的の痕跡を探す/);
  assert.match(objectiveSource, /name = "huntTrace"/);
  assert.match(objectiveSource, /狩りの標的/);
  assert.match(objectiveSource, /新しい痕跡を探す/);
  assert.match(objectiveSource, /討伐証/);
  assert.match(objectiveSource, /目的: /);
  assert.match(bridgeSource, /src\/expedition-objectives\.js/);
});
