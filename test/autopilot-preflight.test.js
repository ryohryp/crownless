const assert = require("node:assert/strict");
const test = require("node:test");

const { runPreflight, safeSummary } = require("../scripts/autopilot/preflight.js");

function success(stdout = "") {
  return { status: 0, stdout, stderr: "", error: null };
}

test("preflight reports READY when Git, gh, auth, Codex, and headless probe pass", () => {
  const calls = [];
  const result = runPreflight({ cwd: "/repo", codexBin: "codex-test" }, {
    run(command, args, options) {
      calls.push({ command, args, options });
      if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return success("/repo\n");
      if (command === "git" && args[0] === "status") return success("");
      return success();
    },
  });

  assert.equal(result.ready, true);
  assert.match(result.output, /Result\s+READY/);
  assert.deepEqual(result.checks.map((check) => check.name), [
    "Git repository",
    "origin/main",
    "source checkout",
    "gh CLI",
    "gh authenticated",
    "Codex CLI",
    "Codex headless exec",
  ]);

  const probe = calls.find((call) => call.command === "codex-test" && call.args[0] === "exec");
  assert.ok(probe);
  assert.ok(probe.args.includes("read-only"));
  assert.ok(probe.args.includes("--ephemeral"));
  assert.ok(probe.args.includes("--ignore-user-config"));
  assert.ok(probe.args.includes("--ignore-rules"));
  assert.equal(probe.options.cwd, "/repo");
  assert.match(probe.options.input, /Do not inspect, create, modify, or delete/);
});

test("preflight fails closed for a dirty source checkout without running mutating commands", () => {
  const calls = [];
  const result = runPreflight({ cwd: "/repo" }, {
    run(command, args) {
      calls.push([command, args]);
      if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return success("/repo\n");
      if (command === "git" && args[0] === "status") return success(" M src/app.js\n");
      return success();
    },
  });

  assert.equal(result.ready, false);
  assert.match(result.output, /source checkout\s+FAIL/);
  assert.match(result.output, /Result\s+BLOCKED/);
  assert.equal(calls.some(([command, args]) => command === "gh" && ["issue", "pr", "label"].includes(args[0])), false);
  assert.equal(calls.some(([command, args]) => command === "git" && ["branch", "worktree", "fetch", "push"].includes(args[0])), false);
});

test("preflight surfaces the failing stage and redacts credential-shaped diagnostics", () => {
  const result = runPreflight({ cwd: "/repo" }, {
    run(command, args) {
      if (command === "git" && args[0] === "rev-parse" && args[1] === "--show-toplevel") return success("/repo\n");
      if (command === "git" && args[0] === "status") return success("");
      if (command === "gh" && args[0] === "auth") return { status: 1, stdout: "", stderr: "token=ghp_abcdefghijklmnopqrstuvwxyz012345", error: null };
      return success();
    },
  });

  assert.equal(result.ready, false);
  const auth = result.checks.find((check) => check.name === "gh authenticated");
  assert.equal(auth.passed, false);
  assert.equal(auth.stage, "gh authenticated");
  assert.doesNotMatch(auth.summary, /ghp_/);
  assert.match(auth.summary, /\[redacted\]/);
});

test("safeSummary bounds output and removes common secrets", () => {
  const summary = safeSummary(`Authorization: bearer-secret ${"x".repeat(400)}`, 80);
  assert.ok(summary.length <= 80);
  assert.doesNotMatch(summary, /bearer-secret/);
  assert.match(summary, /\[redacted\]/);
});
