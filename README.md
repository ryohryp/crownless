# Crownless

**Location-based medieval fantasy action hack-and-slash RPG.**

Crownless is a game project built around a simple core loop:

> Explore → Fight → Loot → Survive → Grow → Explore deeper

The goal is to combine:

- the tense dungeon exploration, party play, and survival pressure of **Wizardry**
- the direct, satisfying action feel of **Kunio-kun**
- the loot hunting and build crafting of **Diablo**
- real-world discovery driven by **GPS / location data**
- a medieval fantasy world of factions, territory, and war inspired by **Game of Thrones**

## Core idea

Location is not a pedometer reward system. Walking through the real world reveals, discovers, and develops the game world.

The player begins as an unknown, unarmed person. Bare hands are a valid fighting style, and the player can grow into many different combat styles and builds through play.

## Development principles

1. **Fun beats technical novelty.**
2. **Design → smallest implementation → play → improve.**
3. Build the core loop before expanding the world.
4. Keep exploration, combat, loot, and survival tightly connected.
5. Respect existing design documents and implementation decisions.

## Documents

- [Game System Design v0.1](docs/game-system-design-v0.1.md)
- [Development guide for coding agents](AGENTS.md)

## Play the prototype

The current prototype focuses on replayable expedition decisions rather than GPS integration.

```bash
npm start
```

Open `http://localhost:4173`.

### Controls

- Move: `WASD` or arrow keys
- Light attack / 3-hit combo: `J`
- Heavy attack / guard break: `K`
- Evade / perfect evade: `Space`

Touch controls appear on smaller screens.

### What to test

Try several expeditions in a row. The current slice is specifically testing whether different enemy roles, event outcomes, and loot choices prevent the loop from becoming repetitive.

- **Rusher** closes distance aggressively.
- **Guard** blocks ordinary pressure and rewards heavy attacks.
- **Skirmisher** keeps range and fires telegraphed projectiles.
- Exploration can lead to fights, ambushes, hidden caches, shrines, or travelers.
- Fresh loot shows its combat style, playstyle modifier, and comparison with the equipped item.
- Carried loot remains unsecured until the player returns to the Grey Hearth.

Real GPS, parties, and faction warfare are intentionally deferred until this loop is consistently fun.

## Status

Playable prototype / rapid iteration.
