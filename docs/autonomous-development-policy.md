# Crownless Autonomous Development Policy

> **Status:** initial policy for Codex-assisted autonomous development  
> **Product Canon:** `AGENTS.md`, `docs/game-system-design.md`, `docs/adr/0002-idle-expedition-pivot.md`

## Purpose

Crownless should be able to delegate routine implementation work to coding agents without delegating the final judgment of whether the game is fun.

The intended split is:

- **Agent:** inspect Canon and current code, choose an explicitly eligible task, implement it, test it, review it, and prepare a PR
- **Human game director / player:** judge play feel, product direction, visual taste, balance, and major design changes

Autonomy exists to shorten the loop:

> **Design → smallest implementation → play → improve**

It must not turn Crownless into an infrastructure project.

## Product boundary

The current product direction is **Location × Expedition RPG**.

Autonomous agents must preserve:

> **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**

Real-time player-controlled action combat is not current Canon.

## Initial autonomy level

The first Autopilot version processes **one explicitly eligible GitHub Issue at a time**.

The repository implementation is `scripts/autopilot/run-next.js`. Eligibility is the
`agent-ready` label on an open Issue; `agent-running` is the short-lived GitHub lock.
Use `npm run autopilot -- --dry-run` to inspect the next candidate without changing
GitHub or the filesystem. A live run uses an isolated worktree, invokes Codex with
[`docs/autopilot-execution-contract.md`](autopilot-execution-contract.md), runs the
required validation and structured self-review, then creates one PR. It never merges.

Target flow:

```text
eligible open Issue
  ↓
read AGENTS + relevant Canon
  ↓
inspect current implementation / related Issues / PRs
  ↓
create isolated branch + worktree
  ↓
implement smallest complete slice
  ↓
run focused tests
  ↓
run full required validation
  ↓
self-review diff against Issue + Canon
  ↓
fix discovered problems
  ↓
open PR with verification evidence
  ↓
stop for CI / human playtest as required
```

## Eligible work

Autopilot may start only from an Issue that is explicitly marked as agent-ready by the repository workflow.

Good candidates:

- clear bug fixes
- deterministic gameplay changes with acceptance criteria
- tests and regression fixes
- small UI changes whose desired behavior is already specified
- small refactors necessary to complete an approved Issue
- documentation synchronization with an already-made decision

## Human gate required

Do not autonomously merge or make a new product decision when work changes any of the following:

- gameplay Canon or core loop
- expedition balance / economy in a way that primarily requires taste judgment
- GPS/privacy/location-data boundaries
- save compatibility or irreversible player-state migration
- visual direction / new production asset approval
- major architecture or hosting strategy
- public deployment policy
- deletion of substantial legacy systems without an explicit cleanup Issue
- anything where the Issue intentionally asks for playtesting before acceptance

The agent may implement these tasks when explicitly assigned, but the PR must stop for human review/playtest.

## Validation contract

Before opening a PR, the agent must:

1. run the tests directly related to the change
2. run the repository-required broader test/build checks
3. inspect the final diff for accidental scope expansion
4. verify Acceptance Criteria individually
5. confirm Canon documents were not contradicted
6. confirm no raw GPS coordinates, route history, credentials, or paid provider keys were introduced
7. for UI work, validate a phone-size viewport when the repository tooling supports it
8. report anything that could not be validated instead of guessing

A failing check is not permission to weaken or delete the check unless the Issue explicitly establishes that the check is obsolete.

## Work isolation

Every autonomous implementation uses its own branch/worktree or equivalent isolated checkout.

Do not let multiple agents share a mutable working directory. Cross-agent branch switching or overwriting another task's files is considered an execution failure.

## Scope discipline

Prefer the smallest implementation that satisfies the Issue.

Do not create generalized platforms, plugin frameworks, event engines, backend services, or AI orchestration layers merely because they might be useful later.

If completing the Issue reveals a separate useful improvement, record it as a follow-up rather than silently expanding scope.

## Merge policy

The initial Autopilot stops at PR creation.

Automatic merge is deferred until the workflow has demonstrated that it reliably:

- selects only eligible work
- respects Canon
- isolates work correctly
- keeps scope small
- produces trustworthy verification evidence
- does not mask CI failures

A later phase may allow auto-merge for a narrow low-risk class after those behaviors are proven.

## Failure behavior

Stop and surface the blocker rather than improvising when:

- Canon or authoritative documents conflict materially
- an Issue cannot be satisfied without a larger product decision
- required credentials or protected external systems are unavailable
- tests reveal unrelated repository breakage that cannot safely be separated
- another open PR already implements overlapping behavior
- the change would require weakening a safety/privacy boundary

## Success criterion

The first milestone is intentionally modest:

> **An agent can take one explicitly agent-ready Crownless Issue from untouched main to a reviewed, tested PR without manual coding intervention.**

Only after this works repeatedly should Crownless automate issue selection, continuous queues, auto-merge, or integration with Personal Orbit.
