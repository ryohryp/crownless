const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REQUIRED_SYNTAX_FILES = [
  "src/game-core.js",
  "src/hunt-system.js",
  "src/dungeon-system.js",
  "src/progression-system.js",
  "src/save-system.js",
  "src/app-runtime-state.js",
  "src/combat-action-profiles.js",
  "src/app.js",
  "src/noncombat-presentation.js",
  "src/exploration-map-presentation.js",
  "src/hearth-presentation.js",
  "src/desktop-input.js",
];

function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    windowsHide: true,
  });
  return {
    command,
    args,
    status: result.status,
    error: result.error,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function assertCommandPassed(result, stage = "validation") {
  if (result.error || result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    const error = new Error(`[stage=${stage}] Validation command failed: ${result.command} ${result.args.join(" ")}\n${result.error?.message || details}`);
    error.autopilotDiagnostic = {
      stage,
      command: result.command,
      args: result.args,
      status: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.error?.message || "",
    };
    throw error;
  }
}

function runValidation({ cwd, run = defaultRun, nodeCommand = process.execPath, npmCommand = process.platform === "win32" ? "npm.cmd" : "npm", focusedTests = [] } = {}) {
  if (!cwd) throw new Error("Validation requires a working directory.");
  const commands = [];
  for (const relativePath of REQUIRED_SYNTAX_FILES) {
    const result = run(nodeCommand, ["--check", path.join(cwd, relativePath)], { cwd });
    commands.push({ command: nodeCommand, args: ["--check", relativePath], result });
    assertCommandPassed(result);
  }
  for (const focusedTest of focusedTests) {
    const focused = runTest(run, cwd, focusedTest, nodeCommand, npmCommand);
    commands.push({ ...focused.command, result: focused.result, focused: true, fallback: focused.fallback });
    assertCommandPassed(focused.result);
  }
  const full = runTest(run, cwd, null, nodeCommand, npmCommand);
  commands.push({ ...full.command, result: full.result, fallback: full.fallback });
  assertCommandPassed(full.result);
  return { commands };
}

function runTest(run, cwd, focusedTest, nodeCommand, npmCommand) {
  let command = npmCommand;
  let args = focusedTest ? ["test", "--", focusedTest] : ["test"];
  let result = run(command, args, { cwd });
  let fallback = false;
  const npmExecutableMissing = result.error?.code === "ENOENT"
    || (npmCommand.toLowerCase().endsWith(".cmd") && result.error?.code === "EINVAL");
  if (npmExecutableMissing && process.env.CI !== "true") {
    command = nodeCommand;
    args = focusedTest ? ["--test", focusedTest] : ["--test"];
    result = run(command, args, { cwd });
    fallback = true;
  }
  return { command: { command, args }, result, fallback };
}

module.exports = { REQUIRED_SYNTAX_FILES, assertCommandPassed, defaultRun, runTest, runValidation };
