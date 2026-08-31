const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPlannerPrompt,
  invokePlanner,
} = require("../scripts/autopilot/planner-invocation.js");

const validProposal = {
  action: "create_issue",
  title: "帰還報告の状態表示を改善する",
  whyNow: "Report から Adapt への導線を改善するため",
  scope: "既存報告に状態表示を追加する",
  acceptanceCriteria: ["帰還状態が読める"],
  nonGoals: ["save schemaは変更しない"],
  risk: "low",
  humanGate: false,
  playtestRequired: false,
};

test("prompt requires Canon-first read-only planning", () => {
  const prompt = buildPlannerPrompt();
  assert.match(prompt, /AGENTS\.md/);
  assert.match(prompt, /docs\/game-system-design\.md/);
  assert.match(prompt, /Repository Canon overrides/);
  assert.match(prompt, /Do not modify files/);
  assert.match(prompt, /at most one/);
});

test("invocation pins Codex to read-only ephemeral no-approval mode and schema", () => {
  let observed;
  const result = invokePlanner(
    { repo: "ryohryp/crownless", cwd: "/repo", codexBin: "codex-test" },
    {
      run: (command, args, options) => {
        observed = { command, args, options };
        return { status: 0, stdout: JSON.stringify(validProposal), stderr: "" };
      },
      evaluate: () => ({ ok: true, decision: "agent-ready", risk: { eligible: true } }),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(observed.command, "codex-test");
  assert.deepEqual(observed.args.slice(0, 7), [
    "exec", "--cd", "/repo", "--sandbox", "read-only", "-c", "approval_policy=\"never\"",
  ]);
  assert.ok(observed.args.includes("--ephemeral"));
  assert.ok(observed.args.includes("--ignore-user-config"));
  assert.ok(observed.args.includes("--ignore-rules"));
  assert.ok(observed.args.includes("--output-schema"));
  assert.match(observed.args[observed.args.indexOf("--output-schema") + 1], /planner-proposal\.schema\.json$/);
  assert.match(observed.options.input, /read-only Crownless Autopilot Planner/);
});

test("valid proposal is passed to existing evaluation pipeline", () => {
  let received;
  const result = invokePlanner(
    { repo: "ryohryp/crownless", cwd: "/repo" },
    {
      run: () => ({ status: 0, stdout: JSON.stringify(validProposal), stderr: "" }),
      evaluate: (proposal, options) => {
        received = { proposal, options };
        return { ok: true, decision: "agent-ready", reason: null };
      },
    },
  );

  assert.deepEqual(received.proposal, validProposal);
  assert.equal(received.options.repo, "ryohryp/crownless");
  assert.deepEqual(result.proposal, validProposal);
  assert.equal(result.decision, "agent-ready");
});

test("no_action proposal is accepted and evaluated", () => {
  const proposal = { action: "no_action", reason: "existing work already covers the next step" };
  const result = invokePlanner(
    { repo: "ryohryp/crownless", cwd: "/repo" },
    {
      run: () => ({ status: 0, stdout: JSON.stringify(proposal), stderr: "" }),
      evaluate: () => ({ ok: true, decision: "no_action", reason: proposal.reason }),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.decision, "no_action");
  assert.deepEqual(result.proposal, proposal);
});

test("command failure fails closed without evaluation", () => {
  let evaluated = false;
  const result = invokePlanner(
    { repo: "ryohryp/crownless", cwd: "/repo" },
    {
      run: () => ({ status: 1, stdout: "", stderr: "codex unavailable" }),
      evaluate: () => {
        evaluated = true;
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.decision, "stop");
  assert.equal(result.reason, "planner_command_failed");
  assert.equal(evaluated, false);
});

test("empty and malformed output fail closed", () => {
  const empty = invokePlanner(
    { repo: "ryohryp/crownless", cwd: "/repo" },
    { run: () => ({ status: 0, stdout: "   ", stderr: "" }) },
  );
  assert.equal(empty.reason, "planner_empty_output");

  const malformed = invokePlanner(
    { repo: "ryohryp/crownless", cwd: "/repo" },
    { run: () => ({ status: 0, stdout: "not-json", stderr: "" }) },
  );
  assert.equal(malformed.reason, "invalid_planner_output");
});

test("invalid repo fails before command execution", () => {
  let ran = false;
  const result = invokePlanner(
    { repo: "" },
    {
      run: () => {
        ran = true;
      },
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "invalid_repo");
  assert.equal(ran, false);
});
