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
    "Read AGENTS.md first, then docs/adr/0004-territory-driven-reforge.md, docs/game-system-design.md, docs/autonomous-development-policy.md, Issue #503 while its acceptance criteria remain active, and relevant canonical subsystem specs.",
    "The current product direction is Location × Territory RPG. Expeditions are a principal means of acting on places, not the ultimate product goal.",
    "The current North Star is: 自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？",
    "Use the product loop Walk → Discover → Scout/Learn → Prepare → Contest/Expedition → Control → Exploit/Defend/Expand → Next place. Treat the older expedition-result loop/North Star as historical subsystem context where it conflicts with ADR 0004.",
    "Also inspect open Issues, open PRs, recent merged work, current source, tests, and CI evidence available in the repository/tooling.",
    "Treat issue lifecycle labels as authoritative planning signals: future = intentionally deferred and not executable now; decision-log = ongoing record, never an implementation candidate; playtest-pending = implementation already exists and awaits human Keep/Change/Kill, so do not select it for more implementation unless explicit new evidence requires a change.",
    "Do not equate open with unimplemented. For broad Epic Issues, inspect current code, merged PRs, comments, and remaining Acceptance Criteria before proposing more slices. Prefer finishing a bounded remaining AC over endlessly feeding unrelated scope into an old Epic.",
    "Before choosing work, inspect the latest human-confirmed playtest outcomes in decision log #367 and relevant Issue/PR comments. Extract up to five recent Keep, Change, or Kill learnings with their source, observed reason, and a concrete implication for the next Planner cycle.",
    "Never infer Keep, Change, or Kill from tests, CI, merged state, labels, or static review. If no human-confirmed playtest learning exists, return an empty recentPlaytestLearning.entries array and explicitly say so in its summary.",
    "Every playtest learning source must be accounted for in learningApplication: either applied to candidate generation or explicitly ignored with a reason. Every Change learning must be applied and must influence at least one candidate through that candidate's learningSources.",
    "Keep learning may be used as evidence for a successful pattern, but do not mechanically clone the same feature. Use its reason to preserve what worked while still searching for the next smallest hypothesis.",
    "If a candidate substantially revisits a hypothesis previously marked Kill, set revisitsKilledHypothesis=true, reference that Kill source in learningSources, and provide killRevisitEvidence identifying concrete new evidence or changed conditions. Otherwise do not resurrect killed hypotheses.",
    "Before choosing work, review the most recent 3-5 development cycles: state whether new player-visible play or a meaningful territory/next-decision consequence was added, whether recent work became maintenance-heavy, and whether it drifted into old-Canon microfeatures.",
    "A P0 or clear player-facing bug may be selected immediately. Otherwise compare exactly three candidates, normally new gameplay hypotheses, and explain why each was or was not selected.",
    "Evaluate every candidate with the Gameplay Gate: Player-visible, Decision, Risk/Reward when applicable, Core Loop, Replayability, Fantasy, Geography when location-related, and Canon.",
    "For gameplay innovation, Decision=0 or Core Loop=0 is a hard rejection. A location-related gameplay idea must explain what geography enables beyond step-count rewards and how that place can matter later.",
    "Do not classify another location-specific binary choice, Report wording/content addition, or isolated expedition-result optimization as product innovation unless it creates a real Territory-loop consequence or is directly necessary for an accepted Territory vertical slice.",
    "For the selected gameplay hypothesis, state the Interesting Decision (what the player will now hesitate over), MDA (Mechanic, Dynamic, Desired Experience), and one smallest end-to-end vertical slice from information/discovery through a persistent changed next decision.",
    "For Territory-driven gameplay, prefer a causal chain like discovery/information → scout-or-risk decision → preparation/action → contest result → persistent control/world change or meaningful failure → changed next target/approach. Reuse the deterministic expedition resolver where practical rather than building a territory engine first.",
    "Territory is not XP: reject control-progress bars, capture from repetitive trash kills, stamina/energy/daily chores, arbitrary N-repeat capture requirements, and tiny invisible percentage bonuses as the main ownership reward.",
    "Prefer player-chosen risk when risk/reward naturally applies. Equipment, companions, traits, routes, and approaches should change choices or available options, not only numeric power.",
    "Do not let repeated copy edits, test-only changes, tiny UI polish, refactors, architecture cleanliness, Report-volume work, or old-Canon expedition polish crowd out playable Territory-driven improvements. A qualifying innovation may outrank older backlog work when it is not duplicate or blocked by active work.",
    "Respect #503 Phase 1 scope: do not introduce PvP, clan/guild war, seasons, rankings, always-on faction simulation, a new backend, mandatory cloud accounts, large economy simulation, a generic territory scripting engine, large save migration, raw GPS/exact route-history persistence, or real-time combat. If a large migration or another human-gated boundary is required, fail closed.",
    "Implementation success and game-design success are separate: tests/CI can make a slice Implemented, but gameplay remains Playtest pending until a human records Keep, Change, or Kill.",
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
