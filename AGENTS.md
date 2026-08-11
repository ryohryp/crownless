# AGENTS.md

This repository contains **Crownless**, a location-based medieval fantasy action hack-and-slash RPG.

## Product direction

Preserve these pillars unless a deliberate design change is documented:

- Wizardry-like dungeon exploration, party play, and tension around returning alive
- Kunio-kun-like direct and satisfying action combat
- Diablo-like loot hunting, itemization, and build construction
- GPS/location-based discovery of the game world
- Medieval fantasy factions, territory, politics, and war

The core loop is:

> Explore → Fight → Loot → Survive → Grow → Explore deeper

The player starts as an unknown person with no weapon. Unarmed combat must remain a legitimate play style rather than only a temporary tutorial state.

## Location design rule

Do not reduce location gameplay to step-count rewards.

Real-world movement should reveal, discover, unlock, or develop the game world. The location layer must create meaningful exploration decisions while remaining safe and playable without requiring trespassing, dangerous travel, or constant GPS precision.

Exploration is moving toward a progressively revealed map rather than a text-branch / gamebook flow. For exploration, map, location, regional-content, or AI-generation changes, read `docs/exploration-location-spec.md` and treat it as the detailed subsystem specification. If an older generic exploration description conflicts with that file, the subsystem specification takes precedence.

## Combat presentation rule

Combat is moving toward a **fixed oblique top-down battlefield view**. For combat camera, battlefield composition, HUD, visual readability, or combat-loot presentation changes, read `docs/combat-presentation-spec.md` and treat it as the detailed subsystem specification.

The current **stand-to-strike** combat model in `docs/game-system-design.md` remains authoritative for controls and combat logic. Do not add a light-attack button, virtual joystick, large skill cluster, party HUD, combat minimap, or persistent item-label carpet merely because those elements appear in conventional ARPGs or concept art. When a generic presentation description conflicts with `docs/combat-presentation-spec.md`, the combat presentation specification takes precedence for camera, HUD, readability, and combat drop presentation.

## Development rule

Prefer short playable loops over long speculative design phases:

> Design → smallest implementation → play → improve

When choosing between architectural novelty and something that makes the prototype more fun, choose the playable improvement unless the simpler option creates a clear blocker.

## Before changing code

1. Read this file.
2. Read `docs/game-system-design.md` as the canonical current gameplay design.
3. If the task touches exploration, maps, location data, GPS, regional flavor, outdoor/stationary play, or AI-generated world content, also read `docs/exploration-location-spec.md`.
4. If the task touches combat camera, HUD, battlefield presentation, readability, or combat loot presentation, also read `docs/combat-presentation-spec.md`.
5. Inspect the current implementation and open issues before proposing a replacement architecture.
6. Treat older versioned design documents as history when they conflict with the canonical design, subsystem specifications, or current implementation.
7. Preserve existing decisions unless there is a concrete reason to change them.

## Implementation expectations

- Keep the first playable slice small.
- Avoid building large backend/platform systems before the core loop is fun.
- Prefer deterministic game logic that can be tested without GPS or network access.
- Put device/location integrations behind interfaces so gameplay can run with simulated locations.
- Keep balance values and content data configurable rather than scattering magic numbers through code.
- Add tests around progression, rewards, encounter resolution, inventory loss, and other high-impact game rules.
- Never put paid AI provider API keys in the game client. Regional AI generation must be host-side or batch-generated, persisted, and reusable.

## Product priority

If a change makes the architecture cleaner but the game no more fun, it is probably not the next task.
