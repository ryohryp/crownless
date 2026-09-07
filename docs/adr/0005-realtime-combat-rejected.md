# ADR 0005 — Real-time player-controlled combat is rejected

- **Status:** Accepted / current product guardrail
- **Date:** 2026-09-08
- **Related:** #551, #552, #553
- **Builds on:** ADR 0004

## Context

Crownless had already moved away from real-time action combat in earlier Canon, but Reboot Phase 9 temporarily reintroduced a small player-controlled combat prototype through PR #552.

The prototype connected directional exploration encounters to a short combat scene with movement, attack, dodge, enemy HP, victory, retreat, and persistent encounter outcomes.

After direct human evaluation, the real-time combat itself was judged **not fun enough to justify keeping** and was explicitly rejected on 2026-09-08.

This is not a temporary feature flag decision and not a request to isolate the prototype for later polishing. The experiment has served its purpose.

## Decision

Crownless will not use real-time player-controlled combat as part of the current product direction.

Remove the Phase 9 real-time combat runtime, presentation, persistence wiring, and dedicated tests from the active product.

Combat or hostile encounters may still exist in the fiction and game state, but they are resolved as part of preparation, expedition, encounter, contest, consequence, injury, retreat, loot, knowledge, or world-state resolution rather than as a real-time action scene controlled by the player.

The intended emphasis is:

> **where to go, what to investigate, who to send, what to bring, what risk to accept, whether to press on or retreat, what was gained or lost, and how the world changed**

—not manual attack timing, dodge timing, enemy HP depletion, virtual joystick movement, or tap-spam action combat.

## Product consequence

When an encounter feels weak, do not default to adding real-time controls.

Prefer strengthening one or more of:

- geographic information and uncertainty
- companion fit and history
- equipment and regional usefulness
- approach / risk / retreat decisions
- injuries and survival consequences
- loot and knowledge worth bringing home
- persistent place / territory / consequence changes
- reasons to revisit or choose a different next place

Do not replace the rejected combat with another large battle minigame merely to fill the space it occupied.

## Runtime consequence

The merged Phase 9 combat experiment is removed from active runtime:

- no real-time combat entry point
- no attack / dodge / break input loop
- no real-time enemy HP loop
- no combat-specific CSS or active combat screen
- no Phase 9 combat persistence module

The preceding Reboot exploration and consequence-chain prototype remains valid independently of the rejected combat experiment.

## Autonomous-development guardrail

Autonomous planning must not propose real-time combat as a routine gameplay improvement under the current Canon.

The following require a new explicit human-approved Canon decision before implementation:

- real-time action combat
- virtual joystick combat
- tap / mash attack loops
- dodge-timing combat
- player-controlled enemy HP depletion as the encounter core
- a combat HUD whose primary purpose is moment-to-moment fighting

A future human decision may supersede this ADR, but experimentation alone or a merged prototype does not implicitly change Canon.

## Validation

Implementation of this decision is complete when:

- the Phase 9 combat script and CSS are absent from runtime
- `reboot.html` no longer loads them
- combat-specific persistence wiring is removed
- dedicated Phase 9 combat tests are removed or replaced with a regression test that guards against accidental runtime reintroduction
- the existing Reboot exploration / consequence flow remains wired

As with other gameplay changes, CI passing means only that the removal is implemented. It does not by itself establish that the remaining gameplay loop is fun.
