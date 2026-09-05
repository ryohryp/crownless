const test = require("node:test");
const assert = require("node:assert/strict");
const { runPlannerCycle } = require("../scripts/autopilot/planner-cycle.js");

test("fresh duplicate guard exception fails closed before mutation", () => {
  let created = false;
  let executed = false;
  const result = runPlannerCycle({ repo: "ryohryp/crownless" }, {
    invoke: () => ({
      ok: true,
      decision: "agent-ready",
      proposal: { action: "create_issue" },
    }),
    collect: () => ({ items: [] }),
    detectDuplicate: () => { throw new Error("duplicate guard unavailable"); },
    createIssue: () => { created = true; },
    execute: () => { executed = true; },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "duplicate_detection_failed");
  assert.match(result.error, /duplicate guard unavailable/);
  assert.equal(created, false);
  assert.equal(executed, false);
});
