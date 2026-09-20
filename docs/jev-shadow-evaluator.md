# Jev shadow evaluator

Issue #744 introduces Jev as an **optional, shadow-only** evaluator for Crownless development cycles.

Jev never authorizes merge, push, issue closure, test skipping, or any other side effect. The existing completion boundary in `AGENTS.md`, tests, CI, and playtest evidence remain authoritative.

## Run

At the end of a development cycle, prepare bounded evidence as JSON and pipe it to:

```sh
node scripts/jev-shadow-evaluate.cjs < evidence.json
```

The script prints one JSON log record. It always exits successfully so a Jev/MCP/API failure cannot break the normal development loop.

Example evidence:

```json
{
  "task": "#744 Jev shadow evaluator",
  "agentChoice": "done",
  "changedFiles": ["scripts/jev-shadow-evaluate.cjs"],
  "diffSummary": "Adds fail-open shadow evaluation.",
  "checks": { "test": "pass", "ci": "pass" },
  "playtest": "not_applicable",
  "retryCount": 0
}
```

## Configuration

Set `CROWNLESS_JEV_MCP_COMMAND` to the command that invokes the selected existing Jev MCP implementation in one-shot/stdin mode. Do not put `TYPESAFE_API_KEY` or any other secret in the repository.

The command receives a bounded JSON request on stdin and should return JSON containing a choice. Supported choices are normalized to:

- `done`
- `retry`
- `change_strategy`
- `needs_human`

If the evaluator returns an unknown choice, invalid JSON, times out, or cannot start, the result is logged as unavailable and Crownless continues normally.

Optional: `CROWNLESS_JEV_TIMEOUT_MS` (default 8000, maximum 30000).

## Data boundary

Only bounded evidence is sent. Never include environment values, tokens, secrets, precise location, full source files, or unbounded external/Issue content. Prefer changed filenames and a short diff summary over a full diff.

The log contains the Agent choice next to the Jev choice/confidence/probabilities so later cycles can compare disagreements without changing execution authority.
