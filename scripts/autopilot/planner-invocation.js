const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { parsePlannerProposal } = require("./planner-proposal.js");
const { evaluatePlannerProposal } = require("./planner-evaluation.js");

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

function stop(reason, error) {
  return {
    ok: false,
    decision: "stop",
    reason,
    ...(error ? { error } : {}),
  };
}

function buildPlannerPrompt() {
  return [
    "You are the read-only Crownless Autopilot Planner.",
    "Inspect the current repository and choose at most one smallest next improvement.",
    "Repository Canon overrides memory, assumptions, and historical design documents.",
    "Read AGENTS.md first, then docs/game-system-design.md and relevant canonical subsystem specs.",
    "Also inspect open Issues, open PRs, recent merged work, current source, tests, and CI evidence available in the repository/tooling.",
    "Prioritize playable-loop bugs and friction over architecture cleanup.",
    "Do not modify files, create branches, create Issues, change labels, run deployment, or perform any mutation.",
    "If active or existing work already covers the best next step, return no_action.",
    "Return exactly one JSON object matching the supplied output schema and nothing else.",
  ].join("\n");
}

function invokePlanner(
  {
    repo,
    cwd = process.cwd(),
    codexBin = process.env.AUTOPILOT_CODEX_BIN || "codex",
  } = {},
  {
    run = defaultRun,
    evaluate = evaluatePlannerProposal,
  } = {},
) {
  if (typeof repo !== "string" || !repo.trim()) {
    return stop("invalid_repo", "repo is required in owner/name form");
  }

  const schemaPath = path.join(cwd, "scripts", "autopilot", "planner-proposal.schema.json");
  const args = [
    "exec",
    "--cd", cwd,
    "--sandbox", "read-only",
    "-c", "approval_policy=\"never\"",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--output-schema", schemaPath,
    "-",
  ];

  let commandResult;
  try {
    commandResult = run(codexBin, args, {
      cwd,
      input: buildPlannerPrompt(),
    });
  } catch (error) {
    return stop("planner_command_failed", error instanceof Error ? error.message : String(error));
  }

  if (!commandResult || commandResult.status !== 0) {
    const detail = commandResult && (commandResult.stderr || commandResult.stdout || commandResult.error?.message);
    return stop("planner_command_failed", String(detail || "planner command failed").trim());
  }

  const output = String(commandResult.stdout || "").trim();
  if (!output) return stop("planner_empty_output", "planner returned no proposal");

  const parsed = parsePlannerProposal(output);
  if (!parsed.ok) return stop("invalid_planner_output", parsed.error);

  let evaluation;
  try {
    evaluation = evaluate(parsed.proposal, { repo });
  } catch (error) {
    return stop("planner_evaluation_failed", error instanceof Error ? error.message : String(error));
  }

  if (!evaluation || typeof evaluation !== "object") {
    return stop("planner_evaluation_failed", "evaluation must return an object");
  }

  return {
    ...evaluation,
    proposal: parsed.proposal,
  };
}

module.exports = {
  buildPlannerPrompt,
  defaultRun,
  invokePlanner,
};
