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

Try several expeditions in a row. The current slice is specifically testing whether different enemy roles, event outcomes, loot choices, and named hunts create a reason to start another run.

- **Rusher** closes distance aggressively.
- **Guard** blocks ordinary pressure and rewards heavy attacks.
- **Skirmisher** keeps range and fires telegraphed projectiles.
- Exploration can lead to fights, ambushes, hidden caches, shrines, or travelers.
- Fresh loot shows its combat style, playstyle modifier, and comparison with the equipped item.
- Carried loot remains unsecured until the player returns to the Grey Hearth.

### Named hunts

The Grey Hearth rumor board now tracks three named targets in sequence:

1. **灰牙** — a Rusher hunt that awards the unarmed relic `灰牙の血布`.
2. **鐘なき騎士** — a Guard hunt that awards the heavy-impact sword `鐘喰らいの武装剣`.
3. **沼鴉** — a Skirmisher hunt that awards the evade-focused dagger `沼鴉の嘴`.

Exploration leads in a target's territory can show `痕跡`. Resolving two relevant locations reveals the target's lair as a dedicated high-risk exploration lead. Hunt clues persist across safe returns and defeats. Defeating a target drops its signature relic as unsecured loot, so the player still has to survive the return trip to keep it.

Real GPS, parties, and faction warfare are intentionally deferred until this loop is consistently fun.

## Status

Playable prototype / rapid iteration.
