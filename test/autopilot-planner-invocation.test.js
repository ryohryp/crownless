const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPlannerPrompt, invokePlanner } = require("../scripts/autopilot/planner-invocation.js");
const plannerSchema = require("../scripts/autopilot/planner-proposal.schema.json");

function score(value = 2, applicable = true) { return { applicable, score: value, rationale: "test rationale" }; }
function gate() { return { playerVisible: score(), decision: score(), riskReward: score(0, false), coreLoop: score(), replayability: score(), fantasy: score(), geography: score(0, false), canon: score(3) }; }
function candidate(title, kind, reason, selected) {
  return {
    title,
    kind,
    locationRelated: false,
    gameplayGate: gate(),
    reason,
    selected,
    learningSources: [],
    revisitsKilledHypothesis: false,
    killRevisitEvidence: null,
  };
}
const validProposal = {
  action: "create_issue", title: "帰還報告の状態表示を改善する", whyNow: "Report から Adapt への導線を改善するため", scope: "既存報告に状態表示を追加する",
  acceptanceCriteria: ["帰還状態が読める"], nonGoals: ["save schemaは変更しない"], risk: "low", humanGate: false, playtestRequired: false,
  proposalType: "friction", recentCycleReview: { cyclesReviewed: 5, newPlayAdded: false, maintenanceHeavy: false, summary: "直近5サイクルを確認" },
  recentPlaytestLearning: { entries: [], summary: "人間確認済みのKeep/Change/Killは見つからなかった" },
  learningApplication: { appliedSources: [], ignoredSources: [], summary: "今回反映すべきplaytest learningなし" },
  candidates: [
    candidate("帰還報告の状態表示を改善する", "friction", "clear friction", true),
    candidate("新しい遠征判断A", "gameplay", "larger scope", false),
    candidate("新しい遠征判断B", "gameplay", "lower value", false),
  ], gameplayHypothesis: null,
};

test("prompt requires Canon-first read-only planning, Gameplay Gate evidence, and playtest learning", () => {
  const prompt = buildPlannerPrompt();
  assert.match(prompt, /AGENTS\.md/); assert.match(prompt, /docs\/game-system-design\.md/); assert.match(prompt, /docs\/autonomous-development-policy\.md/);
  assert.match(prompt, /Repository Canon overrides/); assert.match(prompt, /Do not modify files/); assert.match(prompt, /at most one/);
  assert.match(prompt, /most recent 3-5 development cycles/); assert.match(prompt, /exactly three candidates/); assert.match(prompt, /Gameplay Gate/);
  assert.match(prompt, /Decision=0 or Core Loop=0/); assert.match(prompt, /Interesting Decision/); assert.match(prompt, /Mechanic, Dynamic, Desired Experience/);
  assert.match(prompt, /Playtest pending/); assert.match(prompt, /Keep, Change, or Kill/);
  assert.match(prompt, /decision log #367/); assert.match(prompt, /recentPlaytestLearning/); assert.match(prompt, /learningApplication/);
  assert.match(prompt, /Every Change learning must be applied/); assert.match(prompt, /revisitsKilledHypothesis=true/); assert.match(prompt, /killRevisitEvidence/);
  assert.match(prompt, /Never infer Keep, Change, or Kill from tests, CI/);
  assert.match(prompt, /future = intentionally deferred/); assert.match(prompt, /decision-log = ongoing record/); assert.match(prompt, /playtest-pending = implementation already exists/);
  assert.match(prompt, /Do not equate open with unimplemented/); assert.match(prompt, /remaining Acceptance Criteria/);
});

test("planner output schema requires structured playtest learning and candidate learning evidence", () => {
  const createIssueSchema = plannerSchema.oneOf[0];
  assert.ok(createIssueSchema.required.includes("recentPlaytestLearning"));
  assert.ok(createIssueSchema.required.includes("learningApplication"));
  assert.deepEqual(plannerSchema.$defs.playtestLearningEntry.properties.status.enum, ["Keep", "Change", "Kill"]);
  assert.ok(plannerSchema.$defs.candidate.required.includes("learningSources"));
  assert.ok(plannerSchema.$defs.candidate.required.includes("revisitsKilledHypothesis"));
  assert.ok(plannerSchema.$defs.candidate.required.includes("killRevisitEvidence"));
});

test("invocation pins Codex to read-only ephemeral no-approval mode and schema", () => {
  let observed;
  const result = invokePlanner({ repo: "ryohryp/crownless", cwd: "/repo", codexBin: "codex-test" }, {
    run: (command, args, options) => { observed = { command, args, options }; return { status: 0, stdout: JSON.stringify(validProposal), stderr: "" }; },
    evaluate: () => ({ ok: true, decision: "agent-ready", risk: { eligible: true } }),
  });
  assert.equal(result.ok, true); assert.equal(observed.command, "codex-test");
  assert.deepEqual(observed.args.slice(0, 7), ["exec", "--cd", "/repo", "--sandbox", "read-only", "-c", "approval_policy=\"never\""]);
  assert.ok(observed.args.includes("--ephemeral")); assert.ok(observed.args.includes("--ignore-user-config")); assert.ok(observed.args.includes("--ignore-rules")); assert.ok(observed.args.includes("--output-schema"));
  assert.match(observed.args[observed.args.indexOf("--output-schema") + 1], /planner-proposal\.schema\.json$/); assert.match(observed.options.input, /read-only Crownless Autopilot Planner/);
});

test("valid proposal is passed to existing evaluation pipeline", () => {
  let received;
  const result = invokePlanner({ repo: "ryohryp/crownless", cwd: "/repo" }, { run: () => ({ status: 0, stdout: JSON.stringify(validProposal), stderr: "" }), evaluate: (proposal, options) => { received = { proposal, options }; return { ok: true, decision: "agent-ready", reason: null }; } });
  assert.deepEqual(received.proposal, validProposal); assert.equal(received.options.repo, "ryohryp/crownless"); assert.deepEqual(result.proposal, validProposal); assert.equal(result.decision, "agent-ready");
});

test("no_action proposal is accepted and evaluated", () => {
  const proposal = { action: "no_action", reason: "existing work already covers the next step" };
  const result = invokePlanner({ repo: "ryohryp/crownless", cwd: "/repo" }, { run: () => ({ status: 0, stdout: JSON.stringify(proposal), stderr: "" }), evaluate: () => ({ ok: true, decision: "no_action", reason: proposal.reason }) });
  assert.equal(result.ok, true); assert.equal(result.decision, "no_action"); assert.deepEqual(result.proposal, proposal);
});

test("command failure, empty/malformed output, and invalid repo fail closed", () => {
  let evaluated = false;
  const command = invokePlanner({ repo: "ryohryp/crownless", cwd: "/repo" }, { run: () => ({ status: 1, stdout: "", stderr: "codex unavailable" }), evaluate: () => { evaluated = true; } });
  assert.equal(command.reason, "planner_command_failed"); assert.equal(evaluated, false);
  assert.equal(invokePlanner({ repo: "ryohryp/crownless", cwd: "/repo" }, { run: () => ({ status: 0, stdout: "   ", stderr: "" }) }).reason, "planner_empty_output");
  assert.equal(invokePlanner({ repo: "ryohryp/crownless", cwd: "/repo" }, { run: () => ({ status: 0, stdout: "not-json", stderr: "" }) }).reason, "invalid_planner_output");
  let ran = false; const invalid = invokePlanner({ repo: "" }, { run: () => { ran = true; } }); assert.equal(invalid.reason, "invalid_repo"); assert.equal(ran, false);
});
