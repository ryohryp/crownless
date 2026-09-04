const assert = require("node:assert/strict");
const test = require("node:test");

const { parsePlannerProposal, validatePlannerProposal } = require("../scripts/autopilot/planner-proposal.js");

function gate(overrides = {}) {
  const score = (value = 2, applicable = true) => ({ applicable, score: value, rationale: "test rationale" });
  return {
    playerVisible: score(),
    decision: score(),
    riskReward: score(0, false),
    coreLoop: score(),
    replayability: score(),
    fantasy: score(),
    geography: score(0, false),
    canon: score(3),
    ...overrides,
  };
}

function candidates(title, kind = "friction") {
  return [
    { title, kind, locationRelated: false, gameplayGate: gate(), reason: "best next step", selected: true },
    { title: "Alternative A", kind: "gameplay", locationRelated: false, gameplayGate: gate(), reason: "lower value now", selected: false },
    { title: "Alternative B", kind: "gameplay", locationRelated: false, gameplayGate: gate(), reason: "larger scope", selected: false },
  ];
}

function hypothesis() {
  return {
    interestingDecision: "Push farther for better loot or return safely?",
    mda: {
      mechanic: "Choose whether to press on",
      dynamic: "Players weigh known danger against uncertain reward",
      desiredExperience: "Tense expedition commitment",
    },
    verticalSlice: {
      discoveryOrInformation: "The report reveals a risky side route",
      decision: "Take the side route or return",
      action: "Commit the expedition to the side route",
      resultOrDanger: "The party may be injured",
      rewardOrLoss: "Gain rare salvage or lose supplies",
      persistentChange: "The outcome changes the next preparation choice",
    },
  };
}

function validCreateIssue(overrides = {}) {
  const title = overrides.title || "Connect report to companion recovery";
  const proposalType = overrides.proposalType || "friction";
  return {
    action: "create_issue",
    title,
    whyNow: "Report to Adapt currently has avoidable friction",
    scope: "Add one existing navigation affordance",
    acceptanceCriteria: ["The affected companion can be opened from the report"],
    nonGoals: ["No companion model changes"],
    risk: "low",
    humanGate: false,
    playtestRequired: proposalType === "gameplay",
    proposalType,
    recentCycleReview: {
      cyclesReviewed: 5,
      newPlayAdded: false,
      maintenanceHeavy: false,
      summary: "Recent cycles improved reliability but added little new play",
    },
    candidates: candidates(title, proposalType),
    gameplayHypothesis: proposalType === "gameplay" ? hypothesis() : null,
    ...overrides,
  };
}

test("accepts valid create_issue and no_action proposals", () => {
  assert.equal(validatePlannerProposal(validCreateIssue()).ok, true);
  assert.equal(validatePlannerProposal(validCreateIssue({ proposalType: "gameplay" })).ok, true);
  assert.equal(validatePlannerProposal({ action: "no_action", reason: "An Autopilot PR is already waiting for review" }).ok, true);
});

test("rejects unknown fields and hallucinated actions", () => {
  assert.deepEqual(validatePlannerProposal({ ...validCreateIssue(), magicPriority: 99 }), {
    ok: false,
    error: "unknown field(s): magicPriority",
  });
  assert.deepEqual(validatePlannerProposal({ action: "delete_everything" }), {
    ok: false,
    error: "action must be create_issue or no_action",
  });
});

test("requires recent-cycle evidence and exactly one matching selected candidate", () => {
  assert.match(validatePlannerProposal(validCreateIssue({ recentCycleReview: { cyclesReviewed: 2 } })).error, /recentCycleReview/);
  const noneSelected = validCreateIssue();
  noneSelected.candidates = noneSelected.candidates.map((candidate) => ({ ...candidate, selected: false }));
  assert.match(validatePlannerProposal(noneSelected).error, /exactly one selected/);

  const mismatched = validCreateIssue();
  mismatched.candidates[0] = { ...mismatched.candidates[0], title: "Different title" };
  assert.match(validatePlannerProposal(mismatched).error, /title must match/);
});

test("gameplay proposals require Interesting Decision, MDA, and a complete vertical slice", () => {
  assert.equal(validatePlannerProposal(validCreateIssue({ proposalType: "gameplay" })).ok, true);
  const missingDecision = validCreateIssue({ proposalType: "gameplay" });
  missingDecision.gameplayHypothesis.interestingDecision = " ";
  assert.match(validatePlannerProposal(missingDecision).error, /interestingDecision/);

  const incompleteSlice = validCreateIssue({ proposalType: "gameplay" });
  incompleteSlice.gameplayHypothesis.verticalSlice.persistentChange = "";
  assert.match(validatePlannerProposal(incompleteSlice).error, /persistentChange/);
});

test("non-gameplay proposals cannot smuggle a gameplay hypothesis", () => {
  assert.match(validatePlannerProposal(validCreateIssue({ gameplayHypothesis: hypothesis() })).error, /must be null/);
});

test("rejects empty or malformed create_issue fields", () => {
  assert.equal(validatePlannerProposal(validCreateIssue({ title: "   " })).ok, false);
  assert.equal(validatePlannerProposal(validCreateIssue({ acceptanceCriteria: [] })).ok, false);
  assert.equal(validatePlannerProposal(validCreateIssue({ nonGoals: "none" })).ok, false);
  assert.equal(validatePlannerProposal(validCreateIssue({ risk: "critical" })).ok, false);
  assert.equal(validatePlannerProposal(validCreateIssue({ humanGate: "false" })).ok, false);
});

test("no_action accepts only a non-empty reason", () => {
  assert.equal(validatePlannerProposal({ action: "no_action", reason: " " }).ok, false);
  assert.equal(validatePlannerProposal({ action: "no_action", reason: "Nothing safe to do", title: "extra" }).ok, false);
});

test("JSON parsing fails closed", () => {
  assert.deepEqual(parsePlannerProposal("not json"), { ok: false, error: "proposal must be valid JSON" });
  assert.equal(parsePlannerProposal(JSON.stringify(validCreateIssue())).ok, true);
  assert.equal(parsePlannerProposal("[]").ok, false);
});
