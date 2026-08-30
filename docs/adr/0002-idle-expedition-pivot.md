# ADR 0002 — Crownless is a location-discovery expedition RPG

- **Status:** Accepted / current product direction
- **Date:** 2026-08-27
- **Confirmed:** 2026-08-30
- **Related:** #189

## Context

Crownless was originally designed around a location-based action hack-and-slash loop. The prototype proved several useful ideas — real-world discovery, persistent world knowledge, unsecured versus secured value, the Grey Hearth, loot, and return pressure — but the action-combat layer became a large center of gravity without making the overall game compelling enough.

The strongest emerging fantasy is not "fight well while walking." It is:

> discover an unknown world by moving through reality, send people into that world, and care about what happens while they are away.

Action combat also competes with safe mobile/location play and makes every discovered danger demand a second, separate action-game session.

## Decision

Crownless is a **location-discovery expedition RPG**.

In product shorthand:

> **Location × Expedition RPG**

The canonical loop is:

> **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**

Real-world movement reveals the game world. Once a place has been discovered, expeditions can be prepared and dispatched to it from the Grey Hearth or another safe stationary context.

Elapsed time is an important expedition mechanic, but `idle` is not the primary genre identity. The game is defined by discovering a world through location, making expedition decisions, waiting with anticipation, and reacting to reports and consequences.

Combat may occur inside an expedition, but it is resolved by expedition rules, companion capabilities, equipment, circumstances, and player-authored policy. It is **not** a real-time player-controlled action layer in the current product direction.

This decision supersedes the original action hack-and-slash direction. Real-time action combat must not be reintroduced as a core pillar unless a later explicit ADR deliberately changes this decision.

The first validation question is:

> **After dispatching an expedition, does the player want to reopen the game to see what happened?**

## Consequences

### Kept

- GPS / geography as world-discovery input, never a pedometer reward loop
- persistent discovered places and coarse explored areas
- the Grey Hearth as a safe home
- unsecured / secured value and meaningful return
- loot collection
- companions, injuries, disappearance, rescue, and death as potential sources of story
- Named Hunts, dungeons, regional events, factions, and war as future expedition content
- deterministic / simulated location fallback
- the existing medieval manuscript / woodcut Visual Canon

### Removed from current Canon

- real-time action combat as a core pillar
- stand-to-strike
- Technique / Evade / 闘志 / 決着 as required systems
- battlefield weapon pickup as a required loop
- the requirement that equipment primarily changes action-combat rhythm

Existing combat code, tests, CSS, assets, and old combat specifications are transition-era implementation/history until a separate cleanup removes or repurposes them. They must not override the current gameplay Canon.

## Implementation principle

Do not replace action-combat complexity with idle-game platform complexity.

The first implementation should use deterministic elapsed-time resolution and may resolve an expedition lazily when the app is reopened. No always-on simulation backend, background GPS tracking, generalized quest engine, gacha, stamina, or LiveOps system is required to prove the loop.

When choosing work, prioritize improvements that strengthen one of these relationships:

- walking → meaningful discovery
- discovery → meaningful expedition option
- preparation → understandable consequences
- dispatch → anticipation
- report → memorable story and next decision

Architecture, content volume, and technical novelty are secondary to making that loop fun.