"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const objectives = require("../src/expedition-objectives.js");
const system = require("../src/expedition-system.js");

function reportFor(objective, seed) {
  let state = system.initialState();
  state = system.dispatchExpedition(state, {
    destinationId: "hollow-village",
    companionIds: ["mira"],
    equipmentIds: [],
    policyId: "standard",
    objective,
    seed,
    durationMs: 0,
  }, 1_700_000_000_000);
  return system.resolveExpedition(state.activeExpedition, state);
}

test("objective ids normalize safely to explore", () => {
  assert.equal(objectives.normalizeObjective("explore"), "explore");
  assert.equal(objectives.normalizeObjective("scavenge"), "scavenge");
  assert.equal(objectives.normalizeObjective("hunt"), "explore");
  assert.equal(objectives.normalizeObjective("anything-else"), "explore");
  assert.equal(objectives.normalizeObjective(null), "explore");
});

test("decorated reports remember the expedition purpose", () => {
  const report = objectives.decorateReport({ expeditionId: "exp-test" }, "scavenge");
  assert.equal(report.objectiveId, "scavenge");
  assert.equal(report.objectiveName, "漁り");
});

test("explore and scavenge already produce different reward tendencies in the canonical resolver", () => {
  let exploreDiscoveries = 0;
  let exploreLoot = 0;
  let scavengeDiscoveries = 0;
  let scavengeLoot = 0;

  for (let seed = 1; seed <= 80; seed += 1) {
    const explore = reportFor("explore", seed);
    const scavenge = reportFor("scavenge", seed);
    exploreDiscoveries += explore.discoveries.length;
    exploreLoot += explore.loot.length;
    scavengeDiscoveries += scavenge.discoveries.length;
    scavengeLoot += scavenge.loot.length;
  }

  assert.ok(exploreDiscoveries > scavengeDiscoveries, `${exploreDiscoveries} should exceed ${scavengeDiscoveries}`);
  assert.ok(scavengeLoot > exploreLoot, `${scavengeLoot} should exceed ${exploreLoot}`);
});

test("browser slice exposes two player-visible choices and is loaded by the existing expedition bridge", () => {
  const objectiveSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-objectives.js"), "utf8");
  const bridgeSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-unknown-bridge.js"), "utf8");

  assert.match(objectiveSource, /name = "objective"/);
  assert.match(objectiveSource, /value = objective\.id/);
  assert.match(objectiveSource, /新しい手掛かりや発見を優先する/);
  assert.match(objectiveSource, /持ち帰れる戦利品を優先する/);
  assert.match(objectiveSource, /目的: /);
  assert.match(bridgeSource, /src\/expedition-objectives\.js/);
});
