# ADR 0004 — Crownless adopts a Territory-driven Reforge

- **Status:** Accepted / current product direction
- **Date:** 2026-09-06
- **Related:** #503
- **Supersedes in product direction:** ADR 0002 where it declares expeditions themselves to be the gameplay center, the expedition-result North Star, and territory/factions to be deferred until after that loop is proven

## Context

Crownless pivoted away from real-time action combat in ADR 0002 and successfully established useful foundations around real-world discovery, deterministic expeditions, companions, equipment, consequences, reports, persistent world knowledge, and the Grey Hearth.

Playtesting then showed a more fundamental product problem: improving the `Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt` loop in small increments did not create a strong enough reason to keep playing. The game accumulated useful decisions and content, but those decisions did not consistently produce a visible sense that the player had changed the world.

Issue #503 is a human-approved Canon change intended to test a stronger long-term purpose without discarding the useful systems already built.

## Decision

Crownless is now a **location-discovery territory-expansion RPG**.

The player walks through reality to discover Crownless places, learns enough about them to make an informed or intentionally risky attempt, prepares companions/equipment/approach, contests NPC-held locations, and changes persistent control of the world. A captured location must affect what the player can sensibly do next.

The canonical product loop is:

```text
Walk
  ↓
Discover
  ↓
Scout / Learn
  ↓
Prepare
  ↓
Contest / Expedition
  ↓
Control
  ↓
Exploit / Defend / Expand
  ↓
Next place
```

In Japanese:

> **歩く → 発見する → 偵察する → 攻略を準備する → 地点を争う → 支配する → 利用する／守る／広げる → 次の地点へ**

The current North Star is:

> **自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？**

Supporting questions include:

- Does the player hesitate over which place to take next?
- Does taking one place make another place meaningfully easier, riskier, faster, better understood, or differently approachable?
- Does the player want a particular companion, equipment item, scouting result, route, or approach because it helps take a place?
- Does the Atlas visibly remember what the player changed?
- Immediately after gaining control, is another meaningful target naturally visible?

## Expeditions are repurposed, not removed

Expeditions remain a major Crownless system and the existing deterministic resolver should be reused wherever practical.

Their product role changes:

> **An expedition is a principal means of acting on a place; completing expeditions is no longer the game's ultimate purpose.**

Preparation, companions, equipment, objectives, policy, injury, retreat, failure, reports, elapsed-time resolution, and causal event data remain useful when they serve scouting, contesting, securing, exploiting, defending, or expanding territory.

Where older subsystem documents call expeditions “the gameplay center” or optimize primarily for reopening the game to read an expedition result, that product-level wording is superseded by this ADR. Their detailed deterministic resolver and safety contracts remain valid unless they directly conflict with this decision.

## Territory MVP contract

Phase 1 is deliberately authored and small. It is not a generic territory engine.

Use three representative discovered places. At minimum the player must be able to observe:

- game-facing place identity and knowledge
- `controlled_by_npc` versus `controlled_by_player`
- a strategic role/value for each place
- unknown information that scouting can reveal
- a control effect that changes a later decision

A first conquest must include a meaningful decision such as scouting before contesting versus attacking with incomplete information, plus at least one consequence from companion, equipment, or approach choice.

On success, control changes persistently from NPC to player. Failure or retreat does not grant control. Reloading or reapplying a Report must not duplicate the control transition or its effects.

The Atlas is the primary reward surface for this hypothesis. A control change must be visibly legible and must expose the next useful decision rather than merely showing a badge.

## Anti-grind decision

Territory is not a renamed XP system.

Do not introduce as the main territory loop:

- a control XP/progress bar advanced by repetitive actions
- capture based only on defeating N disposable enemies
- stamina, energy, dailies, or repeatable chores
- requirements to repeat the same solved contest an arbitrary number of times
- tiny invisible percentage bonuses as the primary reward for control

Progress should come mainly from **information, preparation, route/approach choice, companion/equipment fit, and the strategic consequences of already-controlled places**.

## Scope boundary for the first slice

Phase 1 does **not** add:

- PvP or player-owned territory competition
- clan/guild war
- seasons or rankings
- always-on faction simulation
- a new backend or mandatory cloud account
- large economy simulation
- a generic territory scripting engine
- a large save migration
- raw GPS or exact route-history persistence
- real-time player-controlled combat

If proving the slice requires a large save migration, security/auth change, GPS/privacy change, major backend/hosting architecture, or another irreversible product decision, stop at a human gate.

## Keep / Repurpose

The following are expected to remain useful and should not be deleted wholesale:

- World Atlas
- location discovery and stable discovery identity
- simulated location
- Grey Hearth
- companions and traits
- equipment and geographic loot
- deterministic expedition resolver
- injury / retreat / failure
- Report and causal event data
- persistent world knowledge
- current location/privacy boundary
- the living medieval manuscript / woodcut Visual Canon

The conceptual shift is:

> Before: gather places, companions, and equipment to succeed at expeditions.
>
> After: use discovery, companions, equipment, scouting, and expeditions to change the world and take the next place.

## Exploration and privacy remain foundational

Real-world movement remains a discovery input, not a step-count reward or energy refill.

Continue to use coarse game-facing geography and stable place identity. Do not persist raw latitude/longitude, exact route history, or exact movement tracks as territory state. Simulated location must remain sufficient for deterministic development and tests.

## Visual direction remains unchanged

Territory does not turn Crownless into a generic modern strategy map. The World Atlas remains a living medieval manuscript / woodcut world. Control, uncertainty, strategic value, and next targets must be expressed within the existing Visual Canon.

## Autonomous-development consequence

Until this ADR and the associated current-Canon updates are merged to `main`, autonomous development must not create unrelated gameplay features optimized for the superseded expedition-result North Star.

After merge, Planner evaluation uses the new North Star. A gameplay candidate should add a player-visible world change or a meaningful decision that helps discover, scout, contest, control, exploit/defend, or expand territory.

In particular, do not repeatedly manufacture “innovation” from:

- another location-specific binary choice with no territory consequence
- Report wording/content alone
- another isolated optimization whose only purpose is making the expedition result more interesting

Those may still be valid supporting changes when needed by a Territory-driven vertical slice, but they are not the default product strategy.

## Consequences for older decisions

ADR 0002 remains an important historical decision and still governs several compatible boundaries:

- real-time action combat is not a current core pillar
- discovery is driven by real-world movement rather than step rewards
- deterministic/local expedition resolution is preferred over unnecessary always-on infrastructure
- companions, equipment, consequences, world knowledge, and safe stationary preparation remain valuable

The following ADR 0002 product claims are superseded:

- `Location × Expedition RPG` as the complete current product identity
- expeditions as the gameplay center / primary purpose
- `Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt` as the product-level canonical loop
- “After dispatching an expedition, does the player want to reopen the game to see what happened?” as the primary North Star
- territory/faction control being deferred until after the expedition loop is proven fun

## Validation and merge gate

The Canon change itself is human-approved by #503, but Canon/core-loop PRs remain human-merge gated.

A Canon PR may be prepared, validated, and left CI-green, but must **not** be auto-merged. Only after this Canon is merged to `main` may autonomous work proceed to the three-place Territory Phase 1 slice.

The gameplay slice, once implemented and merged, is still only:

> **Implemented / Playtest pending**

CI cannot produce a Keep / Change / Kill judgment. Human playtest decides:

- **Keep:** taking one place makes the player want to take another
- **Change:** control is promising but contest/value/decisions are weak
- **Kill:** territory becomes a checklist, grind, or fails to create desire for the next place
