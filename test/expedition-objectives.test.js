"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const objectives = require("../src/expedition-objectives.js");

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

test("canonical resolver gives explore a discovery bias and scavenge a loot bias", () => {
  const resolverSource = fs.readFileSync(path.join(__dirname, "..", "src", "expedition-system.js"), "utf8");

  assert.match(resolverSource, /objective === "scavenge" \? 0\.12 : 0/);
  assert.match(resolverSource, /objective === "explore" \? 0\.18 : 0/);
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
