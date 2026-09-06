const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parseArgs, runPlannerCycle } = require("../scripts/autopilot/planner-cycle.js");

function proposal() {
  const score = { applicable: true, score: 2, rationale: "test" };
  return {
    action: "create_issue",
    title: "外部Runnerへ実行を委譲する",
    whyNow: "PlannerとExecutorを分離するため",
    scope: "agent-ready Issueを作成して実行を遅延する",
    acceptanceCriteria: ["executorは別Runnerで起動する"],
    nonGoals: [],
    risk: "low",
    humanGate: false,
    playtestRequired: false,
    proposalType: "friction",
    recentCycleReview: {
      cyclesReviewed: 3,
      newPlayAdded: true,
      maintenanceHeavy: false,
      summary: "直近サイクル確認済み",
    },
    recentPlaytestLearning: { entries: [], summary: "なし" },
    learningApplication: { appliedSources: [], ignoredSources: [], summary: "なし" },
    candidates: [{
      title: "外部Runnerへ実行を委譲する",
      kind: "friction",
      locationRelated: false,
      gameplayGate: {
        playerVisible: score,
        decision: score,
        riskReward: { applicable: false, score: 0, rationale: "n/a" },
        coreLoop: score,
        replayability: score,
        fantasy: score,
        geography: { applicable: false, score: 0, rationale: "n/a" },
        canon: score,
      },
      reason: "smallest infrastructure slice",
      selected: true,
      learningSources: [],
      revisitsKilledHypothesis: false,
      killRevisitEvidence: null,
    }],
    gameplayHypothesis: null,
  };
}

test("deferExecution creates agent-ready Issue without invoking local executor", () => {
  let executed = 0;
  const result = runPlannerCycle(
    { repo: "ryohryp/crownless", cwd: "/repo", deferExecution: true },
    {
      invoke: () => ({ ok: true, decision: "agent-ready", proposal: proposal() }),
      collect: () => ({ items: [] }),
      detectDuplicate: () => ({ ok: true, decision: "continue", reason: null }),
      createIssue: () => ({ number: 498, url: "https://github.com/ryohryp/crownless/issues/498" }),
      execute: () => { executed += 1; },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.decision, "agent-ready");
  assert.equal(result.issue.number, 498);
  assert.deepEqual(result.executor, { deferred: true });
  assert.equal(executed, 0);
});

test("planner CLI accepts --defer-execution while preserving default false", () => {
  assert.deepEqual(parseArgs(["--repo", "ryohryp/crownless"]), {
    repo: "ryohryp/crownless",
    deferExecution: false,
  });
  assert.deepEqual(parseArgs(["--defer-execution", "--repo", "ryohryp/crownless"]), {
    repo: "ryohryp/crownless",
    deferExecution: true,
  });
});

test("external executor workflow is self-hosted, gated by agent-ready, and supports manual dispatch", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "autopilot-executor.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on: \[self-hosted, crownless-autopilot\]/);
  assert.match(workflow, /contains\(github\.event\.issue\.labels\.\*\.name, 'agent-ready'\)/);
  assert.match(workflow, /node scripts\/autopilot\/run-next\.js --issue "\$ISSUE_NUMBER"/);
  assert.match(workflow, /concurrency:/);
});
