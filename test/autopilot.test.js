const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  assertSafeDiff,
  assertOutsideSource,
  branchForIssue,
  buildExecutionPrompt,
  buildPrBody,
  parseArgs,
  readReview,
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

test("execution prompt carries Canon and Issue while preserving the runner boundaries", () => {
  const prompt = buildExecutionPrompt({ number: 225, title: "Autopilot", body: "Acceptance Criteria" }, "AGENTS Canon");
  assert.match(prompt, /AGENTS Canon/);
  assert.match(prompt, /Acceptance Criteria/);
  assert.match(prompt, /Do not commit, push, create a PR/);
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

test("review result is fail-closed when malformed", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-test-"));
  const file = path.join(directory, "review.json");
  fs.writeFileSync(file, JSON.stringify({ status: "maybe", findings: [] }));
  assert.throws(() => readReview(file), /valid status/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("PR body records evidence, unverified playtest, and no auto-merge", () => {
  const body = buildPrBody(
    { number: 225 },
    branchForIssue(225),
    { commands: [{ command: "npm", args: ["test"] }] },
    { status: "pass", findings: [] },
  );
  assert.match(body, /Fixes #225/);
  assert.match(body, /human playtest/);
  assert.match(body, /does not merge/);
});

test("worktrees cannot be created inside the mutable source checkout", () => {
  assert.throws(() => assertOutsideSource("C:\\repo", "C:\\repo\\child"), /outside/);
  assert.equal(assertOutsideSource("C:\\repo", "C:\\repo-autopilot"), path.resolve("C:\\repo-autopilot"));
});

test("safety scan includes untracked files before they can be committed", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "crownless-autopilot-safety-"));
  fs.writeFileSync(path.join(directory, "candidate.js"), "const token = 'sk-123456789012345678901234';\n");
  const run = (_command, args) => {
    if (args[0] === "diff") return { status: 0, stdout: "", stderr: "" };
    if (args[0] === "ls-files") return { status: 0, stdout: "candidate.js\n", stderr: "" };
    throw new Error(`unexpected command ${args.join(" ")}`);
  };
  assert.throws(() => assertSafeDiff(run, directory, "HEAD"), /blocked credential/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test("CLI parsing keeps dry-run explicit and rejects unknown flags", () => {
  assert.deepEqual(parseArgs(["--dry-run", "--issue", "225"]), { dryRun: true, keepWorktree: false, issueNumber: 225 });
  assert.throws(() => parseArgs(["--unsafe"]), /Unknown option/);
});
