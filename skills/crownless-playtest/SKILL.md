---
name: crownless-playtest
description: Evaluate a playable Crownless slice against one concrete gameplay hypothesis using real play evidence, then decide Keep, Change, Kill, or Playtest pending.
---

# Crownless Playtest

## Purpose

Use this Skill when a playable slice exists and the question is whether the experience works, not merely whether the implementation is correct.

The goal is to test one gameplay hypothesis cheaply and turn the result into the next smallest development action.

Passing tests, CI, static review, or browser automation can show that software works. They do not show that the game is fun.

## Context rule

Read only the context needed for the slice being tested:

- the current Crownless product brief or current project instruction,
- the target Issue / PR when one exists,
- subsystem documentation only when it is needed to understand the behavior under test.

Do not preload old ADRs, deprecated product loops, historical combat rules, or legacy architecture simply because they exist. Historical documents are evidence, not automatic Canon.

## Define one hypothesis

Before playing, state one sentence describing what the slice is supposed to make the player do, feel, decide, or want.

Examples:

- Discovering a place in the real world makes the player curious enough to investigate it in-game.
- Going deeper creates enough risk that returning safely becomes a meaningful decision.
- Loot changes the player's next build or expedition choice rather than acting as a cosmetic reward.
- After returning from one expedition, the player wants to start another.

Test the smallest end-to-end loop that can support or reject that statement.

## Keep evidence types separate

Do not mix these:

- **Implementation evidence:** the feature exists and required state transitions are implemented.
- **Automated validation:** tests, CI, deterministic checks, browser automation.
- **Observed play behavior:** what actually happened during play.
- **Player judgment:** confusion, tension, satisfaction, boredom, curiosity, or desire to continue.

Never invent player feelings from code or automated checks.

## First-pass rule

When practical, experience the slice as a player before reading implementation details.

Observe where the player hesitates, misunderstands, becomes curious, loses interest, or cannot continue. Do not rescue unclear mechanics by explaining them during the first pass.

If a bug blocks the intended loop, record the blocker and leave the gameplay verdict pending. Fixing the blocker becomes the next smallest action.

## Crownless questions

Use only the questions relevant to the slice.

- Did real-world movement or location create a meaningful discovery rather than a step-count reward?
- Was there a meaningful choice about where to go, what to attempt, how to prepare, or when to return?
- Did danger and uncertainty create tension without becoming arbitrary or tedious?
- Was combat or conflict understandable and satisfying for the chosen implementation?
- Did loot, equipment, companions, knowledge, or other rewards change a later decision?
- Did survival / safe return matter?
- Did the world feel more discovered, changed, or personally meaningful afterward?
- Most importantly: did the player want to continue exploring or start another expedition?

Do not require territory control, elapsed-time expeditions, real-time combat, a specific map model, or any other historical Crownless mechanic unless the current slice intentionally uses it.

## Verdict

After the intended loop was actually played, choose exactly one:

### Keep

The hypothesis substantially works. Remaining problems are supporting fixes or polish.

### Change

The idea has value, but one important causal link is weak or confusing. Identify the weakest link and propose one small change that makes the next playtest more informative.

### Kill

The hypothesis fails at the product level. Do not preserve a weak idea merely because implementation cost was high.

### Playtest pending

Use when the intended loop could not be reached or only automated validation exists.

## Output

Keep the result short enough to paste into an Issue or PR.

```text
Target: <issue / PR / build / commit>
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

Add screenshots, console errors, or reproduction steps only when they materially support the verdict or unblock the next test.

## Anti-patterns

- Do not call a feature fun because tests pass.
- Do not turn a focused playtest into exhaustive QA.
- Do not confuse polish with a failed gameplay hypothesis.
- Do not infer replayability from one successful run when variation matters.
- Do not rewrite project Canon from one playtest.
- Do not hide a Kill behind vague wording such as “needs polish.”

The purpose of this Skill is to make it cheap to discover what Crownless should keep, change, or abandon before the game grows around the wrong idea.
