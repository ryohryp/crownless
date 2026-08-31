const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluatePlannerProposal } = require("../scripts/autopilot/planner-evaluation.js");

function proposal(overrides = {}) {
  return {
    action: "create_issue",
    title: "帰還報告から仲間の状態を確認しやすくする",
    whyNow: "Report から Adapt への導線を短くするため",
    scope: "既存の帰還報告に小さな状態表示を追加する",
    acceptanceCriteria: ["帰還報告から状態が読める"],
    nonGoals: ["save schemaは変更しない"],
    risk: "low",
    humanGate: false,
    playtestRequired: false,
    ...overrides,
  };
}

function snapshot(items = []) {
  return {
    items,
    counts: {
      openIssues: items.length,
      openPullRequests: 0,
      recentClosedIssues: 0,
      recentMergedPullRequests: 0,
    },
  };
}

test("malformed proposal fails closed before collection", () => {
  let collected = false;
  const result = evaluatePlannerProposal(
    { action: "create_issue", title: "broken" },
    {
      repo: "ryohryp/crownless",
      collect: () => {
        collected = true;
        return snapshot();
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.decision, "stop");
  assert.equal(result.reason, "invalid_proposal");
  assert.equal(collected, false);
});

test("no_action returns without collecting work items", () => {
  let collected = false;
  const result = evaluatePlannerProposal(
    { action: "no_action", reason: "active work already covers the next step" },
    {
      collect: () => {
        collected = true;
        return snapshot();
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.decision, "no_action");
  assert.equal(collected, false);
});

test("create_issue passes the collected snapshot to duplicate detection", () => {
  const items = [
    {
      id: 99,
      number: 99,
      type: "issue",
      state: "open",
      title: "another task",
      body: "",
      url: "https://example.invalid/99",
    },
  ];
  let receivedItems;

  const result = evaluatePlannerProposal(proposal(), {
    repo: "ryohryp/crownless",
    collect: () => snapshot(items),
    detectDuplicate: (_proposal, workItems) => {
      receivedItems = workItems;
      return { ok: true, duplicate: false, decision: "continue", reason: null, match: null };
    },
    assessRisk: () => ({ eligible: true, decision: "agent-ready", reasons: [] }),
  });

  assert.equal(result.decision, "agent-ready");
  assert.equal(receivedItems, items);
  assert.deepEqual(result.snapshotCounts, snapshot(items).counts);
});

test("duplicate stops before risk assessment", () => {
  let assessed = false;
  const result = evaluatePlannerProposal(proposal(), {
    repo: "ryohryp/crownless",
    collect: () => snapshot(),
    detectDuplicate: () => ({
      ok: true,
      duplicate: true,
      decision: "stop",
      reason: "exact_title",
      match: { id: 10, title: "same task" },
    }),
    assessRisk: () => {
      assessed = true;
      return { eligible: true, decision: "agent-ready", reasons: [] };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision, "stop");
  assert.equal(result.reason, "exact_title");
  assert.equal(assessed, false);
});

test("low-risk non-duplicate proposal becomes agent-ready", () => {
  const result = evaluatePlannerProposal(proposal(), {
    repo: "ryohryp/crownless",
    collect: () => snapshot(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision, "agent-ready");
  assert.equal(result.risk.eligible, true);
});

test("human-gated proposal becomes agent-proposed", () => {
  const result = evaluatePlannerProposal(proposal({ humanGate: true }), {
    repo: "ryohryp/crownless",
    collect: () => snapshot(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.decision, "agent-proposed");
  assert.ok(result.risk.reasons.includes("planner_human_gate"));
});

test("collector failure fails closed", () => {
  const result = evaluatePlannerProposal(proposal(), {
    repo: "ryohryp/crownless",
    collect: () => {
      throw new Error("gh unavailable");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.decision, "stop");
  assert.equal(result.reason, "work_item_collection_failed");
  assert.match(result.error, /gh unavailable/);
});

test("invalid collector shape fails closed", () => {
  const result = evaluatePlannerProposal(proposal(), {
    repo: "ryohryp/crownless",
    collect: () => ({ counts: {} }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.decision, "stop");
  assert.equal(result.reason, "invalid_work_item_snapshot");
});
