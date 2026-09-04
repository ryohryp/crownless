# Crownless Autonomous Development Policy

> **Status:** active policy for Planner + Codex-assisted autonomous development  
> **Product Canon:** `AGENTS.md`, `docs/game-system-design.md`, `docs/adr/0002-idle-expedition-pivot.md`

## Purpose

Crownless should delegate routine product development to coding agents without delegating the final judgment of whether the game is fun.

The intended split is:

- **Planner:** read Canon, current implementation, open work, and recent development history; form the next smallest product hypothesis; compare candidates; create at most one proposal
- **Executor:** take one explicitly eligible `agent-ready` Issue, implement the smallest complete slice, validate it, review it, and prepare a PR
- **Human game director / player:** judge play feel, product direction, visual taste, major balance/design changes, and the playtest result

Autonomy exists to shorten this loop:

> **Hypothesis → smallest playable vertical slice → play → Keep / Change / Kill → next hypothesis**

Implementation success and game-design success are intentionally separate. Passing Acceptance Criteria, tests, review, and CI makes a change **Implemented**. It does not prove that the change is fun.

This policy refines the Phase 2 Planner design in #228 and the experiment log format in #367.

## Product boundary

The current product direction is **Location × Expedition RPG**.

Autonomous work must preserve the canonical core loop:

> **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**

Real-time player-controlled action combat is not current Canon. Location gameplay must not collapse into step-count rewards.

## Planner and executor boundary

The Gameplay Gate belongs to the **Planner / proposal** side. Do not inflate `scripts/autopilot/select-issue.js` or the executor into a game-design engine.

The executor remains deliberately simple:

1. select one open `agent-ready` Issue according to the existing repository rule
2. create an isolated worktree
3. implement the Issue's smallest complete slice
4. run focused and repository-required validation
5. perform structured review
6. create one PR
7. stop

`scripts/autopilot/run-next.js` remains the implementation executor. It does not decide whether a gameplay idea is interesting and it does not auto-merge.

The Planner is responsible for deciding **what should become an Issue next**. Its output is validated by `scripts/autopilot/planner-proposal.js`, `planner-proposal.schema.json`, `gameplay-gate.js`, duplicate detection, and the existing risk policy.

## Planner cycle

Before choosing an existing task or proposing a new one, the Planner must review the most recent **3–5 development cycles** and record:

- whether those cycles added a player-visible new kind of play
- whether the sequence has become maintenance-heavy
- the main evidence for that judgment

A P0 or clear player-facing bug may short-circuit ideation and be selected directly.

Otherwise the Planner should compare **exactly three candidates**, normally gameplay hypotheses. Each candidate must include the Gameplay Gate dimensions and a reason explaining why it should or should not be selected.

A qualifying gameplay innovation may outrank older backlog work when:

- it is not a duplicate of an existing Issue / PR / recently merged change
- no active execution blocks it
- it stays inside current Canon and risk boundaries
- it can be implemented as a small playable vertical slice

Backlog age, architecture cleanliness, or ease of implementation alone must not defeat a stronger playable improvement.

If all three gameplay candidates fail the hard gates, the Planner may choose a clear bug/friction item or return `no_action`.

## Gameplay Gate

Gameplay candidates are evaluated on eight dimensions. Scores are evidence for comparison, not an automatic weighted formula; the final choice must still be justified by `whyNow` and the hard gates below.

| Dimension | Question |
| --- | --- |
| **Player-visible** | Will the player clearly notice a change while playing? |
| **Decision** | What new judgment, trade-off, or choice appears? |
| **Risk / Reward** | When naturally applicable, does the player choose a risk in exchange for a possible benefit? |
| **Core Loop** | Which part of Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt becomes richer or better connected? |
| **Replayability** | Does the change create different outcomes, routes, builds, or future decisions across plays? |
| **Fantasy** | Does it strengthen the medieval expedition / survival / discovery fantasy? |
| **Geography** | If location-related, what exists because the player physically went there? |
| **Canon** | Is the proposal consistent with current canonical documents and explicit decisions? |

### Hard gates

For a proposal classified as **gameplay innovation**:

- **Decision = 0 → reject** as innovation
- **Core Loop = 0 → reject** as innovation
- location-related gameplay with no meaningful Geography contribution → reject as location innovation
- `playtestRequired` must be true; gameplay cannot be declared validated by CI alone

A clear bug, P0, or necessary player-friction fix may still be selected without satisfying the innovation hard gates. It must be classified honestly as bug/friction rather than disguised as innovation.

The key question for Decision is:

> **What will the player now hesitate over?**

If the answer is effectively “nothing,” the change is not a gameplay innovation even if it adds UI, content, code, tests, or data.

## Interesting Decision and MDA

Every selected gameplay hypothesis must record an **Interesting Decision** plus a lightweight MDA explanation:

- **Mechanic:** the concrete rule or affordance introduced
- **Dynamic:** the behavior or trade-off that emerges when the player interacts with it
- **Desired Experience:** the feeling or kind of judgment the change is intended to create

MDA is a design aid, not a mandate to redesign the whole game or to force every feature into a universal theory.

## Smallest playable vertical slice

A gameplay proposal must be playable end-to-end at least once in the same slice. The Planner proposal records this causal chain explicitly:

> **Discovery / information → Decision → Action → Result / danger → Reward or loss → Persistent change that affects the next decision**

The slice may reuse existing UI, deterministic resolution, placeholder text, or existing content. It should not grow into a generalized engine merely to make the architecture elegant.

## Risk / Reward principle

Risk/reward is useful when it creates a player-chosen trade-off. Prefer choices such as:

- safer route vs richer unknown route
- return now vs press farther while injured
- protect carried loot vs pursue a rare opportunity
- consume a scarce supply now vs save it for later

Do **not** manufacture a three-choice menu everywhere, and do not treat extra RNG by itself as meaningful risk/reward.

## Loot, companions, traits, and builds

Equipment, companions, and traits should change **decisions, available options, routes, objectives, or consequences**, not only numeric power.

A loot/build proposal that only increments stats should not outrank one that changes what the player can attempt, avoid, discover, or risk.

## Geography principle

Location is not a pedometer reward system.

When a candidate is location-related, its Geography rationale must explain what discovery, development, unlock, local advantage, persistent knowledge, or future expedition possibility exists **because the player went there**.

Examples of useful geography include discovering a route, revealing a local faction/contact, unlocking a destination, learning a place-specific hazard, or creating persistent regional knowledge. Merely granting currency for distance or steps is not sufficient.

## Maintenance-bias guard

The Planner must not repeatedly select cycles consisting only of:

- copy/text corrections
- test additions with no player-facing behavior change
- tiny cosmetic UI adjustments
- refactor-only cleanup
- speculative architecture work

When the recent 3–5 cycle review is maintenance-heavy, another maintenance-class proposal is blocked unless it is reclassified with evidence as a clear bug/friction issue or a higher-priority safety/reliability need.

This rule does not forbid maintenance. It prevents maintenance from becoming the default product strategy.

## Planner proposal contract

A `create_issue` proposal must contain the existing implementation/risk fields plus:

- `proposalType`: `gameplay`, `bug`, `friction`, or `maintenance`
- `recentCycleReview`: 3–5 cycles, whether new play was added, maintenance bias, and evidence summary
- `candidates`: 1 candidate for a clear bug, otherwise 3 compared candidates
- for every candidate: title, kind, location relevance, all Gameplay Gate dimensions with rationale, selection flag, and selection/rejection reason
- for selected gameplay: `gameplayHypothesis` with Interesting Decision, MDA, and the six-step vertical-slice chain

Malformed or internally inconsistent proposals fail closed before duplicate/risk evaluation.

`no_action` remains valid when active/overlapping work means no mutation should occur.

## Duplicate and active-work guard

Before creating an Issue, the Planner must continue to inspect:

- open Issues
- open PRs
- recent closed Issues
- recent merged PRs

Do not create a new Issue for the same behavior, a contained subset, or work already implemented. One Planner run creates at most one Issue.

## Eligibility and human gate

Low-risk, reversible work inside current Canon may be marked `agent-ready` after proposal, Gameplay Gate, duplicate, and risk checks pass.

Human gating remains required for product decisions such as:

- changing gameplay Canon or the core loop itself
- major balance/economy changes requiring taste judgment
- GPS/privacy/location-data boundaries
- save compatibility or irreversible player-state migration
- visual direction / production asset approval
- major architecture or hosting strategy
- public deployment policy
- security / credential boundaries
- substantial legacy deletion without explicit approval
- monetization
- ambiguous major game-design decisions with multiple plausible directions

`playtestRequired=true` is **not by itself a pre-implementation blocker**. A low-risk gameplay vertical slice may be implemented autonomously, but it remains **Playtest pending** after implementation. If a design decision is required *before* implementation, set `humanGate=true`.

## Playtest truth states

For gameplay work, use these distinct statuses in the decision log:

1. **Implemented** — Acceptance Criteria and implementation validation are satisfied; CI status is recorded separately
2. **Playtest pending** — the slice exists but has not yet received a human fun/feel judgment
3. **Keep** — playtest supports keeping the hypothesis substantially as implemented
4. **Change** — the hypothesis has value but needs revision; record what should change
5. **Kill** — the hypothesis did not improve the game enough; removal/reversal is valid learning

`Kill` is not an Autopilot failure. Shipping code that teaches us a hypothesis is weak can still be a useful development cycle.

Never write `Keep`, `Change`, or `Kill` from tests or static code review alone.

## Decision log alignment (#367)

Each autonomous cycle recorded in #367 should include, at minimum:

- cycle timestamp / trigger / main SHA when available
- review of the most recent 3–5 cycles: new play added? maintenance-heavy?
- candidate list and all Gameplay Gate dimensions/reasons
- selected candidate and `whyNow`
- rejected-candidate reasons
- selected gameplay hypothesis's Interesting Decision
- MDA: Mechanic / Dynamic / Desired Experience
- smallest playable vertical slice causal chain
- classification: bug / friction / maintenance / gameplay innovation
- implementation evidence: Issue, PR/commit, focused/full tests, CI
- **Implemented** status separately from gameplay validation
- gameplay status: **Playtest pending / Keep / Change / Kill**
- confirmed human intervention since the previous cycle, or `なし / 確認できず`
- next observation or hypothesis

Do not rewrite history to make a cycle look successful. `no_action`, failed proposals, rejected hypotheses, reversions, and human corrections are useful experiment data.

## Executor flow

Autopilot may execute only an Issue explicitly marked `agent-ready` by the repository workflow. `agent-running` remains the short-lived GitHub lock.

Use `npm run autopilot -- --dry-run` to inspect the next executable Issue without changing GitHub or the filesystem. A live run uses an isolated worktree, invokes Codex with [`docs/autopilot-execution-contract.md`](autopilot-execution-contract.md), runs at least one Issue-relevant focused test supplied with `--focused-test test/path.test.js`, required validation and structured self-review, then creates one PR. It never merges.

```text
Planner hypothesis / bug / friction
  ↓
Gameplay Gate + duplicate + risk checks
  ↓
agent-ready Issue (or agent-proposed / no_action)
  ↓
executor: isolated worktree
  ↓
smallest complete implementation
  ↓
focused tests + full validation + review
  ↓
PR
  ↓
Implemented
  ↓
Playtest pending (for gameplay)
  ↓
Keep / Change / Kill
  ↓
next Planner cycle
```

## Validation contract

Before opening a PR, the executor must:

1. run tests directly related to the change
2. run repository-required broader test/build checks
3. inspect the final diff for accidental scope expansion
4. verify Acceptance Criteria individually
5. confirm Canon documents were not contradicted
6. confirm no raw GPS coordinates, route history, credentials, or paid provider keys were introduced
7. for UI work, validate a phone-size viewport when repository tooling supports it
8. report anything that could not be validated instead of guessing

A failing check is not permission to weaken/delete the check unless the Issue explicitly establishes that the check is obsolete.

## Work isolation and scope discipline

Every autonomous implementation uses its own branch/worktree or equivalent isolated checkout. Multiple agents must not share a mutable working directory.

Prefer the smallest implementation that satisfies the Issue. Do not create generalized platforms, plugin frameworks, event engines, backend services, or AI orchestration layers merely because they might be useful later.

If completing the Issue reveals a separate useful improvement, record it rather than silently expanding scope.

## Merge policy

The current executor stops at PR creation unless a separate, explicit repository policy later enables a narrow auto-merge class.

Gameplay proposals requiring human playtest must never be treated as game-design-successful merely because CI is green. No future auto-merge policy may silently turn **Playtest pending** into **Keep**.

## Failure behavior

Stop and surface the blocker rather than improvising when:

- Canon or authoritative documents conflict materially
- a proposal cannot clear the Gameplay Gate and is not a legitimate bug/friction exception
- an Issue cannot be satisfied without a larger product decision
- required credentials or protected external systems are unavailable
- tests reveal unrelated repository breakage that cannot safely be separated
- another open Issue/PR already implements overlapping behavior
- the change would weaken a safety/privacy boundary

## Success criterion

The Autopilot succeeds when it shortens the real product-learning loop, not when it maximizes Issues or commits:

> **The Planner forms a small, evidence-backed gameplay hypothesis; the executor implements one playable vertical slice; a human can then play it and record Keep / Change / Kill; the next cycle learns from that outcome.**

A healthy autonomous cycle should make it easier to answer whether the player wants to return for the expedition result — not merely leave the repository cleaner.
