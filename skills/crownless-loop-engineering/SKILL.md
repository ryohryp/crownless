---
name: crownless-loop-engineering
description: Improve Crownless through one small play-driven iteration that strengthens the current fun loop.
---

# Crownless Loop Engineering

Use this Skill when deciding or implementing the next gameplay improvement.

Protect and strengthen these current fun anchors:

- equipment visibly changes the character,
- combat rewards strategy and meaningful choices,
- exploration makes the world feel larger,
- stronger equipment creates motivation to explore again.

For each iteration, choose the weakest or most promising link, make one small coherent change, run the game, play the affected loop, and decide whether to keep, change, or drop it.

Prefer changes that connect multiple anchors, especially:

**Explore → Fight → Loot → Equip/Improve → Reach farther → Explore again**

Do not add a large new system when a smaller change can make this loop more compelling.

## Jev advisory checkpoints

Use Jev to reduce expensive agent work, not to add another approval layer.

### Before implementation: narrow the path

When there are 2–4 genuinely reasonable next tasks or implementation strategies, call `jevDecide` once before deep investigation or coding.

Give it bounded evidence only:

- the current player-facing problem,
- the relevant AGENTS.md / Issue constraints,
- a short summary of recent related changes,
- the small set of candidate tasks or strategies,
- known blockers or CI/playtest evidence.

Do not send full repositories, long raw logs, secrets, or large source dumps.

Use the result to decide **what to inspect first and what not to spend agent context on**. Jev is advisory: repository evidence, tests, CI, playtest, and explicit user direction remain authoritative.

Skip preflight Jev when the next action is already obvious, such as a single reproducible blocker, a requested concrete implementation, or a deterministic test failure with a clear cause.

### Route work to the cheapest sufficient execution target

Choose the execution target before doing broad investigation.

Prefer this order when it is sufficient:

1. **GitHub connector/API** — repository files, Issues, PRs, diffs, CI status/logs, branch/commit/PR operations.
2. **Public web** — current public documentation or external facts not already present in the repository.
3. **Local worker / local CLI** — running the app, tests, build tools, browser automation, or inspecting local-only files.
4. **Remote desktop / interactive GUI** — only when the task truly requires desktop interaction that APIs or CLI cannot perform.

Do not open a browser, remote desktop, or local environment merely to inspect data already available through GitHub APIs.

When two or more execution targets are genuinely plausible and the choice materially changes cost or context size, use a bounded Jev routing decision before dispatch.

Use Jev transport in this order:

1. **Advisor MCP/tool**, when `jevChooseExecutionTarget` / `jevDecide` is exposed in the active environment.
2. **Personal Orbit Jev REST**, when MCP/tool exposure is unavailable:
   - `POST /api/chat/secretary/jev/execution-target`
   - `POST /api/chat/secretary/jev/decide`
   - base URL from the configured Personal Orbit Jev/Public base URL
   - authenticated with the existing Secretary REST bearer; never copy the bearer into prompts, logs, commits, Issues, or PRs.
3. **Deterministic routing fallback** only when neither Jev transport is available or the Jev request fails.

For execution-target selection, prefer the dedicated execution-target contract. Use `decide` with execution targets as bounded choices only when the dedicated contract is unavailable.

Jev transport availability must never block the development cycle.

Provide only a short task summary, required capabilities, and available target names. Do not send tool arguments, secrets, raw logs, or source dumps.

Skip Jev routing when the target is obvious. The purpose is to avoid expensive detours, not to require a routing decision for every tool call.

### During failure recovery: reduce diagnostic branching

If the first direct inspection does not make a CI/test failure obvious, summarize 2–4 plausible causes or next diagnostic actions and use Jev `decide` to choose which branch to investigate first, via MCP/tool or the Personal Orbit REST endpoint.

Do not use Jev instead of reading the actual failing assertion, stack trace, or workflow step.

### After implementation: keep shadow evaluation bounded

Keep completion evaluation shadow-only. Prefer one Jev evaluation for the final materially changed head of a cycle. If the MCP/tool is not exposed, use the Personal Orbit `/api/chat/secretary/jev/decide` REST endpoint before falling back to no Jev evaluation.

Do not repeat the same evaluation unless the implementation or evidence changed materially.

A Jev result must never authorize merge, skip tests, override CI, replace phone-size playtest, or close an Issue by itself.

### Efficiency rule

Jev is useful when it removes branches from expensive reasoning. If calling it does not reduce what the coding agent needs to read, run, or implement, skip the call.
