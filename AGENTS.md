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

## Development rule

Prefer short playable loops over long speculative design phases:

> Design → smallest implementation → play → improve

When choosing between architectural novelty and something that makes the prototype more fun, choose the playable improvement unless the simpler option creates a clear blocker.

## Before changing code

1. Read this file.
2. Read `docs/game-system-design.md` as the canonical current gameplay design.
3. Inspect the current implementation and open issues before proposing a replacement architecture.
4. Treat older versioned design documents as history when they conflict with the canonical design or current implementation.
5. Preserve existing decisions unless there is a concrete reason to change them.

## Implementation expectations

- Keep the first playable slice small.
- Avoid building large backend/platform systems before the core loop is fun.
- Prefer deterministic game logic that can be tested without GPS or network access.
- Put device/location integrations behind interfaces so gameplay can run with simulated locations.
- Keep balance values and content data configurable rather than scattering magic numbers through code.
- Add tests around progression, rewards, encounter resolution, inventory loss, and other high-impact game rules.

## Product priority

If a change makes the architecture cleaner but the game no more fun, it is probably not the next task.
