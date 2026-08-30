# Crownless Autopilot execution contract

This contract is the versioned handoff given to Codex by the repository Autopilot runner. It is intentionally narrow: one explicitly `agent-ready` open Issue, one isolated worktree, one PR, and no automatic merge.

## Agent instructions

1. Read `AGENTS.md`, `docs/game-system-design.md`, the Issue body, and any canonical subsystem specification that the Issue touches before changing code.
2. Treat the Issue Acceptance Criteria as the scope. Inspect the current implementation and related Issues/PRs first.
3. Make the smallest implementation that satisfies the Issue. Do not change Canon, weaken safety/privacy checks, add credentials/provider keys/raw GPS or route history, or expand into unrelated cleanup.
4. Run focused tests and then the repository-required full validation. Never hide a failure by weakening an expectation.
5. Review the final diff against the Issue and Canon. If the diff needs correction, correct it and repeat validation.
6. Do not commit, push, create a PR, merge, or close an Issue. The runner owns those boundaries.

The runner treats a missing, malformed, or failed result as a failure. Report unverified items explicitly, especially human playtest needs.
