---
name: crownless-playtest
description: Evaluate whether a playable Crownless slice is fun enough to keep, change, or drop.
---

# Crownless Playtest

Use this Skill when judging a playable Crownless slice.

Prioritize these current fun anchors:

- equipment visibly changes the character,
- combat rewards strategy and meaningful choices,
- exploration makes the world feel larger,
- stronger equipment creates motivation to explore again.

The loop to protect is:

**Explore → Fight → Loot → Equip/Improve → Reach farther → Explore again**

Play the game, observe what actually happened, identify the weakest link, make the smallest useful change, and play again.

Never infer fun from tests, code, or automation alone.

## Run-First Principle (No Speculative Pre-Audit)

When asked to testplay, verify an expedition flow, or evaluate gameplay balance:

- **Do NOT perform speculative code audits first**: Avoid diving into damage calculations, reviewing unrelated test files, or running the entire unit test suite (`npm test`) before launching the game.
- **Run immediately**: Launch the automated screening (`npm run playtest`) or browser runner (`npm run playtest:browser`) right away.
- **Inspect actual behavior**: Use the resulting trace, UI states, logs, and metrics to guide inspection. Inspect only the context needed to understand what just happened.

## Fast Jev Playtest Screening

Before spending 15 minutes in browser/phone playtest, run the automated Jev playtest harness to screen for obvious balance collapses, mindless combat, or progression dead ends:

```bash
npm run playtest
# or with specific options:
npm run playtest -- --runs=2 --place=wood --verbose
```

The harness runs simulated expeditions across 4 player archetypes (`tactician`, `cautious`, `greedy`, `rusher`) and evaluates core loop quality via TypeSafe Jev System One in seconds:

- **Tactical Depth** (Score 1-5): Did choices require intent adaptation or allow button-mashing?
- **Risk-Reward Tension** (Score 1-5): Did unreturned loot and low HP create genuine push-your-luck drama?
- **One-More-Run Motivation** (Score 1-5): Did gear/scrap rewards motivate another expedition?
- **Pacing Drag Risk** (Noul 0-1): Did the run drag out or feel repetitive?
- **Loop Status & Warnings** (Choice): Flags issues like `MINDLESS_COMBAT_SURVIVED`, `TACTICIAN_EARLY_WIPEOUT`, or `UNREWARDING_LOOT`.

Use Jev screening to rapidly tune parameters across 20 iterations. Then perform the human playtest to judge real tactile feel and overall fun.

## Fast Jev browser smoke playtest

Use the browser runner when the question is whether a real DOM flow is reachable quickly, not whether the game is fun:

```bash
TYPESAFE_API_KEY=... npm run playtest:browser
```

The runner starts the playable slice on an ephemeral loopback port and invokes `@jkudish/jev-browser@0.7.0` (configurable via `CROWNLESS_JEV_PACKAGE`) with a small action budget. It disables model-generated typing because this flow only needs clicks.

Optional overrides:

```bash
CROWNLESS_JEV_TASK="..." CROWNLESS_JEV_MAX_STEPS=30 CROWNLESS_JEV_MAX_SECONDS=90 npm run playtest:browser
```

### Jev-Browser Task Prompting Guidelines

`@jkudish/jev-browser` executes autonomously at high speed (~500ms per step). To prevent the agent from getting stuck or misrouting:

1. **Explicit action sequencing**:
   Specify sequential order when multiple candidate buttons coexist. For example, on the Gear screen where both a secondary action ("鉄片 4 で補強する") and a primary action ("この装備で囁きの森へもう一度") exist, explicitly instruct: "補強ボタンを押して通知を確認した後に、再遠征ボタンを押す".
2. **Resource and disabled-button constraints**:
   Heavy attacks cost 2 stamina. When stamina drops below 2, the heavy attack button is disabled. If an agent tries to click a disabled button, Playwright times out and triggers stuck detection. Instruct the agent: "強撃は気力がある時のみ使い、気力不足時は『斬る』で気力を溜めて戦う" or "最初の戦闘は『斬る』で確実に倒す".
3. **Prevent accidental retreat / fallback**:
   If identical button clicks register as "no visible change" within the fast polling window, Jev's recovery heuristic may select fallback buttons like "撤退". Explicitly specify: "戦闘中は『撤退』を押さない".
4. **Budget steps for full loops**:
   For complex multi-screen flows (expedition → safe return → reinforce at camp → re-expedition), set `CROWNLESS_JEV_MAX_STEPS=30` and `CROWNLESS_JEV_MAX_SECONDS=90~120` to avoid premature step-cap cutoff.

This is a reachability/speed smoke test. Treat the returned step trace, browser errors, and elapsed time as evidence, then still use a 360–430 CSS px browser/phone playtest for tactile UI and fun. Do not use automation alone to claim the 15-minute goal is met.
