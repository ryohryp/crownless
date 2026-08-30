const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertSafeDiff,
  assertOutsideSource,
  branchForIssue,
  buildCommitMessage,
  buildExecutionPrompt,
  buildPullRequestTitle,
  buildPrBody,
  invokeCodex,
  invokeReview,
  parseArgs,
  readReview,
  persistDiagnostic,
  resolveControlPlaneArtifacts,
  runWithSourceClean,
} = require("../scripts/autopilot/run-next.js");
const { findBlockers, selectIssue } = require("../scripts/autopilot/select-issue.js");
const { REQUIRED_SYNTAX_FILES, runValidation } = require("../scripts/autopilot/validate.js");

test("selectIssue chooses one eligible open Issue deterministically", () => {
  const issue = selectIssue([
    { number: 230, state: "OPEN", labels: [{ name: "agent-ready" }] },
    { number: 225, state: "OPEN", labels: [{ name: "agent-ready" }] },
    { number: 220, state: "CLOSED", labels: [{ name: "agent-ready" }] },
    { number: 219, state: "OPEN", labels: [] },
  ]);
  assert.equal(issue.number, 225);
});

test("duplicate detection blocks running locks, matching branches, and linked PRs", () => {
  const blockers = findBlockers({
    issueNumber: 225,
    branchName: branchForIssue(225),
    runningIssues: [{ number: 225 }],
    openPullRequests: [
      { number: 1, headRefName: branchForIssue(225), title: "unrelated" },
      { number: 2, headRefName: "other", title: "Fixes #225" },
    ],
  });
  assert.equal(blockers.length, 3);
});

test("duplicate detection also blocks an existing deterministic branch", () => {
  const blockers = findBlockers({
    issueNumber: 225,
    branchName: branchForIssue(225),
    branchExists: true,
  });
  assert.deepEqual(blockers, ["Autopilot branch codex/autopilot-issue-225 already exists."]);
});

test("execution prompt carries Canon and Issue while preserving the runner boundaries", () => {
  const prompt = buildExecutionPrompt({ number: 225, title: "Autopilot", body: "Acceptance Criteria" }, "Execution contract", "Control-plane policy", ["test/issue.test.js"]);
  assert.match(prompt, /Execution contract/);
  assert.match(prompt, /Control-plane policy/);
  assert.match(prompt, /Do not assume those control-plane files exist in the target worktree/);
  assert.match(prompt, /Acceptance Criteria/);
  assert.match(prompt, /test\/issue\.test\.js/);
  assert.match(prompt, /Do not commit, push, create a PR/);
});

test("control-plane artifacts resolve from the runner checkout", () => {
  const artifacts = resolveControlPlaneArtifacts(path.resolve(__dirname, ".."));
  assert.match(artifacts.contractPath, /docs[\\/]autopilot-execution-contract\.md$/);
  assert.match(artifacts.schemaPath, /scripts[\\/]autopilot[\\/]review-output\.schema\.json$/);
});

test("validation runs every repository syntax check and npm test", () => {
  const calls = [];
  const result = runValidation({
    cwd: "C:\\work",
    run(command, args) {
      calls.push([command, args]);
      return { command, args, status: 0, stdout: "", stderr: "" };
    },
    nodeCommand: "node-test",
    npmCommand: "npm-test",
  });
  assert.equal(result.commands.length, REQUIRED_SYNTAX_FILES.length + 1);
  assert.equal(calls.at(-1)[0], "npm-test");
  assert.deepEqual(calls.at(-1)[1], ["test"]);
});

test("validation records focused tests before full validation", () => {
  const calls = [];
  const result = runValidation({
    cwd: "C:\\work",
    focusedTests: ["test/package-metadata.test.js"],
    run(command, args) {
      calls.push([command, args]);
      return { command, args, status: 0, stdout: "", stderr: "" };
    },
    nodeCommand: "node-test",
    npmCommand: "npm-test",
  });
  assert.equal(result.commands.at(-2).focused, true);
  assert.deepEqual(calls.at(-2)[1], ["test", "--", "test/package-metadata.test.js"]);
  assert.equal(result.commands.filter((command) => command.focused).length, 1);
  assert.equal(result.commands.some((command) => command.args.includes("test/autopilot.test.js")), false);
  assert.deepEqual(calls.at(-1)[1], ["test"]);
});

test("CLI carries an Issue-specific focused test into validation", () => {
  const options = parseArgs(["--issue", "230", "--focused-test", "test/package-metadata.test.js"]);
  assert.equal(options.issueNumber, 230);
  assert.deepEqual(options.focusedTests, ["test/package-metadata.test.js"]);
  assert.notDeepEqual(options.focusedTests, ["test/autopilot.test.js"]);
});

test("implementation and review operations always check source cleanliness", () => {
  const calls = [];
  const run = (command, args, options) => {
    calls.push([command, args, options]);
    return { status: 0, stdout: "", stderr: "" };
  };
  assert.equal(runWithSourceClean(run, "C:\\runner", () => "implementation-result"), "implementation-result");
  assert.equal(runWithSourceClean(run, "C:\\runner", () => "review-result"), "review-result");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call[1]), [["status", "--porcelain"], ["status", "--porcelain"]]);
  assert.deepEqual(calls.map((call) => call[2].cwd), ["C:\\runner", "C:\\runner"]);
});

test("source cleanliness failure preserves an invocation diagnostic", () => {
  const operationError = new Error("Codex failed");
  operationError.autopilotDiagnostic = { stage: "codex-implementation", command: "codex", args: ["exec"], status: 1, stdout: "out", stderr: "err" };
  const run = (command) => command === "git"
    ? { status: 0, stdout: " M runner.js\n", stderr: "" }
    : { status: 0, stdout: "", stderr: "" };
  let caught;
  try {
    runWithSourceClean(run, "C:\\runner", () => { throw operationError; });
  } catch (error) {
    caught = error;
  }
  assert.equal(caught, operationError);
  assert.match(caught.message, /Codex failed/);
  assert.match(caught.message, /clean source checkout/);
  assert.equal(caught.autopilotDiagnostic.stdout, "out");
  assert.match(caught.autopilotDiagnostic.sourceCleanError, /clean source checkout/);
});

test("non-CI Windows npm command spawn differences use the node test fallback", () => {
  const calls = [];
  const previousCi = process.env.CI;
  delete process.env.CI;
  let result;
  try {
    result = runValidation({
      cwd: "C:\\work",
      focusedTests: ["test/package-metadata.test.js"],
      run(command, args) {
        calls.push([command, args]);
        if (command === "npm.cmd") return { command, args, status: null, stdout: "", stderr: "", error: Object.assign(new Error("spawnSync npm.cmd EINVAL"), { code: "EINVAL" }) };
        return { command, args, status: 0, stdout: "", stderr: "" };
      },
      nodeCommand: "node-test",
      npmCommand: "npm.cmd",
    });
  } finally {
    if (previousCi === undefined) delete process.env.CI;
    else process.env.CI = previousCi;
  }
  assert.equal(result.commands[REQUIRED_SYNTAX_FILES.length].fallback, true);
  assert.deepEqual(calls.at(-3), ["node-test", ["--test", "test/package-metadata.test.js"]]);
  assert.deepEqual(calls.at(-1), ["node-test", ["--test"]]);
});

test("review result is fail-closed when malformed", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-test-"));
  const file = path.join(directory, "review.json");
  fs.writeFileSync(file, JSON.stringify({ status: "maybe", findings: [] }));
  assert.throws(() => readReview(file), /valid status/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("review result rejects schema-shaped objects with invalid extra data", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-review-"));
  const file = path.join(directory, "review.json");
  fs.writeFileSync(file, JSON.stringify({ status: "pass", findings: [], unexpected: true }));
  assert.throws(() => readReview(file), /unexpected top-level/);
  fs.writeFileSync(file, JSON.stringify({ status: "pass", findings: [{ severity: "note", message: "ok", unexpected: true }] }));
  assert.throws(() => readReview(file), /invalid finding object/);
  fs.writeFileSync(file, JSON.stringify({ status: "pass", findings: [{ severity: "note", message: "ok" }] }));
  assert.throws(() => readReview(file), /invalid finding object/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("Codex implementation and review use isolated, config-independent execution", () => {
  const calls = [];
  const run = (command, args, options) => {
    calls.push([command, args, options]);
    return { command, args, status: 0, stdout: "", stderr: "" };
  };
  invokeCodex(run, "C:\\worktree", "prompt", "C:\\tmp\\implementation.txt", "codex-test", "C:\\runner");
  invokeReview(run, "C:\\worktree", "C:\\worktree\\schema.json", "review", "C:\\tmp\\review.json", "codex-test");
  assert.equal(calls.length, 2);
  assert.ok(calls[0][1].includes("--ignore-user-config"));
  assert.ok(calls[0][1].includes("--ignore-rules"));
  assert.deepEqual(calls[0][1].slice(0, 13), ["exec", "--cd", "C:\\runner", "--add-dir", "C:\\worktree", "--sandbox", "workspace-write", "-c", "approval_policy=\"never\"", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--output-last-message"]);
  assert.equal(calls[0][2].cwd, "C:\\runner");
  assert.ok(calls[1][1].includes("--ignore-user-config"));
  assert.ok(calls[1][1].includes("--ignore-rules"));
  assert.ok(calls[1][1].includes("--sandbox") && calls[1][1].includes("read-only"));
  assert.ok(calls[1][1].includes("--ephemeral") && calls[1][1].includes("--output-schema"));
  assert.equal(calls[1][1].includes("review"), false);
  assert.equal(calls[1][2].cwd, "C:\\worktree");
});

test("PR body records evidence, unverified playtest, and no auto-merge", () => {
  const body = buildPrBody(
    { number: 231, title: "Fix expedition report wording", body: "## Acceptance Criteria\n- [ ] Report wording is concise\n- [ ] Existing behavior remains stable\n\n## Non-goals\n- [ ] Redesign the report" },
    branchForIssue(231),
    { commands: [{ command: "npm", args: ["test"] }] },
    { status: "pass", findings: [] },
    ["src/report.js"],
  );
  assert.match(body, /Fixes #231/);
  assert.match(body, /Fix expedition report wording/);
  assert.match(body, /src\/report\.js/);
  assert.match(body, /\[ \] Report wording is concise/);
  assert.match(body, /\[ \] Existing behavior remains stable/);
  assert.doesNotMatch(body, /Redesign the report/);
  assert.match(body, /human playtest/);
  assert.match(body, /does not merge/);
  assert.doesNotMatch(body, /one-Issue Crownless Autopilot runner/);
});

test("PR and commit metadata are derived from the selected Issue", () => {
  const issue = { number: 231, title: "Fix expedition report wording" };
  assert.equal(buildCommitMessage(issue), "Issue #231: Fix expedition report wording");
  assert.equal(buildPullRequestTitle(issue), "Fix expedition report wording (#231)");
});

test("failed Codex commands preserve stage and stdout/stderr diagnostics", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-diagnostic-"));
  fs.mkdirSync(path.join(directory, ".git"));
  const runArtifactsPath = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-run-"));
  fs.writeFileSync(path.join(runArtifactsPath, "implementation.txt"), "codex output");
  const error = new Error("codex failed");
  error.autopilotDiagnostic = { stage: "codex-implementation", command: "codex", args: ["exec"], status: 1, stdout: "out", stderr: "err", runArtifactsPath, runArtifactsOwned: true };
  const filePath = persistDiagnostic(directory, 231, error);
  const diagnostic = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.equal(diagnostic.stage, "codex-implementation");
  assert.equal(diagnostic.stdout, "out");
  assert.equal(diagnostic.stderr, "err");
  assert.ok(diagnostic.runArtifactsPath);
  assert.ok(fs.existsSync(diagnostic.runArtifactsPath));
  assert.equal(fs.existsSync(runArtifactsPath), false);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("diagnostic retention records the copied run when source cleanup fails", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-retention-"));
  fs.mkdirSync(path.join(directory, ".git"));
  const runArtifactsPath = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-run-"));
  fs.writeFileSync(path.join(runArtifactsPath, "review.json"), "{}");
  const originalRmSync = fs.rmSync;
  const error = new Error("codex failed");
  error.autopilotDiagnostic = { stage: "codex-review", command: "codex", args: ["exec"], status: 1, stdout: "out", stderr: "err", runArtifactsPath, runArtifactsOwned: true };
  fs.rmSync = (target, options) => {
    if (target === runArtifactsPath) throw new Error("source cleanup failed");
    return originalRmSync(target, options);
  };
  let filePath;
  try {
    filePath = persistDiagnostic(directory, 232, error);
  } finally {
    fs.rmSync = originalRmSync;
  }
  const diagnostic = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert.match(diagnostic.runArtifactsPath, /issue-232-.*-run/);
  assert.equal(diagnostic.runArtifactsCleanupError, "source cleanup failed");
  assert.ok(fs.existsSync(diagnostic.runArtifactsPath));
  fs.rmSync(directory, { recursive: true, force: true });
  fs.rmSync(runArtifactsPath, { recursive: true, force: true });
});

test("worktrees cannot be created inside the mutable source checkout", () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-source-"));
  const child = path.join(source, "child");
  const allowed = path.join(source, ".git", "crownless-autopilot-worktrees", "issue-230");
  const sibling = path.join(path.dirname(source), `${path.basename(source)}-autopilot`);
  assert.throws(() => assertOutsideSource(source, child), /outside/);
  assert.equal(assertOutsideSource(source, allowed, allowed), path.resolve(allowed));
  assert.throws(() => assertOutsideSource(source, path.dirname(allowed), allowed), /outside/);
  if (process.platform === "win32") assert.throws(() => assertOutsideSource(source, `${source.toUpperCase()}\\child`), /outside/);
  assert.equal(assertOutsideSource(source, sibling), path.resolve(sibling));
  fs.rmSync(source, { recursive: true, force: true });
});

test("safety scan includes untracked files before they can be committed", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-safety-"));
  const fakeToken = ["sk", "123456789012345678901234"].join("-");
  fs.writeFileSync(path.join(directory, "candidate.js"), `const token = '${fakeToken}';\n`);
  const run = (_command, args) => {
    if (args[0] === "diff") return { status: 0, stdout: "", stderr: "" };
    if (args[0] === "ls-files") return { status: 0, stdout: "candidate.js\n", stderr: "" };
    throw new Error(`unexpected command ${args.join(" ")}`);
  };
  assert.throws(() => assertSafeDiff(run, directory, "HEAD"), /blocked credential/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("CLI parsing keeps dry-run explicit and rejects unknown flags", () => {
  assert.deepEqual(parseArgs(["--dry-run", "--issue", "225"]), { dryRun: true, keepWorktree: false, focusedTests: [], issueNumber: 225 });
  assert.deepEqual(parseArgs(["--focused-test", "test/autopilot.test.js"]), { dryRun: false, keepWorktree: false, focusedTests: ["test/autopilot.test.js"] });
  assert.throws(() => parseArgs(["--issue", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--unsafe"]), /Unknown option/);
});
