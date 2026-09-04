const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluatePlannerProposal } = require("../scripts/autopilot/planner-evaluation.js");

function score(value = 2, applicable = true) { return { applicable, score: value, rationale: "test rationale" }; }
function gate(overrides = {}) {
  return { playerVisible: score(), decision: score(), riskReward: score(0, false), coreLoop: score(), replayability: score(), fantasy: score(), geography: score(0, false), canon: score(3), ...overrides };
}
function candidates(title, kind = "friction") {
  return [
    { title, kind, locationRelated: false, gameplayGate: gate(), reason: "best next step", selected: true },
    { title: "Alternative A", kind: "gameplay", locationRelated: false, gameplayGate: gate(), reason: "less valuable", selected: false },
    { title: "Alternative B", kind: "gameplay", locationRelated: false, gameplayGate: gate(), reason: "larger scope", selected: false },
  ];
}
function hypothesis() {
  return {
    interestingDecision: "Press on or return?",
    mda: { mechanic: "Choose route", dynamic: "Risk competes with reward", desiredExperience: "Tense commitment" },
    verticalSlice: {
      discoveryOrInformation: "Reveal route", decision: "Choose", action: "Commit", resultOrDanger: "Risk injury",
      rewardOrLoss: "Gain salvage", persistentChange: "Change preparation",
    },
  };
}
function proposal(overrides = {}) {
  const title = overrides.title || "帰還報告から仲間の状態を確認しやすくする";
  const proposalType = overrides.proposalType || "friction";
  return {
    action: "create_issue",
    title,
    whyNow: "Report から Adapt への導線を短くするため",
    scope: "既存の帰還報告に小さな状態表示を追加する",
    acceptanceCriteria: ["帰還報告から状態が読める"],
    nonGoals: ["save schemaは変更しない"],
    risk: "low",
    humanGate: false,
    playtestRequired: proposalType === "gameplay",
    proposalType,
    recentCycleReview: { cyclesReviewed: 5, newPlayAdded: false, maintenanceHeavy: false, summary: "直近は導線改善が中心" },
    candidates: candidates(title, proposalType),
    gameplayHypothesis: proposalType === "gameplay" ? hypothesis() : null,
    ...overrides,
  };
}
function snapshot(items = []) {
  return { items, counts: { openIssues: items.length, openPullRequests: 0, recentClosedIssues: 0, recentMergedPullRequests: 0 } };
}

test("malformed proposal fails closed before collection", () => {
  let collected = false;
  const result = evaluatePlannerProposal({ action: "create_issue", title: "broken" }, { repo: "ryohryp/crownless", collect: () => { collected = true; return snapshot(); } });
  assert.equal(result.ok, false); assert.equal(result.reason, "invalid_proposal"); assert.equal(collected, false);
});

test("no_action returns without collecting work items", () => {
  let collected = false;
  const result = evaluatePlannerProposal({ action: "no_action", reason: "active work already covers the next step" }, { collect: () => { collected = true; return snapshot(); } });
  assert.equal(result.ok, true); assert.equal(result.decision, "no_action"); assert.equal(collected, false); assert.equal(result.gameplay, null);
});

test("gameplay gate stops a Decision=0 proposal before duplicate collection", () => {
  let collected = false;
  const value = proposal({ proposalType: "gameplay" });
  value.candidates[0].gameplayGate.decision = score(0);
  const result = evaluatePlannerProposal(value, { repo: "ryohryp/crownless", collect: () => { collected = true; return snapshot(); } });
  assert.equal(result.ok, true); assert.equal(result.decision, "stop"); assert.equal(result.reason, "gameplay_gate");
  assert.ok(result.gameplay.reasons.includes("decision_zero")); assert.equal(collected, false);
});

test("create_issue passes collected snapshot to duplicate detection", () => {
  const items = [{ id: 99, number: 99, type: "issue", state: "open", title: "another task", body: "", url: "https://example.invalid/99" }];
  let receivedItems;
  const result = evaluatePlannerProposal(proposal(), {
    repo: "ryohryp/crownless",
    collect: () => snapshot(items),
    detectDuplicate: (_proposal, workItems) => { receivedItems = workItems; return { ok: true, duplicate: false, decision: "continue", reason: null, match: null }; },
    assessRisk: () => ({ eligible: true, decision: "agent-ready", reasons: [] }),
  });
  assert.equal(result.decision, "agent-ready"); assert.equal(receivedItems, items); assert.deepEqual(result.snapshotCounts, snapshot(items).counts); assert.equal(result.gameplay.decision, "continue");
});

test("duplicate stops before risk assessment", () => {
  let assessed = false;
  const result = evaluatePlannerProposal(proposal(), {
    repo: "ryohryp/crownless", collect: () => snapshot(),
    detectDuplicate: () => ({ ok: true, duplicate: true, decision: "stop", reason: "exact_title", match: { id: 10, title: "same task" } }),
    assessRisk: () => { assessed = true; return { eligible: true, decision: "agent-ready", reasons: [] }; },
  });
  assert.equal(result.decision, "stop"); assert.equal(result.reason, "exact_title"); assert.equal(assessed, false);
});

test("low-risk non-duplicate proposal becomes agent-ready", () => {
  const result = evaluatePlannerProposal(proposal(), { repo: "ryohryp/crownless", collect: () => snapshot() });
  assert.equal(result.ok, true); assert.equal(result.decision, "agent-ready"); assert.equal(result.risk.eligible, true);
});

test("playtest-required gameplay can still become agent-ready", () => {
  const result = evaluatePlannerProposal(proposal({ proposalType: "gameplay" }), { repo: "ryohryp/crownless", collect: () => snapshot() });
  assert.equal(result.decision, "agent-ready"); assert.equal(result.gameplay.decision, "continue");
});

test("human-gated proposal becomes agent-proposed", () => {
  const result = evaluatePlannerProposal(proposal({ humanGate: true }), { repo: "ryohryp/crownless", collect: () => snapshot() });
  assert.equal(result.decision, "agent-proposed"); assert.ok(result.risk.reasons.includes("planner_human_gate"));
});

test("collector failure and invalid collector shape fail closed", () => {
  const failed = evaluatePlannerProposal(proposal(), { repo: "ryohryp/crownless", collect: () => { throw new Error("gh unavailable"); } });
  assert.equal(failed.reason, "work_item_collection_failed"); assert.match(failed.error, /gh unavailable/);
  const malformed = evaluatePlannerProposal(proposal(), { repo: "ryohryp/crownless", collect: () => ({ counts: {} }) });
  assert.equal(malformed.reason, "invalid_work_item_snapshot");
});
