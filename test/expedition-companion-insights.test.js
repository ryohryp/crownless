"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const insights = require("../src/expedition-companion-insights.js");
const system = require("../src/expedition-system.js");

function expedition(companionIds, objective, policyId) {
  return { id: "exp-test", inputs: { companionIds, objective, policyId } };
}

function report(outcome = "success") {
  return { expeditionId: "exp-test", destinationId: "ashen-wood", outcome, log: [] };
}

test("following Mira's proposal leaves a companion insight in the returned report", () => {
  const state = system.initialState();
  const result = insights.applyCompanionInsights(report(), expedition(["mira"], "explore", "cautious"), state);

  assert.equal(result.companionInsights.length, 1);
  assert.equal(result.companionInsights[0].companionId, "mira");
  assert.equal(result.log.filter((item) => item.type === "companion-insight").length, 1);
  assert.equal(result.notableEvent.type, "companion-insight");
});

test("ignoring a proposal does not invent an insight or penalize the report", () => {
  const state = system.initialState();
  const result = insights.applyCompanionInsights(report(), expedition(["mira"], "hunt", "standard"), state);

  assert.equal(result.companionInsights, undefined);
  assert.equal(result.log.length, 0);
});

test("missing or failed expeditions do not award a proposal insight", () => {
  const state = system.initialState();
  for (const outcome of ["missing", "failed"]) {
    const result = insights.applyCompanionInsights(report(outcome), expedition(["ed"], "hunt", "standard"), state);
    assert.equal(result.companionInsights, undefined);
    assert.equal(result.log.length, 0);
  }
});

test("two-person parties only credit companions whose proposal matches the dispatch", () => {
  const state = system.initialState();
  const result = insights.applyCompanionInsights(report(), expedition(["mira", "ed"], "hunt", "standard"), state);

  assert.deepEqual(result.companionInsights.map((item) => item.companionId), ["ed"]);
});

test("decorating the same report repeatedly is idempotent", () => {
  const state = system.initialState();
  const exp = expedition(["sella"], "scavenge", "greedy");
  const result = report("early-return");

  insights.applyCompanionInsights(result, exp, state);
  insights.applyCompanionInsights(result, exp, state);

  assert.equal(result.companionInsights.length, 1);
  assert.equal(result.log.filter((item) => item.type === "companion-insight").length, 1);
});

test("browser bridge loads the companion insight slice after proposal UI", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(bridge, /loadCompanionProposals\(root\);\s*api\.loadCompanionInsights\(root\)/);
  assert.match(bridge, /src\/expedition-companion-insights\.js/);
});
