const { spawnSync } = require("node:child_process");
const path = require("node:path");

const TOKEN_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g,
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\bAIza[A-Za-z0-9_-]{8,}\b/g,
  /\b(?:token|authorization|credential|secret)\s*[:=]\s*[^\s]+/gi,
];

function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    input: options.input,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error || null,
  };
}

function safeSummary(value, maxLength = 240) {
  let summary = String(value || "").replace(/\s+/g, " ").trim();
  for (const pattern of TOKEN_PATTERNS) summary = summary.replace(pattern, "[redacted]");
  if (!summary) return "";
  return summary.length <= maxLength ? summary : `${summary.slice(0, maxLength - 1)}…`;
}

function commandCheck(run, name, command, args, options = {}) {
  const result = run(command, args, options);
  const passed = result.status === 0;
  return {
    name,
    passed,
    stage: name,
    summary: passed ? "" : safeSummary(result.stderr || result.stdout || result.error?.message || `exit ${result.status}`),
  };
}

function gitRoot(run, cwd) {
  const result = run("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.status !== 0) return { root: path.resolve(cwd), check: { name: "Git repository", passed: false, stage: "git-repository", summary: safeSummary(result.stderr || result.error?.message || "not a Git repository") } };
  return { root: result.stdout.trim() || path.resolve(cwd), check: { name: "Git repository", passed: true, stage: "git-repository", summary: "" } };
}

function formatPreflight(checks) {
  const width = Math.max(...checks.map((check) => check.name.length), "Result".length);
  const lines = checks.map((check) => {
    const status = check.passed ? "OK" : "FAIL";
    const detail = check.summary ? ` — ${check.summary}` : "";
    return `${check.name.padEnd(width)}  ${status}${detail}`;
  });
  const ready = checks.every((check) => check.passed);
  lines.push(`${"Result".padEnd(width)}  ${ready ? "READY" : "BLOCKED"}`);
  return lines.join("\n");
}

function runPreflight(options = {}, dependencies = {}) {
  const run = dependencies.run || defaultRun;
  const cwd = options.cwd || process.cwd();
  const codexBin = options.codexBin || process.env.AUTOPILOT_CODEX_BIN || "codex";
  const { root, check: repositoryCheck } = gitRoot(run, cwd);
  const checks = [repositoryCheck];

  checks.push(commandCheck(run, "origin/main", "git", ["rev-parse", "--verify", "origin/main"], { cwd: root }));

  const status = run("git", ["status", "--porcelain"], { cwd: root });
  checks.push({
    name: "source checkout",
    passed: status.status === 0 && status.stdout.trim() === "",
    stage: "source-clean",
    summary: status.status !== 0 ? safeSummary(status.stderr || status.error?.message || "git status failed") : status.stdout.trim() ? "working tree is not clean" : "",
  });

  checks.push(commandCheck(run, "gh CLI", "gh", ["--version"], { cwd: root }));
  checks.push(commandCheck(run, "gh authenticated", "gh", ["auth", "status"], { cwd: root }));
  checks.push(commandCheck(run, "Codex CLI", codexBin, ["--version"], { cwd: root }));
  checks.push(commandCheck(run, "Codex headless exec", codexBin, [
    "exec",
    "--cd", root,
    "--sandbox", "read-only",
    "-c", "approval_policy=\"never\"",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "-",
  ], {
    cwd: root,
    input: "Reply with exactly READY. Do not inspect, create, modify, or delete repository files.",
  }));

  const ready = checks.every((check) => check.passed);
  return { ready, checks, output: formatPreflight(checks) };
}

if (require.main === module) {
  const result = runPreflight();
  process.stdout.write(`${result.output}\n`);
  if (!result.ready) process.exitCode = 1;
}

module.exports = {
  defaultRun,
  formatPreflight,
  runPreflight,
  safeSummary,
};
