const assert = require("node:assert/strict");
const test = require("node:test");
const { assessPlannerProposal } = require("../scripts/autopilot/risk-policy.js");

function score(value = 2, applicable = true) { return { applicable, score: value, rationale: "test rationale" }; }
function gate() { return { playerVisible: score(), decision: score(), riskReward: score(0, false), coreLoop: score(), replayability: score(), fantasy: score(), geography: score(0, false), canon: score(3) }; }
function candidates(title, kind) { return [
  { title, kind, locationRelated: false, gameplayGate: gate(), reason: "selected", selected: true },
  { title: "A", kind: "gameplay", locationRelated: false, gameplayGate: gate(), reason: "not now", selected: false },
  { title: "B", kind: "gameplay", locationRelated: false, gameplayGate: gate(), reason: "not now", selected: false },
]; }
function hypothesis() { return { interestingDecision: "Press on or return?", mda: { mechanic: "Choose", dynamic: "Trade risk", desiredExperience: "Tension" }, verticalSlice: { discoveryOrInformation: "Info", decision: "Choose", action: "Act", resultOrDanger: "Danger", rewardOrLoss: "Reward", persistentChange: "Next choice" } }; }
function proposal(overrides = {}) {
  const title = overrides.title || "Reduce report navigation friction";
  const proposalType = overrides.proposalType || "friction";
  return {
    action: "create_issue", title, whyNow: "The current report has one avoidable extra tap", scope: "Reuse the existing companion link in the report summary",
    acceptanceCriteria: ["The existing companion detail opens from the report"], nonGoals: ["No new companion mechanics"], risk: "low", humanGate: false,
    playtestRequired: proposalType === "gameplay", proposalType,
    recentCycleReview: { cyclesReviewed: 5, newPlayAdded: false, maintenanceHeavy: false, summary: "Recent cycles reviewed" },
    candidates: candidates(title, proposalType), gameplayHypothesis: proposalType === "gameplay" ? hypothesis() : null, ...overrides,
  };
}

test("allows only an explicitly low-risk policy-safe proposal", () => {
  assert.deepEqual(assessPlannerProposal(proposal()), { eligible: true, decision: "agent-ready", reasons: [] });
});

test("honors planner human gate and risk flags", () => {
  assert.deepEqual(assessPlannerProposal(proposal({ humanGate: true })).reasons, ["planner_human_gate"]);
  assert.deepEqual(assessPlannerProposal(proposal({ risk: "medium" })).reasons, ["risk_medium"]);
  assert.deepEqual(assessPlannerProposal(proposal({ risk: "high" })).reasons, ["risk_high"]);
});

test("playtestRequired is a post-implementation status, not a pre-implementation blocker", () => {
  assert.deepEqual(assessPlannerProposal(proposal({ proposalType: "gameplay" })), { eligible: true, decision: "agent-ready", reasons: [] });
});

test("fails closed when policy-gated topics appear despite low-risk self-report", () => {
  const cases = [
    ["Store raw GPS route history for better discoveries", "policy_gps_privacy"], ["Add a save migration for the new companion format", "policy_save_migration"],
    ["Approve a new production visual asset", "policy_production_visual"], ["Change production deployment hosting", "policy_hosting_deployment"],
    ["Rotate an API key credential", "policy_credential_security"], ["Perform a major architecture backend migration", "policy_major_architecture"],
    ["Rebalance the expedition economy", "policy_balance_economy"], ["Add subscription monetization", "policy_monetization"],
  ];
  for (const [scope, reason] of cases) { const result = assessPlannerProposal(proposal({ scope })); assert.equal(result.eligible, false, scope); assert.ok(result.reasons.includes(reason), `${scope}: expected ${reason}`); }
});

test("non-goals may explicitly exclude policy-gated work without creating a false gate", () => {
  assert.deepEqual(assessPlannerProposal(proposal({ nonGoals: ["No save migration", "No raw GPS storage", "No production deployment changes"] })), { eligible: true, decision: "agent-ready", reasons: [] });
});

test("malformed proposals fail closed through the existing proposal validator", () => {
  const result = assessPlannerProposal(proposal({ acceptanceCriteria: [] })); assert.equal(result.eligible, false); assert.deepEqual(result.reasons, ["invalid_proposal"]); assert.match(result.error, /acceptanceCriteria/);
});

test("no_action remains a non-mutation decision", () => {
  assert.deepEqual(assessPlannerProposal({ action: "no_action", reason: "An overlapping PR already exists" }), { eligible: false, decision: "no_action", reasons: [] });
});
