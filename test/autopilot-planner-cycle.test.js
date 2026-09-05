const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildIssueBody,
  hasActiveExecution,
  hasPendingAutopilotPullRequest,
  runPlannerCycle,
} = require("../scripts/autopilot/planner-cycle.js");

function score(value = 2, applicable = true) {
  return { applicable, score: value, rationale: "test rationale" };
}

function gate() {
  return {
    playerVisible: score(),
    decision: score(),
    riskReward: score(0, false),
    coreLoop: score(),
    replayability: score(),
    fantasy: score(),
    geography: score(0, false),
    canon: score(3),
  };
}

function proposal({ gameplay = false } = {}) {
  return {
    action: "create_issue",
    title: gameplay ? "負傷時に帰還か続行か選べるようにする" : "帰還報告の状態表示を改善する",
    whyNow: "Report から Adapt への導線を改善するため",
    scope: "既存の遠征ループに最小変更を加える",
    acceptanceCriteria: ["プレイヤーが結果を確認できる"],
    nonGoals: ["save migrationは行わない"],
    risk: "low",
    humanGate: false,
    playtestRequired: gameplay,
    proposalType: gameplay ? "gameplay" : "friction",
    recentCycleReview: {
      cyclesReviewed: 5,
      newPlayAdded: false,
      maintenanceHeavy: false,
      summary: "直近5サイクルを確認した",
    },
    recentPlaytestLearning: { entries: [], summary: "確認済みlearningなし" },
    learningApplication: { appliedSources: [], ignoredSources: [], summary: "適用対象なし" },
    candidates: [{
      title: gameplay ? "負傷時に帰還か続行か選べるようにする" : "帰還報告の状態表示を改善する",
      kind: gameplay ? "gameplay" : "friction",
      locationRelated: false,
      gameplayGate: gate(),
      reason: "smallest useful slice",
      selected: true,
      learningSources: [],
      revisitsKilledHypothesis: false,
      killRevisitEvidence: null,
    }],
    gameplayHypothesis: gameplay ? {
      interestingDecision: "負傷した仲間で進むか、戦利品を守って帰るか迷う",
      mda: {
        mechanic: "負傷時に帰還/続行を選べる",
        dynamic: "現在の戦利品と次の機会を比較する",
        desiredExperience: "生還を重視する遠征判断",
      },
      verticalSlice: {
        discoveryOrInformation: "負傷と残り行程を知る",
        decision: "帰還か続行を選ぶ",
        action: "方針を確定する",
        resultOrDanger: "続行時は追加危険が発生する",
        rewardOrLoss: "追加戦利品または損失が発生する",
        persistentChange: "帰還結果が次の遠征準備に残る",
      },
    } : null,
  };
}

function depsFor(decision, overrides = {}) {
  const proposed = proposal({ gameplay: decision === "agent-ready" });
  return {
    invoke: () => ({ ok: true, decision, proposal: proposed }),
    collect: () => ({ items: [] }),
    detectDuplicate: () => ({ ok: true, decision: "continue", reason: null }),
    createIssue: ({ label, body }) => ({ number: 900, url: "https://github.com/ryohryp/crownless/issues/900", label, body }),
    execute: ({ issueNumber }) => ({ status: 0, issueNumber }),
    ...overrides,
  };
}

test("no_action and stop never mutate GitHub or start executor", () => {
  for (const planner of [
    { ok: true, decision: "no_action", reason: "covered" },
    { ok: false, decision: "stop", reason: "invalid_proposal" },
  ]) {
    let mutations = 0;
    const result = runPlannerCycle({ repo: "ryohryp/crownless", cwd: "/repo" }, {
      invoke: () => planner,
      collect: () => { mutations += 1; return { items: [] }; },
      createIssue: () => { mutations += 1; },
      execute: () => { mutations += 1; },
    });
    assert.equal(result.decision, planner.decision);
    assert.equal(mutations, 0);
  }
});

test("agent-proposed creates exactly one labeled Issue and stops before executor", () => {
  let created = 0;
  let executed = 0;
  let observedLabel;
  const result = runPlannerCycle({ repo: "ryohryp/crownless", cwd: "/repo" }, depsFor("agent-proposed", {
    createIssue: ({ label }) => { created += 1; observedLabel = label; return { number: 901, url: "issue" }; },
    execute: () => { executed += 1; },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.decision, "agent-proposed");
  assert.equal(created, 1);
  assert.equal(observedLabel, "agent-proposed");
  assert.equal(executed, 0);
});

test("agent-ready creates exactly one labeled Issue and passes only that Issue to executor", () => {
  let created = 0;
  let executed = 0;
  let observed;
  const result = runPlannerCycle({ repo: "ryohryp/crownless", cwd: "/repo" }, depsFor("agent-ready", {
    createIssue: ({ label }) => { created += 1; assert.equal(label, "agent-ready"); return { number: 902, url: "issue" }; },
    execute: (input) => { executed += 1; observed = input; return { status: 0 }; },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.decision, "agent-ready");
  assert.equal(created, 1);
  assert.equal(executed, 1);
  assert.equal(observed.issueNumber, 902);
});

test("fresh duplicate, active execution, and pending Autopilot PR block mutation", () => {
  const cases = [
    {
      expected: "duplicate_or_overlapping_work",
      overrides: { detectDuplicate: () => ({ ok: true, decision: "stop", reason: "duplicate" }) },
    },
    {
      expected: "active_execution",
      overrides: { collect: () => ({ items: [{ type: "issue", state: "open", labels: ["agent-running"] }] }) },
    },
    {
      expected: "pending_autopilot_pr",
      overrides: { collect: () => ({ items: [{ type: "pull_request", state: "open", title: "Autopilot generated change", body: "" }] }) },
    },
  ];

  for (const entry of cases) {
    let created = 0;
    const result = runPlannerCycle({ repo: "ryohryp/crownless" }, depsFor("agent-ready", {
      ...entry.overrides,
      createIssue: () => { created += 1; },
    }));
    assert.equal(result.reason, entry.expected);
    assert.equal(created, 0);
  }
});

test("mutation failure fails closed and does not start executor", () => {
  let executed = 0;
  const result = runPlannerCycle({ repo: "ryohryp/crownless" }, depsFor("agent-ready", {
    createIssue: () => { throw new Error("GitHub unavailable"); },
    execute: () => { executed += 1; },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "issue_mutation_failed");
  assert.equal(executed, 0);
});

test("executor failure keeps the generated Issue visible and stops", () => {
  const result = runPlannerCycle({ repo: "ryohryp/crownless" }, depsFor("agent-ready", {
    createIssue: () => ({ number: 903, url: "issue" }),
    execute: () => { throw new Error("executor failed"); },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, "executor_failed");
  assert.equal(result.issue.number, 903);
});

test("generated Issue body contains Phase 2 required fields and gameplay hypothesis evidence", () => {
  const body = buildIssueBody(proposal({ gameplay: true }));
  assert.match(body, /背景 \/ なぜ今か/);
  assert.match(body, /MVP \/ 最小scope/);
  assert.match(body, /Acceptance Criteria/);
  assert.match(body, /Non-goals/);
  assert.match(body, /Risk: low/);
  assert.match(body, /Human gate: false/);
  assert.match(body, /Playtest required: true/);
  assert.match(body, /Gameplay Gate/);
  assert.match(body, /Interesting Decision/);
  assert.match(body, /Mechanic:/);
  assert.match(body, /Smallest vertical slice/);
  assert.match(body, /Related: #228/);
});

test("active and pending-work helpers use only current open lifecycle state", () => {
  assert.equal(hasActiveExecution({ items: [{ type: "issue", state: "open", labels: [{ name: "agent-running" }] }] }), true);
  assert.equal(hasActiveExecution({ items: [{ type: "issue", state: "closed", labels: ["agent-running"] }] }), false);
  assert.equal(hasPendingAutopilotPullRequest({ items: [{ type: "pull_request", state: "open", title: "feat", body: "Generated by Autopilot" }] }), true);
  assert.equal(hasPendingAutopilotPullRequest({ items: [{ type: "pull_request", state: "merged", title: "Autopilot", body: "" }] }), false);
});
