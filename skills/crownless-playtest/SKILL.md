---
name: crownless-playtest
description: Run or structure human playtests for Crownless gameplay slices, separating implementation evidence from player judgment and producing a Keep / Change / Kill verdict with the next smallest action.
---

# Crownless Playtest

## Purpose

Use this Skill after a gameplay slice is implemented, or whenever the user asks to playtest, evaluate feel, or decide whether a gameplay hypothesis should be kept, changed, or killed.

The goal is not exhaustive QA. The goal is to test the **specific product hypothesis** that justified the slice and connect real player evidence to the next development decision.

For current Territory-driven work, the product-level question is defined by Canon, not by this Skill. Read the current Canon and evaluate the implemented slice against it. Do not turn observations from one playtest into new Canon inside this Skill.

Passing tests, review, browser checks, or CI means the implementation may be complete. It does **not** mean the game is fun.

## Authority and preflight

Before a gameplay playtest, read or confirm the current versions of:

1. [AGENTS.md](../../AGENTS.md)
2. [ADR 0004](../../docs/adr/0004-territory-driven-reforge.md) while it remains the current product decision
3. [game-system-design.md](../../docs/game-system-design.md)
4. the target Issue / PR and its Acceptance Criteria / gameplay hypothesis
5. [autonomous-development-policy.md](../../docs/autonomous-development-policy.md) for gameplay work using the Planner / Keep-Change-Kill process

Read subsystem specs only when needed to understand the tested behavior. Do not broaden a focused playtest into a full-system audit.

Confirm the target build, branch, PR, deployment, commit, or local state being tested when that information is available. If the user is testing a physical device, treat their firsthand description as the authoritative play observation for things you cannot directly observe.

## Separate four kinds of evidence

Keep these distinct in notes and conclusions:

- **Implementation evidence:** code exists, Acceptance Criteria are implemented, state/persistence contracts are present.
- **Automated validation:** unit/integration/browser tests, CI, deterministic checks.
- **Observed play behavior:** what actually happened during the play session, including screenshots or viewport evidence where useful.
- **Player judgment:** confusion, tension, curiosity, satisfaction, boredom, desire to continue, or lack of it.

Never infer a player feeling from source code or CI. Never claim a human playtest happened if only automated checks were performed.

## Define the hypothesis before playing

Write one short sentence describing what this slice is supposed to make the player do, notice, decide, or want.

Prefer a causal statement, for example:

> Taking one place visibly changes another target enough that the player wants to choose where to expand next.

Then identify the smallest end-to-end loop that can prove or disprove that statement. Ignore unrelated polish unless it prevents the loop from being evaluated.

## First-pass play rule

When practical, perform the first pass as a player rather than as an implementer:

- do not inspect source code during the first pass unless the game is blocked,
- do not pre-explain every mechanic to the player,
- let labels, state changes, consequences, and affordances explain themselves,
- note hesitation, misreads, and dead ends before correcting them,
- continue far enough to observe the intended consequence and the next decision.

If a blocker prevents reaching the hypothesis, record the blocker and stop pretending the product hypothesis was tested. Fixing the blocker is the next smallest action; the gameplay verdict remains pending.

## Territory-driven observation checklist

For a Territory slice, observe the following only where the tested slice implements them.

### Target and value

- Did the player notice more than one meaningful place or path forward?
- Did the player hesitate over **which place to take next**, or was one option mechanically obvious / others irrelevant?
- Could the player understand why a place mattered before committing?

### Scouting and uncertainty

- Was there a real reason to scout first versus act with incomplete information?
- Could the player tell what was known, unknown, and newly revealed?
- Did scouting change preparation, approach, target priority, or confidence rather than acting like hidden progress toward capture?

### Preparation

- Was there a reason to choose a particular companion, equipment item, route, policy, or approach?
- Did the player understand the trade-off, or were choices effectively interchangeable?
- Did prior territory or geographic knowledge create a different useful option where intended?

### Contest and consequence

- Could the player understand why success, failure, retreat, injury, delay, or another relevant outcome happened?
- Did success and failure produce clearly different world-state consequences?
- Did failure / retreat avoid falsely implying control?

### Control and Atlas reward

- Was NPC → player control immediately legible on the Atlas or equivalent reward surface?
- Did the controlled place feel like a changed part of the world rather than a badge, meter, or checklist item?
- Could the player see what strategic effect the captured place now provided?

### Next place

- Did taking the place change another target's risk, duration, route, information, resource, approach, or desirability where intended?
- Was that causal relationship understandable without reading debug-like detail?
- Immediately after capture, was another meaningful target naturally visible?
- Did the player actually want to take another place?

The final question matters most. A mechanically complete chain can still fail if the player has no desire to continue.

## Anti-grind and false-positive checks

Watch for cases where the slice technically satisfies Acceptance Criteria but drifts away from the intended experience:

- territory feels like renamed XP or completion percentage,
- the optimal choice is obvious every time,
- scouting is mandatory busywork instead of a judgment,
- equipment / companion choice changes only invisible numbers,
- capture is satisfying only because a checklist advances,
- the Atlas changes but the next decision does not,
- repeated solved actions are required without new information or trade-offs,
- the player reads a richer Report but has no stronger reason to act on the map.

Do not rescue a weak hypothesis by counting text, screens, animations, or test coverage as gameplay value.

## Record observations before interpretation

Capture concise evidence in this order:

### Observed

State only what happened.

Examples:

- selected Place A without opening scouting,
- ignored Place B because its value was not visible,
- after capture, Atlas marker changed but the neighboring place showed no obvious consequence,
- player reopened the same panel twice looking for the next action.

### Friction / bug

Record defects that obstructed or distorted the test. Separate severe blockers from small polish issues.

### Player judgment

Record the player's actual reaction. Preserve firsthand statements as firsthand evidence; do not rewrite them into stronger claims than the player made.

### Interpretation

Explain what the observation suggests about the tested hypothesis. Keep alternative explanations when evidence is ambiguous.

## Verdict

After the intended loop was actually played, choose exactly one product verdict:

### Keep

Use when the hypothesis works substantially as intended and the remaining issues are supporting fixes or polish.

For Territory-driven work, a strong Keep normally means visible control created a meaningful next decision and the player wanted to continue expanding.

### Change

Use when the core idea has value but one or more important links are weak, confusing, or low-impact.

Examples:

- control feels good but target value is unclear,
- scouting exists but does not change a decision,
- capture is legible but the next target consequence is too weak,
- preparation choices are present but effectively interchangeable.

Identify the weakest causal link and propose **one smallest change** that would make the next playtest more informative.

### Kill

Use when the hypothesis fails at the product level, including when the loop becomes checklist play, grind, obvious-choice repetition, or does not create desire for the next place.

Kill is valid learning. Do not preserve a weak idea merely because implementation cost was high or tests are green.

## Blocked / Playtest pending

If the intended loop could not be reached because of a blocker, do not force a Keep / Change / Kill verdict. Record:

- what blocked the playtest,
- the smallest fix needed to reach the hypothesis,
- status: **Playtest pending**.

Likewise, automated validation alone leaves gameplay at **Implemented / Playtest pending**.

## Output format

Keep the result short enough to use directly in an Issue or PR comment.

```text
Target: #<issue> / PR #<pr> / <build>
Hypothesis: <one sentence>

Observed:
- ...
- ...

Player judgment:
- ...

Verdict: Keep | Change | Kill | Playtest pending
Why: <one concise paragraph>
Next smallest action: <one concrete action>
```

Add screenshots, viewport notes, console errors, or reproducible steps only when they support the verdict or unblock the next action.

## Updating project records

When the user explicitly asks to record the result in GitHub, update the relevant Issue / PR with the playtest evidence rather than creating a second source of truth.

For autonomous-development history, align with [the policy](../../docs/autonomous-development-policy.md) and the existing decision log process. Preserve the distinction between:

- Implemented,
- Playtest pending,
- Keep,
- Change,
- Kill.

Do not mark an Issue or gameplay hypothesis Keep from CI, static review, or your own simulated reaction.

## Anti-patterns

- Do not perform exhaustive QA before answering the product hypothesis.
- Do not let one tiny UI defect dominate the verdict unless it blocks the loop.
- Do not call a feature fun because it works.
- Do not convert test pass counts into player evidence.
- Do not fabricate hesitation, excitement, boredom, or desire.
- Do not treat one successful run as proof of replayability when the question requires repeated variation.
- Do not rewrite Canon from a single playtest.
- Do not hide a Kill behind vague language such as “needs polish” when the player simply does not want to continue.

The purpose of the playtest loop is to make it cheap to discover that an idea should change or die before Crownless grows around it.
