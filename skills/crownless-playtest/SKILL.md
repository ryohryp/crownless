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
