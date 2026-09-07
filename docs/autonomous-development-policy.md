# Crownless Autonomous Development Policy

> **Status:** active policy for Planner + Codex-assisted autonomous development  
> **Product Canon:** `AGENTS.md`, `docs/game-system-design.md`, `docs/adr/0004-territory-driven-reforge.md`

## Purpose

Crownless should delegate routine product development to coding agents without delegating the final judgment of whether the game is fun.

The intended split is:

- **Planner:** read Canon, current implementation, open work, and recent development history; form the next smallest product hypothesis; compare candidates; create at most one proposal
- **Executor:** take one explicitly eligible `agent-ready` Issue, implement the smallest complete slice, validate it, review it, and prepare a PR
- **Human game director / player:** judge play feel, product direction, visual taste, major balance/design changes, and the playtest result

Autonomy exists to shorten this loop:

> **Hypothesis → smallest playable vertical slice → play → Keep / Change / Kill → next hypothesis**

Implementation success and game-design success are intentionally separate. Passing Acceptance Criteria, tests, review, and CI makes a change **Implemented**. It does not prove that the change is fun.

This policy refines the Phase 2 Planner design in #228, the experiment log format in #367, and the human-approved Territory-driven Reforge in #503.

## Product boundary

The current product direction is **Location × Territory RPG**.

Autonomous work must preserve the canonical product loop:

> **Walk → Discover → Scout / Learn → Prepare → Contest / Expedition → Control → Exploit / Defend / Expand → Next place**

The current North Star is:

> **自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？**

Expeditions remain a principal way to act on places, but are no longer the product goal. The former expedition-result North Star may be used as a subsystem-quality question, not as the default selector for product innovation.

Real-time player-controlled action combat is not current Canon. Location gameplay must not collapse into step-count rewards. Territory must not collapse into a renamed XP bar or repeatable chore loop.

## #503 transition gate

Issue #503 is a human-approved Canon change.

Before ADR 0004 and the associated current-Canon documents are merged to `main`:

- do not use the normal Planner to generate unrelated gameplay features optimized for the old expedition-result North Star
- do not manufacture additional old-Canon location-specific binary choices, Report copy/content, or isolated expedition-result optimizations as product innovation
- work should be limited to #503 Canon changes, work directly required to make #503 executable, or a genuine P0/P1 / data-loss / startup / exploration / fatal CI/production blocker

After the Territory Canon is merged to `main`, normal Planner operation may resume using the new North Star and Gameplay Gate in this document.

The first gameplay target after Canon merge is the bounded three-place #503 Phase 1 vertical slice. Do not create a generalized territory engine first.

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

`scripts/autopilot/run-next.js` remains the implementation executor. It does not decide whether a gameplay idea is interesting and it does not convert CI success into a playtest judgment.

The Planner is responsible for deciding **what should become an Issue next**. Its output is validated by `scripts/autopilot/planner-proposal.js`, `planner-proposal.schema.json`, `gameplay-gate.js`, duplicate detection, and the existing risk policy.

## Planner cycle

Before choosing an existing task or proposing a new one, the Planner must review the most recent **3–5 development cycles** and record:

- whether those cycles added a player-visible new kind of play or meaningful territorial consequence
- whether the sequence has become maintenance-heavy
- whether it has become trapped in old-Canon micro-improvements such as another location binary choice, Report addition, or expedition-result polish with no map/control consequence
- the main evidence for that judgment

A P0 or clear player-facing bug may short-circuit ideation and be selected directly.

Otherwise the Planner should compare **exactly three candidates**, normally gameplay hypotheses. Each candidate must include the Gameplay Gate dimensions and a reason explaining why it should or should not be selected.

A qualifying gameplay innovation may outrank older backlog work when:

- it is not a duplicate of an existing Issue / PR / recently merged change
- no active execution blocks it
- it stays inside current Canon and risk boundaries
- it can be implemented as a small playable vertical slice
- it improves the player's ability or desire to discover, understand, contest, control, use, defend, or expand places

Backlog age, architecture cleanliness, or ease of implementation alone must not defeat a stronger playable improvement.

If all three gameplay candidates fail the hard gates, the Planner may choose a clear bug/friction item or return `no_action`.

## Gameplay Gate

Gameplay candidates are evaluated on eight dimensions. Scores are evidence for comparison, not an automatic weighted formula; the final choice must still be justified by `whyNow` and the hard gates below.

| Dimension | Question |
| --- | --- |
| **Player-visible** | Will the player clearly notice a world, map, option, or consequence change while playing? |
| **Decision** | What new judgment, trade-off, or choice appears? What will the player hesitate over? |
| **Risk / Reward** | When naturally applicable, does the player choose uncertainty/risk in exchange for a meaningful benefit? |
| **Core Loop** | Which part of Walk → Discover → Scout/Learn → Prepare → Contest/Expedition → Control → Exploit/Defend/Expand → Next place becomes richer or better connected? |
| **Replayability** | Does the change create different target priorities, approaches, builds, routes, outcomes, or future decisions? |
| **Fantasy** | Does it strengthen the medieval discovery / expedition / territorial-expansion fantasy? |
| **Geography** | If location-related, what exists because the player physically went there, and how can that place matter later? |
| **Canon** | Is the proposal consistent with ADR 0004, current canonical documents, #503 scope, and explicit decisions? |

### Hard gates

For a proposal classified as **gameplay innovation**:

- **Decision = 0 → reject** as innovation
- **Core Loop = 0 → reject** as innovation
- location-related gameplay with no meaningful Geography contribution → reject as location innovation
- a candidate whose only novelty is text, another isolated binary interaction, or an expedition-result improvement with no meaningful territorial/next-decision consequence → reject as current product innovation
- `playtestRequired` must be true; gameplay cannot be declared validated by CI alone

A clear bug, P0, or necessary player-friction fix may still be selected without satisfying the innovation hard gates. It must be classified honestly as bug/friction rather than disguised as innovation.

The key questions for Decision are:

> **What will the player now hesitate over?**
>
> **After the outcome, what becomes different about the next place or next plan?**

If the answers are effectively “nothing,” the change is not a gameplay innovation even if it adds UI, content, code, tests, or data.

## Interesting Decision and MDA

Every selected gameplay hypothesis must record an **Interesting Decision** plus a lightweight MDA explanation:

- **Mechanic:** the concrete rule or affordance introduced
- **Dynamic:** the behavior or trade-off that emerges when the player interacts with it
- **Desired Experience:** the feeling or kind of judgment the change is intended to create

For Territory-driven work, the Desired Experience should normally connect to agency over the map: curiosity about a place, uncertainty before committing, satisfaction from visible control, or desire for the next target.

MDA is a design aid, not a mandate to redesign the whole game or to force every feature into a universal theory.

## Smallest playable vertical slice

A gameplay proposal must be playable end-to-end at least once in the same slice. The Planner proposal records this causal chain explicitly:

> **Discovery / information → Decision → Preparation / action → Result / danger → Persistent world/control change or meaningful failure → Changed next decision**

For #503 Phase 1, the preferred proof is:

```text
Discover one of three authored places
  ↓
see NPC control + value + uncertainty in Atlas
  ↓
scout or deliberately accept incomplete information
  ↓
choose companion / equipment / approach
  ↓
resolve contest through existing deterministic expedition machinery where practical
  ↓
success: NPC → player control / failure or retreat: no capture
  ↓
reload-safe, idempotent state
  ↓
Atlas changes visibly
  ↓
one other place now has a changed approach / risk / duration / resource / information condition
  ↓
player can naturally choose the next target
```

The slice may reuse existing UI, deterministic resolution, placeholder text, or authored data. It must not grow into a generalized territory engine merely to make the architecture elegant.

## Territory anti-grind principle

Territory progression must come mainly from judgment and preparation.

Prefer decisions such as:

- scout first vs attack with incomplete information
- take a safer foothold vs a more valuable but harder place
- send a local/geographically suited companion vs preserve them for another target
- choose a route or approach made possible by controlled territory
- use equipment that opens an authored solution rather than merely adding power
- take a crossing/road/resource location because it changes a later target

Do **not** use as the main control loop:

- a control XP/progress bar
- killing N disposable enemies to fill control
- daily / stamina / energy chores
- meaningless repetition of the same solved contest
- tiny invisible percentage bonuses as the primary reward for owning a place

Do not manufacture a three-choice menu everywhere, and do not treat extra RNG by itself as meaningful risk/reward.

## Loot, companions, traits, and builds

Equipment, companions, and traits should change **decisions, available options, routes, approaches, objectives, information, or consequences**, not only numeric power.

A loot/build proposal that only increments stats should not outrank one that changes what the player can scout, attempt, avoid, contest, control, or unlock next.

Geographic traits/items are especially useful when they create different good preparations across places without forcing disposable replacement of prior progress.

## Geography principle

Location is not a pedometer reward system.

When a candidate is location-related, its Geography rationale must explain what discovery, knowledge, target, route, strategic role, local advantage, persistent control state, or future possibility exists **because the player went there**.

Examples of useful geography include discovering a route, revealing a local contact, unlocking a contestable place, learning a place-specific hazard, creating persistent regional knowledge, or establishing a foothold that changes another place.

Merely granting currency for distance or steps is not sufficient.

Raw GPS coordinates and exact route history are outside game-facing territory state.

## Maintenance-bias and old-Canon-bias guard

The Planner must not repeatedly select cycles consisting only of:

- copy/text corrections
- test additions with no player-facing behavior change
- tiny cosmetic UI adjustments
- refactor-only cleanup
- speculative architecture work
- another location-specific binary choice with no territory consequence
- another Report-only event/story addition with no changed game state or next decision
- another isolated expedition-result optimization merely intended to make returning to the Report more interesting

When the recent 3–5 cycle review is maintenance-heavy or old-Canon-microfeature-heavy, another proposal of the same class is blocked unless it is reclassified with evidence as a clear bug/friction issue or a higher-priority safety/reliability need.

This rule does not forbid maintenance or supporting expedition work. It prevents them from becoming the default product strategy.

## Planner proposal contract

A `create_issue` proposal must contain the existing implementation/risk fields plus:

- `proposalType`: `gameplay`, `bug`, `friction`, or `maintenance`
- `recentCycleReview`: 3–5 cycles, whether new play/territorial consequence was added, maintenance/old-Canon bias, and evidence summary
- `candidates`: 1 candidate for a clear bug, otherwise 3 compared candidates
- for every candidate: title, kind, location relevance, all Gameplay Gate dimensions with rationale, selection flag, and selection/rejection reason
- for selected gameplay: `gameplayHypothesis` with Interesting Decision, MDA, and the vertical-slice causal chain

Malformed or internally inconsistent proposals fail closed before duplicate/risk evaluation.

`no_action` remains valid when active/overlapping work, unresolved Canon, human gate, or another blocker means no mutation should occur.

## Duplicate and active-work guard

Before creating an Issue, the Planner must inspect:

- open Issues
- open PRs
- recent closed Issues
- recent merged PRs
- current code for older Epics whose open state may not reflect implementation

Do not create a new Issue for the same behavior, a contained subset, work already implemented, `future` work intentionally deferred, `decision-log` records, or `playtest-pending` work waiting on human Keep / Change / Kill.

One Planner run creates at most one Issue.

## Eligibility and human gate

Low-risk, reversible work inside current Canon may be marked `agent-ready` after proposal, Gameplay Gate, duplicate, and risk checks pass.

Human gating remains required for product decisions such as:

- changing gameplay Canon or the core loop itself
- major balance/economy changes requiring taste judgment
- GPS/privacy/location-data boundaries
- save compatibility or large/irreversible player-state migration
- visual direction / production asset approval
- major architecture/backend/hosting strategy
- public deployment policy
- security / credential / auth / IAM boundaries
- substantial legacy deletion without explicit approval
- monetization
- ambiguous major game-design decisions with multiple plausible directions

#503 is already human-approved as a Canon direction, but the Canon/core-loop PR itself remains human-merge gated. Do not auto-merge it.

`playtestRequired=true` is **not by itself a pre-implementation blocker**. A low-risk gameplay vertical slice may be implemented autonomously after current Canon is on `main`, but it remains **Playtest pending** after implementation. If a design decision is required *before* implementation, set `humanGate=true`.

## Playtest truth states

For gameplay work, use these distinct statuses in the decision log:

1. **Implemented** — Acceptance Criteria and implementation validation are satisfied; CI status is recorded separately
2. **Playtest pending** — the slice exists but has not yet received a human fun/feel judgment
3. **Keep** — playtest supports keeping the hypothesis substantially as implemented
4. **Change** — the hypothesis has value but needs revision; record what should change
5. **Kill** — the hypothesis did not improve the game enough; removal/reversal is valid learning

For #503 Phase 1:

- **Keep:** one captured place makes the player look at the map and want another
- **Change:** territory/control is promising but contest, place value, or decisions are weak
- **Kill:** capturing places does not create desire for the next one, becomes checklist play, or converges on grinding

`Kill` is not an Autopilot failure.

Never write `Keep`, `Change`, or `Kill` from tests or static code review alone.

When gameplay reaches **Playtest pending** and a human playtest, play-feel evaluation, or Keep / Change / Kill decision is performed, read `skills/crownless-playtest/SKILL.md` and use its evidence separation, verdict, and next-smallest-action workflow. The Skill executes this policy; it does not replace or redefine Canon.

## Decision log alignment (#367)

Each autonomous cycle recorded in #367 should include, at minimum:

- cycle timestamp / trigger / main SHA when available
- current #503 stage: Canon ADR / Canon PR / Territory slice / Playtest pending / later stage
- review of the most recent relevant cycles and current repository state
- candidate list and Gameplay Gate dimensions/reasons when normal Planner ideation is active
- selected work and `whyNow`
- rejected-candidate reasons when applicable
- selected gameplay hypothesis's Interesting Decision and MDA when applicable
- smallest playable vertical slice causal chain when applicable
- classification: bug / friction / maintenance / gameplay innovation / Canon work
- implementation evidence: Issue, PR/commit, focused/full tests, CI
- local validation versus GitHub Actions fallback
- merge/close result
- **Implemented** status separately from gameplay validation
- gameplay status: **Playtest pending / Keep / Change / Kill** where applicable
- confirmed human intervention since the previous cycle, or `なし / 確認できず`
- Outcome and next observation/human gate

Do not rewrite history to make a cycle look successful. `no_action`, failed proposals, rejected hypotheses, reversions, executor failures, and human corrections are useful experiment data.

## Executor flow

Autopilot may execute only an Issue explicitly marked `agent-ready` by the repository workflow or by confirmed human approval consistent with current policy. `agent-running` remains the short-lived GitHub lock.

Use `npm run autopilot -- --dry-run` to inspect the next executable Issue without changing GitHub or the filesystem. A live run uses an isolated worktree, invokes Codex with [`docs/autopilot-execution-contract.md`](autopilot-execution-contract.md), runs at least one Issue-relevant focused test supplied with `--focused-test test/path.test.js`, required validation and structured self-review, then creates one PR. It never turns CI success into fun validation.

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
6. confirm no raw GPS coordinates, exact route history, credentials, or paid provider keys were introduced
7. for UI work, validate a phone-size viewport when repository tooling supports it
8. for territory state changes, validate success capture, failure/retreat non-capture, reload/Report idempotency, and the intended captured-place effect
9. report anything that could not be validated instead of guessing

A failing check is not permission to weaken/delete the check unless the Issue explicitly establishes that the check is obsolete.

For documentation-only Canon work created through GitHub fallback because a local checkout is unavailable, record that local validation was not run and use current-head GitHub Actions as the validation substitute. Canon/core-loop PRs still stop at PR+CI for human merge judgment.

## Work isolation and scope discipline

Every autonomous implementation uses its own branch/worktree or equivalent isolated checkout. Multiple agents must not share a mutable working directory.

Prefer the smallest implementation that satisfies the Issue. Do not create generalized territory platforms, plugin frameworks, event engines, backend services, or AI orchestration layers merely because they might be useful later.

For #503 Phase 1, three authored places are a feature, not technical debt. Generalize only after playtesting proves repeated content needs a shared abstraction.

If completing the Issue reveals a separate useful improvement, record it rather than silently expanding scope.

## Merge policy

Follow `docs/adr/0003-autopilot-conditional-auto-merge.md` for any class that may be auto-merged.

Never auto-merge:

- Canon/core-loop changes
- large balance/economy changes
- GPS/privacy changes
- save migrations that cross the human gate
- security/auth/IAM changes
- major architecture/backend/hosting changes
- substantial legacy deletion
- monetization
- production visual asset approval
- `human-gate` / `agent-proposed` work

Gameplay proposals requiring human playtest must never be treated as game-design-successful merely because CI is green. A low-risk slice may be eligible for merge under the separate merge ADR, but merge only moves it to **Implemented / Playtest pending**.

## Failure behavior

Stop and surface the blocker rather than improvising when:

- Canon or authoritative documents conflict materially
- #503 Canon is not yet on `main` and the proposed work is unrelated old-Canon gameplay innovation
- a proposal cannot clear the Gameplay Gate and is not a legitimate bug/friction exception
- an Issue cannot be satisfied without a larger product decision
- required credentials or protected external systems are unavailable
- tests reveal unrelated repository breakage that cannot safely be separated
- another open Issue/PR already implements overlapping behavior
- the change would weaken a safety/privacy boundary
- Phase 1 would require a large save migration, new backend, exact GPS-history persistence, or other explicitly deferred scope

## Success criterion

The Autopilot succeeds when it shortens the real product-learning loop, not when it maximizes Issues or commits:

> **The Planner forms a small, evidence-backed gameplay hypothesis; the executor implements one playable vertical slice; a human can then play it and record Keep / Change / Kill; the next cycle learns from that outcome.**

For the current Reforge, a healthy autonomous cycle should make it easier to answer:

> **自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？**

Repository cleanliness, Report volume, or expedition polish alone are not substitutes for that product learning.
