"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluatePlaytest } = require("../scripts/evaluate-playtest-jev.cjs");

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("16-run core-loop regression baseline stays bounded and observable", async () => {
  const originalRandom = Math.random;
  Math.random = mulberry32(0xC0FFEE);
  try {
    const report = await evaluatePlaytest({ runs: 4, dryRun: true });
    const traces = report.results.map((entry) => entry.trace);
    const turns = traces.map((trace) => trace.totalTurns);
    const combatTurns = traces.map((trace) => trace.combatTurns);
    const deaths = traces.filter((trace) => trace.died);
    const recoverableDeaths = deaths.filter((trace) => trace.hearthOutcome.recoveryCache);

    const baseline = {
      totalRuns: report.summary.totalRuns,
      clearedCount: report.summary.clearedCount,
      avgTacticalDepth: report.summary.avgTacticalDepth,
      avgRiskTension: report.summary.avgRiskTension,
      avgMotivation: report.summary.avgMotivation,
      avgPacingDragRisk: report.summary.avgPacingDragRisk,
      avgTurns: Number((turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(2)),
      maxTurns: Math.max(...turns),
      avgCombatTurns: Number((combatTurns.reduce((a, b) => a + b, 0) / combatTurns.length).toFixed(2)),
      maxCombatTurns: Math.max(...combatTurns),
      deaths: deaths.length,
      recoverableDeaths: recoverableDeaths.length,
      warnings: report.summary.warnings.map((warning) => warning.code),
    };

    console.log("CORE_LOOP_BASELINE " + JSON.stringify(baseline));

    assert.equal(report.summary.totalRuns, 16);
    assert.equal(traces.length, 16);
    assert.ok(baseline.maxTurns < 100, "no deterministic run should hit the simulator turn cap");
    assert.ok(Number.isFinite(report.summary.avgMotivation));
    assert.ok(Number.isFinite(report.summary.avgPacingDragRisk));
    assert.ok(recoverableDeaths.length <= deaths.length);
  } finally {
    Math.random = originalRandom;
  }
});
