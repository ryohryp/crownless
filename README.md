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

## First playable prototype

The current prototype deliberately uses simulated location data. Its only job is to prove the expedition loop before real GPS or backend work begins.

### Run

Requires Node.js 20+.

```bash
npm start
```

Then open `http://localhost:4173`.

No application dependencies are required; the start script only launches a small static server.

### Controls

Desktop combat:

- Move: `WASD` or arrow keys
- Light attack: `J`
- Heavy attack: `K`
- Evade: `Space`

Touch controls are shown automatically on narrow/mobile screens.

### Prototype loop

1. Leave the Grey Hearth safe hub.
2. Pick an adjacent unexplored cell on the simulated map.
3. Fight a short real-time encounter.
4. Carry randomized **unsecured** loot.
5. Decide whether to push deeper or return home.
6. Returning secures the loot; defeat loses part of what was still unsecured.
7. Equip secured gear and immediately start another expedition.

Equipment modifiers already alter combat behavior, including heavy stagger, evade follow-ups, unarmed tempo, and a high-risk low-health damage style.

## Development principles

1. **Fun beats technical novelty.**
2. **Design → smallest implementation → play → improve.**
3. Build the core loop before expanding the world.
4. Keep exploration, combat, loot, and survival tightly connected.
5. Respect existing design documents and implementation decisions.

## Tests

```bash
npm test
```

GitHub Actions also runs JavaScript syntax checks and the deterministic game-rule tests on pushes and pull requests.

## Documents

- [Game System Design v0.1](docs/game-system-design-v0.1.md)
- [Development guide for coding agents](AGENTS.md)

## Status

First playable vertical slice in active development.
