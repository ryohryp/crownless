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

test("executor workflow uses GitHub-hosted Runner, installs Codex, and preserves manual dispatch", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "autopilot-executor.yml"), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.doesNotMatch(workflow, /self-hosted/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /npm install -g @openai\/codex@latest/);
  assert.match(workflow, /CODEX_AUTH_JSON/);
  assert.match(workflow, /OPENAI_API_KEY/);
  assert.match(workflow, /contains\(github\.event\.issue\.labels\.\*\.name, 'agent-ready'\)/);
  assert.match(workflow, /focused_test="test\/autopilot-issue-\$\{ISSUE_NUMBER\}\.test\.js"/);
  assert.match(workflow, /--focused-test "\$focused_test"/);
  assert.match(workflow, /concurrency:/);
});

test("planner workflow runs hourly on GitHub-hosted Runner and explicitly dispatches Executor", () => {
  const workflow = fs.readFileSync(path.join(__dirname, "..", ".github", "workflows", "autopilot-planner.yml"), "utf8");
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /npm install -g @openai\/codex@latest/);
  assert.match(workflow, /planner-cycle\.js --repo "\$GITHUB_REPOSITORY" --defer-execution/);
  assert.match(workflow, /gh workflow run autopilot-executor\.yml/);
  assert.match(workflow, /-f issue_number="\$ISSUE_NUMBER"/);
  assert.match(workflow, /group: crownless-autopilot-planner/);
});
