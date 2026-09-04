const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assertEligibleIssue,
  blockedLifecycleLabel,
  isEligibleIssue,
  selectIssue,
} = require("../scripts/autopilot/select-issue.js");

function issue(number, labels, state = "OPEN") {
  return { number, state, labels: labels.map((name) => ({ name })) };
}

test("lifecycle hold labels override agent-ready eligibility", () => {
  for (const label of ["playtest-pending", "future", "decision-log"]) {
    const candidate = issue(100, ["agent-ready", label]);
    assert.equal(blockedLifecycleLabel(candidate), label);
    assert.equal(isEligibleIssue(candidate), false);
    assert.throws(() => assertEligibleIssue(candidate), new RegExp(label));
  }
});

test("ordinary agent-ready issue remains executable", () => {
  const candidate = issue(101, ["agent-ready"]);
  assert.equal(blockedLifecycleLabel(candidate), null);
  assert.equal(isEligibleIssue(candidate), true);
  assert.doesNotThrow(() => assertEligibleIssue(candidate));
});

test("selection skips lifecycle-held issues even when they are older", () => {
  const selected = selectIssue([
    issue(90, ["agent-ready", "future"]),
    issue(91, ["agent-ready", "playtest-pending"]),
    issue(92, ["agent-ready", "decision-log"]),
    issue(110, ["agent-ready"]),
  ]);
  assert.equal(selected.number, 110);
});
