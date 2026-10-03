# ADR 0007 — Crownless adopts a side-scrolling action core

- **Status:** Proposed / human-approved direction, merge required to become repository Canon
- **Date:** 2026-10-03
- **Supersedes in product direction:** ADR 0005 real-time combat rejection; ADR 0004 where territory/expedition resolution is the gameplay center
- **Preserves where compatible:** real-world discovery, medieval-fantasy identity, persistent progression, smartphone-first constraints, location safety, existing Visual Canon

## Context

Crownless has repeatedly changed its gameplay hypothesis in pursuit of one goal stated in `AGENTS.md`: make a small game that is fun to play again.

The territory/expedition direction produced useful systems and world state, but recent human evaluation found the playable experience too passive and visually/gameplay-wise weak. On 2026-10-03 the product direction was explicitly changed to rebuild the active play experience as a **side-scrolling action game**.

This decision intentionally revisits ADR 0005. ADR 0005 correctly recorded the result of the September real-time-combat experiment, but its prohibition is no longer a current guardrail. The new direction is not a request to restore that old prototype unchanged. It is a new experiment whose first question is whether the basic act of moving, jumping, landing, attacking, and traversing a stage can itself feel good.

Research on 2D platformers and player experience supports treating moment-to-moment control feel, level rhythm, challenge, frustration, and player behavior as separate design variables rather than assuming that more enemies or content will create fun.

## Decision

Crownless will use a **side-scrolling action gameplay core** for the current playable hypothesis.

The first playable loop is deliberately smaller than the surrounding RPG:

```text
Move
  ↓
Read terrain / threat
  ↓
Jump / evade / attack
  ↓
Land / hit / defeat
  ↓
Advance
  ↓
Reach a meaningful reward or destination
```

The first North Star is:

> **Does moving right, jumping through terrain, and defeating a small number of enemies feel good enough that the player wants to continue to the next screen?**

Until this is demonstrated, adding RPG breadth, more maps, more enemies, economy systems, territory systems, or procedural generation is lower priority than improving the core feel.

## Game Feel is the first implementation priority

Movement parameters are product design, not incidental physics constants.

The implementation must make the following explicit and easy to tune:

- horizontal acceleration
- horizontal deceleration / friction
- maximum run speed
- jump initial velocity
- gravity / fall acceleration
- air control
- jump cut / variable jump height where appropriate
- coyote time
- jump input buffering
- landing response
- attack startup / active / recovery timing
- hit stop where appropriate
- knockback
- camera follow and look-ahead

The first test scene should be intentionally small. It only needs enough terrain and one or a few threats to answer whether running, stopping, jumping, landing, and attacking feel responsive and satisfying.

Do not hide weak movement behind content volume.

## Level design uses rhythm, not obstacle accumulation

A stage is a sequence of tension and release, not a flat list of enemies and gaps.

Initial authored stages should deliberately use a rhythm similar to:

```text
safe
→ small challenge
→ recovery
→ medium challenge
→ reward / discovery
→ peak challenge
→ release / destination
```

Repeated identical enemy spacing, arbitrary pits, and constant-intensity obstacle chains are not sufficient level design.

The smallest useful authored stage is preferred over a procedural generator until the intended rhythm is understood through play.

## Combat scope

ADR 0005's blanket prohibition on real-time player-controlled combat is superseded.

Real-time attack, enemy HP, hit reactions, dodge/evasion, and combat HUD elements are allowed when they strengthen the side-scrolling action loop.

However, the rejected September prototype is not automatically restored and its architecture is not Canon. New combat should be built from the minimum mechanics required by the current action prototype.

Avoid combat complexity before basic movement works. Do not start with skill trees, large movesets, elemental systems, many enemy archetypes, combo economies, or boss architecture.

## Relationship to location and the Crownless identity

This ADR changes the **active gameplay core**, not necessarily the entire fiction or world model.

Real-world location may remain useful for discovering places, stages, routes, strongholds, or opportunities, but location mechanics must not interrupt moment-to-moment action play or require attention while walking.

A compatible high-level loop may become:

```text
Discover a place in the real world
→ unlock / enter its Crownless stage
→ play a side-scrolling action run
→ survive / defeat / discover
→ gain equipment, knowledge, or world change
→ choose the next place
```

This outer loop remains a hypothesis. The side-scrolling action core must first prove itself independently in a small test stage.

Territory control from ADR 0004 may later become a consequence or meta-layer of action-stage outcomes, but it is no longer the mandatory gameplay center.

## Smartphone-first controls

The game remains smartphone-first.

The action prototype must be validated at roughly 360–430 CSS px width and must account for:

- thumb reach
- touch target size
- safe areas and gesture regions
- simultaneous movement/action input
- avoiding excessive screen occlusion by controls
- landscape versus portrait choice based on actual play quality rather than legacy layout

A desktop keyboard implementation may exist for development, but desktop-only good feel does not validate the mobile experience.

## Telemetry and evaluation

Once the basic prototype is playable, collect only telemetry that can answer concrete design questions, such as:

- deaths and death position
- falls / missed jumps
- damage taken
- jump attempts and failed landings
- time spent stopped
- stage completion time
- enemy avoidance versus engagement
- retries / abandonment

Telemetry is evidence, not an automatic definition of fun.

Human playtest remains authoritative for Keep / Change / Kill judgments. Jev or other evaluators may summarize evidence, identify anomalies, or compare variants, but do not replace direct play evaluation.

## Deferred work

Until the first action slice feels good, defer:

- dynamic difficulty adjustment
- procedural level generation
- player-specific level generation
- large content pipelines
- large enemy rosters
- deep combat progression
- broad territory simulation
- multiplayer action combat
- generalized telemetry infrastructure

These may be revisited after the core has demonstrated value.

## Autonomous-development guardrail

Autonomous development should prioritize work in this order:

1. **Game Feel**
2. **Level rhythm**
3. **Combat readability and feedback**
4. **Stage variation**
5. **Minimal telemetry**
6. **Adaptive or generated content only if evidence justifies it**

When choosing between a visible improvement to the current playable stage and a new supporting system, prefer the visible playable improvement unless the system is required to unblock it.

Use the loop:

> **Design → smallest implementation → run → play/inspect → improve**

CI proves correctness constraints; it does not prove the action game feels good.

## Validation

The first milestone is complete only when a human can play a compact test stage and evaluate all of the following directly:

- starting and stopping feel responsive
- jump timing is learnable and forgiving enough for touch input
- landing is readable
- camera movement supports rather than fights traversal
- at least one enemy interaction is understandable and satisfying
- the stage contains perceptible tension/release rather than flat obstacle repetition
- the player can complete the loop on a phone-sized viewport
- after reaching the destination, there is a credible desire to play another short stage

The outcome must be recorded as one of:

- **Keep:** the action core is enjoyable enough to expand
- **Change:** the core shows promise but specific feel/rhythm/combat problems remain
- **Kill:** the action core does not justify further investment

## Consequences

This ADR intentionally makes previous implementation assumptions disposable.

Existing expedition, territory, location, equipment, art, and world-state code should be reused only where it strengthens the new playable loop. Do not preserve old architecture merely because it exists.

Conversely, do not delete compatible systems wholesale before the action prototype establishes what the new outer loop actually needs.

The immediate product question is now deliberately simple:

> **Is controlling Crownless fun?**
