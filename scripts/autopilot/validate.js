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

function assertCommandPassed(result) {
  if (result.error || result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`Validation command failed: ${result.command} ${result.args.join(" ")}\n${result.error?.message || details}`);
  }
}

function runValidation({ cwd, run = defaultRun, nodeCommand = process.execPath, npmCommand = process.platform === "win32" ? "npm.cmd" : "npm" } = {}) {
  if (!cwd) throw new Error("Validation requires a working directory.");
  const commands = [];
  for (const relativePath of REQUIRED_SYNTAX_FILES) {
    const result = run(nodeCommand, ["--check", path.join(cwd, relativePath)], { cwd });
    commands.push({ command: nodeCommand, args: ["--check", relativePath], result });
    assertCommandPassed(result);
  }
  let testCommand = npmCommand;
  let testArgs = ["test"];
  let result = run(testCommand, testArgs, { cwd });
  if (result.error?.code === "ENOENT" && process.env.CI !== "true") {
    testCommand = nodeCommand;
    testArgs = ["--test"];
    result = run(testCommand, testArgs, { cwd });
  }
  commands.push({ command: testCommand, args: testArgs, result, fallback: testCommand === nodeCommand });
  assertCommandPassed(result);
  return { commands };
}

module.exports = { REQUIRED_SYNTAX_FILES, assertCommandPassed, defaultRun, runValidation };
