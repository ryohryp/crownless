"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildJevState,
  buildJevQuestions,
  callJevSystemOne,
  fallbackEvaluation,
  detectLoopAnomalies,
  evaluatePlaytest,
} = require("../scripts/evaluate-playtest-jev.cjs");
const { simulateExpedition } = require("../scripts/simulate-playtest.cjs");

test("buildJevState formats bounded and structured run data", () => {
  const trace = simulateExpedition({ archetype: "tactician", place: "wood" });
  const state = buildJevState(trace);

  assert.equal(state.game, "Crownless");
  assert.equal(state.player_archetype, "tactician");
  assert.equal(state.destination, "wood");
  assert.equal(typeof state.run_outcome.cleared, "boolean");
  assert.equal(typeof state.health_and_tension.max_hp, "number");
  assert.ok(Object.hasOwn(trace.hearthOutcome, "recoveryCache"));
  assert.ok(Object.hasOwn(state.progression_at_hearth, "recovery_cache"));
  assert.ok(Object.hasOwn(state.progression_at_hearth, "quality_upgrade_found"));
  assert.ok(Array.isArray(state.run_outcome.gear_qualities));
  assert.ok(Array.isArray(state.run_outcome.duplicate_loot));
  assert.ok(Array.isArray(state.narrative_log_excerpt));
});

test("buildJevQuestions uses valid TypeSafe Jev System One primitive types", () => {
  const questions = buildJevQuestions();

  assert.equal(questions.tactical_depth.type, "score");
  assert.ok(Array.isArray(questions.tactical_depth.criteria));
  assert.equal(questions.tactical_depth.criteria.length, 5);

  assert.equal(questions.risk_reward_tension.type, "score");
  assert.ok(Array.isArray(questions.risk_reward_tension.criteria));

  assert.equal(questions.one_more_run_motivation.type, "score");
  assert.ok(Array.isArray(questions.one_more_run_motivation.criteria));

  assert.equal(questions.fun_loop_status.type, "choice");
  assert.equal(typeof questions.fun_loop_status.criteria, "object");
  assert.ok(questions.fun_loop_status.criteria.healthy_loop);

  assert.equal(questions.pacing_drag_risk.type, "noul");
  assert.equal(typeof questions.pacing_drag_risk.criteria, "object");
});

test("detectLoopAnomalies flags rusher survival and early tactician wipeouts", () => {
  const syntheticResults = [
    {
      trace: { archetype: "rusher", cleared: true, totalTurns: 20 },
      eval: { fun_loop_status: { choice: "healthy_loop" } },
    },
    {
      trace: { archetype: "tactician", died: true, depthReached: 1, totalTurns: 10 },
      eval: { fun_loop_status: { choice: "healthy_loop" } },
    },
    {
      trace: { archetype: "cautious", cleared: true, totalTurns: 30 },
      eval: { fun_loop_status: { choice: "unrewarding_loot" } },
    },
  ];

  const warnings = detectLoopAnomalies(syntheticResults);
  assert.equal(warnings.length, 3);
  assert.equal(warnings[0].code, "MINDLESS_COMBAT_SURVIVED");
  assert.equal(warnings[1].code, "TACTICIAN_EARLY_WIPEOUT");
  assert.equal(warnings[2].code, "UNREWARDING_LOOT");
});

test("fallbackEvaluation provides consistent heuristic results offline", () => {
  const trace = {
    archetype: "tactician",
    cleared: true,
    died: false,
    newGearFound: ["fang"],
    scrapGained: 20,
    depthReached: 2,
    totalTurns: 40,
    metrics: { intentResponseAccuracy: 0.85, nearDeathMoments: 1, lootCarriedAtRisk: 15 },
    hearthOutcome: { canEquipNew: true, canUpgrade: true },
  };

  const res = fallbackEvaluation(trace);
  assert.ok(res.tactical_depth.score >= 3.5);
  assert.ok(res.one_more_run_motivation.score >= 3.0);
  assert.equal(res.fun_loop_status.choice, "healthy_loop");
  assert.ok(res.pacing_drag_risk.noul < 0.4);
});

test("fallbackEvaluation treats a rescue cache as a reason to make one more run", () => {
  const trace = {
    archetype: "tactician",
    cleared: false,
    died: true,
    newGearFound: [],
    scrapGained: 18,
    depthReached: 2,
    totalTurns: 45,
    metrics: { intentResponseAccuracy: 0.8, nearDeathMoments: 1, lootCarriedAtRisk: 18 },
    hearthOutcome: { canEquipNew: false, canUpgrade: false, recoveryCache: { gear: null, scrap: 8 } },
  };

  const res = fallbackEvaluation(trace);
  assert.equal(res.one_more_run_motivation.score, 2.8);
});

test("evaluatePlaytest runs with custom mock fetch", async () => {
  const mockFetch = async () => ({
    ok: true,
    json: async () => ({
      model: "jev-1.13.0",
      answers: {
        tactical_depth: { type: "score", score: 4.2, confidence: 0.85 },
        risk_reward_tension: { type: "score", score: 3.8, confidence: 0.8 },
        one_more_run_motivation: { type: "score", score: 4.5, confidence: 0.9 },
        fun_loop_status: { type: "choice", choice: "healthy_loop", confidence: 0.88 },
        pacing_drag_risk: { type: "noul", noul: 0.15 },
      },
    }),
  });

  const report = await evaluatePlaytest({
    archetype: "tactician",
    runs: 1,
    apiKey: "mock_api_key",
    fetchFn: mockFetch,
  });

  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].jevAvailable, true);
  assert.equal(report.results[0].eval.tactical_depth.score, 4.2);
  assert.equal(report.results[0].eval.fun_loop_status.choice, "healthy_loop");
  assert.equal(report.summary.warnings.length, 0);
});

test("live Jev System One evaluation succeeds when API key is available", { skip: !process.env.TYPESAFE_API_KEY }, async () => {
  const report = await evaluatePlaytest({
    archetype: "tactician",
    runs: 1,
  });

  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].jevAvailable, true);
  assert.ok(Number.isFinite(report.results[0].eval.tactical_depth.score));
  assert.ok(Number.isFinite(report.results[0].eval.risk_reward_tension.score));
  assert.ok(Number.isFinite(report.results[0].eval.one_more_run_motivation.score));
  assert.ok(typeof report.results[0].eval.fun_loop_status.choice === "string");
  assert.ok(Number.isFinite(report.results[0].eval.pacing_drag_risk.noul));
});


test("fallbackEvaluation treats a better-quality duplicate as one-more-run progression", () => {
  const trace = {
    archetype: "tactician",
    cleared: true,
    died: false,
    newGearFound: [],
    gearGained: ["fang"],
    scrapGained: 9,
    depthReached: 1,
    totalTurns: 30,
    metrics: { intentResponseAccuracy: 0.8, nearDeathMoments: 0, lootCarriedAtRisk: 9 },
    hearthOutcome: { canEquipNew: false, canUpgrade: false, qualityUpgradeFound: true, recoveryCache: null },
  };
  const res = fallbackEvaluation(trace);
  assert.ok(res.one_more_run_motivation.score >= 3.0);
  assert.notEqual(res.fun_loop_status.choice, "unrewarding_loot");
});
