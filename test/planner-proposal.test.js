const assert = require("node:assert/strict");
const test = require("node:test");

const { parsePlannerProposal, validatePlannerProposal } = require("../scripts/autopilot/planner-proposal.js");

function validCreateIssue(overrides = {}) {
  return {
    action: "create_issue",
    title: "Connect report to companion recovery",
    whyNow: "Report to Adapt currently has avoidable friction",
    scope: "Add one existing navigation affordance",
    acceptanceCriteria: ["The affected companion can be opened from the report"],
    nonGoals: ["No companion model changes"],
    risk: "low",
    humanGate: false,
    playtestRequired: true,
    ...overrides,
  };
}

test("accepts valid create_issue and no_action proposals", () => {
  assert.equal(validatePlannerProposal(validCreateIssue()).ok, true);
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

test("rejects empty or malformed create_issue fields", () => {
  assert.equal(validatePlannerProposal(validCreateIssue({ title: "   " })).ok, false);
  assert.equal(validatePlannerProposal(validCreateIssue({ acceptanceCriteria: [] })).ok, false);
  assert.equal(validatePlannerProposal(validCreateIssue({ acceptanceCriteria: [""] })).ok, false);
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
