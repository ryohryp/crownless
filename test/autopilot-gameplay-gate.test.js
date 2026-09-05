const assert = require("node:assert/strict");
const test = require("node:test");

const { assessGameplayGate } = require("../scripts/autopilot/gameplay-gate.js");

function score(value = 2, applicable = true, rationale = "test rationale") {
  return { applicable, score: value, rationale };
}
function gate(overrides = {}) {
  return {
    playerVisible: score(), decision: score(), riskReward: score(0, false), coreLoop: score(),
    replayability: score(), fantasy: score(), geography: score(0, false), canon: score(3), ...overrides,
  };
}
function candidate(title, kind, locationRelated, gameplayGate, reason, selected) {
  return { title, kind, locationRelated, gameplayGate, reason, selected, learningSources: [], revisitsKilledHypothesis: false, killRevisitEvidence: null };
}
function hypothesis() {
  return {
    interestingDecision: "Do I risk the wounded party for the unknown cache?",
    mda: { mechanic: "Press on or return", dynamic: "Known danger competes with uncertain reward", desiredExperience: "Tense commitment" },
    verticalSlice: {
      discoveryOrInformation: "A dangerous cache is revealed", decision: "Press on or return", action: "Choose the cache route",
      resultOrDanger: "The party risks injury", rewardOrLoss: "Rare salvage or lost supplies", persistentChange: "Preparation changes next expedition",
    },
  };
}
function proposal(overrides = {}) {
  const { selectedGate: selectedGateOverride, locationRelated: locationRelatedOverride, ...proposalOverrides } = overrides;
  const title = proposalOverrides.title || "Risk the side route for a hidden cache";
  const proposalType = proposalOverrides.proposalType || "gameplay";
  const selectedGate = selectedGateOverride || gate();
  const locationRelated = locationRelatedOverride || false;
  return {
    action: "create_issue", title, whyNow: "Recent cycles added little new play", scope: "One end-to-end expedition choice",
    acceptanceCriteria: ["The choice can be experienced once end-to-end"], nonGoals: ["No economy rebalance"],
    risk: "low", humanGate: false, playtestRequired: proposalType === "gameplay", proposalType,
    recentCycleReview: { cyclesReviewed: 5, newPlayAdded: false, maintenanceHeavy: false, summary: "Mostly maintenance recently" },
    recentPlaytestLearning: { entries: [], summary: "No human-confirmed playtest learning found" },
    learningApplication: { appliedSources: [], ignoredSources: [], summary: "No playtest learning to apply" },
    candidates: [
      candidate(title, proposalType, locationRelated, selectedGate, "Adds the strongest new decision", true),
      candidate("Alternative A", "gameplay", false, gate(), "Less replayable", false),
      candidate("Alternative B", "gameplay", false, gate(), "Larger slice", false),
    ],
    gameplayHypothesis: proposalType === "gameplay" ? hypothesis() : null,
    ...proposalOverrides,
  };
}

test("allows a gameplay hypothesis that clears Decision and Core Loop hard gates", () => {
  assert.deepEqual(assessGameplayGate(proposal()).reasons, []);
  assert.equal(assessGameplayGate(proposal()).decision, "continue");
});

test("rejects gameplay innovation when Decision is zero", () => {
  const result = assessGameplayGate(proposal({ selectedGate: gate({ decision: score(0) }) }));
  assert.equal(result.decision, "stop");
  assert.ok(result.reasons.includes("decision_zero"));
});

test("rejects gameplay innovation when Core Loop is zero", () => {
  const result = assessGameplayGate(proposal({ selectedGate: gate({ coreLoop: score(0) }) }));
  assert.equal(result.decision, "stop");
  assert.ok(result.reasons.includes("core_loop_zero"));
});

test("location-related gameplay requires a Geography contribution", () => {
  const result = assessGameplayGate(proposal({ locationRelated: true }));
  assert.ok(result.reasons.includes("location_without_geography"));

  const passing = assessGameplayGate(proposal({
    locationRelated: true,
    selectedGate: gate({ geography: score(2, true, "Walking here discovers and persists this local route") }),
  }));
  assert.equal(passing.decision, "continue");
});

test("non-bug selection requires three compared candidates", () => {
  const value = proposal();
  value.candidates = value.candidates.slice(0, 2);
  const result = assessGameplayGate(value);
  assert.ok(result.reasons.includes("three_candidate_comparison_required"));
});

test("a clear bug may short-circuit three-candidate ideation", () => {
  const value = proposal({ proposalType: "bug" });
  value.candidates = [value.candidates[0]];
  const result = assessGameplayGate(value);
  assert.equal(result.decision, "continue");
});

test("blocks another maintenance task during a maintenance-heavy streak", () => {
  const value = proposal({ proposalType: "maintenance" });
  value.recentCycleReview.maintenanceHeavy = true;
  const result = assessGameplayGate(value);
  assert.ok(result.reasons.includes("maintenance_streak"));
});

test("gameplay innovation must remain Playtest pending after implementation", () => {
  const result = assessGameplayGate(proposal({ playtestRequired: false }));
  assert.ok(result.reasons.includes("gameplay_playtest_required"));
});
