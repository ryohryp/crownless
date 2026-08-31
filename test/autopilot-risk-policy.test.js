const assert = require("node:assert/strict");
const test = require("node:test");

const { assessPlannerProposal } = require("../scripts/autopilot/risk-policy.js");

function proposal(overrides = {}) {
  return {
    action: "create_issue",
    title: "Reduce report navigation friction",
    whyNow: "The current report has one avoidable extra tap",
    scope: "Reuse the existing companion link in the report summary",
    acceptanceCriteria: ["The existing companion detail opens from the report"],
    nonGoals: ["No new companion mechanics"],
    risk: "low",
    humanGate: false,
    playtestRequired: false,
    ...overrides,
  };
}

test("allows only an explicitly low-risk policy-safe proposal", () => {
  assert.deepEqual(assessPlannerProposal(proposal()), {
    eligible: true,
    decision: "agent-ready",
    reasons: [],
  });
});

test("honors planner human gate, risk, and playtest flags", () => {
  assert.deepEqual(assessPlannerProposal(proposal({ humanGate: true })).reasons, ["planner_human_gate"]);
  assert.deepEqual(assessPlannerProposal(proposal({ risk: "medium" })).reasons, ["risk_medium"]);
  assert.deepEqual(assessPlannerProposal(proposal({ risk: "high" })).reasons, ["risk_high"]);
  assert.deepEqual(assessPlannerProposal(proposal({ playtestRequired: true })).reasons, ["playtest_required"]);
});

test("fails closed when policy-gated topics appear despite low-risk self-report", () => {
  const cases = [
    ["Store raw GPS route history for better discoveries", "policy_gps_privacy"],
    ["Add a save migration for the new companion format", "policy_save_migration"],
    ["Approve a new production visual asset", "policy_production_visual"],
    ["Change production deployment hosting", "policy_hosting_deployment"],
    ["Rotate an API key credential", "policy_credential_security"],
    ["Perform a major architecture backend migration", "policy_major_architecture"],
    ["Rebalance the expedition economy", "policy_balance_economy"],
    ["Add subscription monetization", "policy_monetization"],
  ];

  for (const [scope, reason] of cases) {
    const result = assessPlannerProposal(proposal({ scope }));
    assert.equal(result.eligible, false, scope);
    assert.equal(result.decision, "agent-proposed", scope);
    assert.ok(result.reasons.includes(reason), `${scope}: expected ${reason}`);
  }
});

test("non-goals may explicitly exclude policy-gated work without creating a false gate", () => {
  const result = assessPlannerProposal(
    proposal({ nonGoals: ["No save migration", "No raw GPS storage", "No production deployment changes"] }),
  );
  assert.deepEqual(result, {
    eligible: true,
    decision: "agent-ready",
    reasons: [],
  });
});

test("malformed proposals fail closed through the existing proposal validator", () => {
  const result = assessPlannerProposal(proposal({ acceptanceCriteria: [] }));
  assert.equal(result.eligible, false);
  assert.equal(result.decision, "agent-proposed");
  assert.deepEqual(result.reasons, ["invalid_proposal"]);
  assert.match(result.error, /acceptanceCriteria/);
});

test("no_action remains a non-mutation decision", () => {
  assert.deepEqual(assessPlannerProposal({ action: "no_action", reason: "An overlapping PR already exists" }), {
    eligible: false,
    decision: "no_action",
    reasons: [],
  });
});
