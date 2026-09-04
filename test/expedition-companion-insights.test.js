"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const insights = require("../src/expedition-companion-insights.js");
const system = require("../src/expedition-system.js");

function expedition(companionIds, objective, policyId, destinationId = "ashen-wood") {
  return { id: "exp-test", inputs: { companionIds, objective, policyId, destinationId } };
}

function report(outcome = "success", destinationId = "ashen-wood") {
  return { expeditionId: "exp-test", destinationId, outcome, discoveries: [], injuries: [], log: [] };
}

function addWaterDestination(state) {
  state.destinations.push({
    id: "world:river-crossing",
    name: "川沿いの古い渡し場",
    family: "village",
    dangerTags: ["wet-ground"],
    opportunityTags: ["water", "passage"],
    durationMs: 60_000,
    geographic: true,
  });
  return state;
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

test("Ed's nearby hauling background reveals a water-only follow-up route", () => {
  const state = addWaterDestination(system.initialState());
  const exp = expedition(["ed"], "explore", "cautious", "world:river-crossing");
  const result = report("success", "world:river-crossing");

  insights.applyCompanionInsights(result, exp, state);

  assert.equal(result.geographicCompanionKnowledge.companionId, "ed");
  assert.equal(result.geographicCompanionKnowledge.effect, "reveal-local-hauler-route");
  assert.equal(result.discoveries.length, 1);
  assert.equal(result.discoveries[0].name, "荷運びの脇渡り");
  assert.equal(result.discoveries[0].sourceDestinationId, "world:river-crossing");
  assert.match(result.discoveries[0].detail, /エド/);
  assert.equal(result.log.filter((item) => item.type === "geographic-companion").length, 1);
  assert.equal(result.companionInsights, undefined, "local knowledge must not require agreeing with Ed's hunt proposal");
});

test("local hauling knowledge is a party choice, not a universal water bonus", () => {
  const state = addWaterDestination(system.initialState());
  const withMira = insights.applyCompanionInsights(
    report("success", "world:river-crossing"),
    expedition(["mira"], "explore", "standard", "world:river-crossing"),
    state
  );
  const dry = insights.applyCompanionInsights(
    report("success", "ashen-wood"),
    expedition(["ed"], "explore", "standard", "ashen-wood"),
    state
  );

  assert.equal(withMira.geographicCompanionKnowledge, undefined);
  assert.equal(withMira.discoveries.length, 0);
  assert.equal(dry.geographicCompanionKnowledge, undefined);
  assert.equal(dry.discoveries.length, 0);
});

test("local hauling route decoration is idempotent", () => {
  const state = addWaterDestination(system.initialState());
  const exp = expedition(["ed"], "explore", "standard", "world:river-crossing");
  const result = report("early-return", "world:river-crossing");

  insights.applyCompanionInsights(result, exp, state);
  insights.applyCompanionInsights(result, exp, state);

  assert.equal(result.discoveries.filter((item) => item.name === "荷運びの脇渡り").length, 1);
  assert.equal(result.log.filter((item) => item.type === "geographic-companion").length, 1);
});

test("an injured survivor records one danger-specific scar memory", () => {
  const state = system.initialState();
  const exp = expedition(["mira"], "explore", "standard", "hollow-village");
  const result = report("success", "hollow-village");
  result.injuries = ["mira"];

  insights.applyInjuryScar(result, exp, state);
  insights.applyInjuryScar(result, exp, state);
  insights.persistScarMemories(state, result);
  insights.persistScarMemories(state, result);

  const trait = insights.scarTrait("bandit");
  const mira = state.companions.find((item) => item.id === "mira");
  assert.equal(result.scarMemories.length, 1);
  assert.equal(result.scarMemories[0].trait, trait);
  assert.equal(result.log.filter((item) => item.type === "scar-earned").length, 1);
  assert.equal(mira.traits.filter((item) => item === trait).length, 1);
  assert.match(mira.history, /banditの危地で負った傷を覚えた/);
});

test("returning cautiously with a scarred companion reveals a retreat route", () => {
  const state = system.initialState();
  const mira = state.companions.find((item) => item.id === "mira");
  mira.traits.push(insights.scarTrait("bandit"));
  const exp = expedition(["mira"], "explore", "cautious", "hollow-village");
  const result = report("success", "hollow-village");

  insights.applyCompanionInsights(result, exp, state);
  insights.applyCompanionInsights(result, exp, state);

  assert.equal(result.scarRouteKnowledge.companionId, "mira");
  assert.equal(result.scarRouteKnowledge.effect, "reveal-retreat-route");
  assert.equal(result.discoveries.filter((item) => item.name === "古傷が覚えた退避路").length, 1);
  assert.equal(result.log.filter((item) => item.type === "scar-route").length, 1);
});

test("scar memory changes a real party and policy choice rather than granting a universal bonus", () => {
  const state = system.initialState();
  state.companions.find((item) => item.id === "mira").traits.push(insights.scarTrait("bandit"));

  const standard = insights.applyCompanionInsights(
    report("success", "hollow-village"),
    expedition(["mira"], "explore", "standard", "hollow-village"),
    state
  );
  const wrongCompanion = insights.applyCompanionInsights(
    report("success", "hollow-village"),
    expedition(["ed"], "explore", "cautious", "hollow-village"),
    state
  );
  const wrongDanger = insights.applyCompanionInsights(
    report("success", "ashen-wood"),
    expedition(["mira"], "explore", "cautious", "ashen-wood"),
    state
  );

  assert.equal(standard.scarRouteKnowledge, undefined);
  assert.equal(wrongCompanion.scarRouteKnowledge, undefined);
  assert.equal(wrongDanger.scarRouteKnowledge, undefined);
});

test("browser bridge loads the companion insight slice after proposal UI", () => {
  const bridge = fs.readFileSync(path.join(__dirname, "../src/expedition-unknown-bridge.js"), "utf8");
  assert.match(bridge, /loadCompanionProposals\(root\);\s*api\.loadCompanionInsights\(root\)/);
  assert.match(bridge, /src\/expedition-companion-insights\.js/);
});
