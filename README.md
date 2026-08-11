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

- [Current Game System Design](docs/game-system-design.md) — canonical living design
- [Exploration & Location Discovery Specification](docs/exploration-location-spec.md) — current exploration redesign and location/AI generation direction
- [Combat Presentation Specification](docs/combat-presentation-spec.md) — current oblique top-down camera, battlefield readability, HUD, and combat-loot presentation direction
- [Game System Design v0.1](docs/game-system-design-v0.1.md) — historical baseline
- [Deployment strategy](docs/deployment-strategy.md)
- [Development guide for coding agents](AGENTS.md)

## Play the prototype

The current prototype focuses on replayable expedition decisions rather than GPS integration.

```bash
npm start
```

Open `http://localhost:4173`.

### Controls

The current combat model is **stand-to-strike**: move to survive and reposition, then stop to attack.

- Movement: `WASD` / arrow keys on desktop, or **drag on the combat arena** on pointer/touch devices
- Normal attacks / combo: **AUTO while stopped** with an enemy in weapon range
- Technique: `K` or the **技** button
- Evade / perfect evade: `Space` or the **回避** button
- Enemy attacks telegraph and often lock their aim, so moving can create a punish window
- Defeated enemies can drop temporary battlefield weapons; move onto one to pick it up when not locked in a committed Technique
- Fighting well builds **闘志**; at 100, the next Technique becomes a high-impact **決着** strike

The player owns positioning, but does not need a separate light-attack button.

### What to test

Try several expeditions in a row. The current slice is specifically testing whether different enemy roles, event outcomes, loot choices, named hunts, dungeon retreat decisions, and Grey Hearth progression create a reason to start another run.

- **Rusher** closes distance aggressively.
- **Guard** blocks ordinary pressure and rewards techniques / guard breaking.
- **Skirmisher** keeps range and fires telegraphed projectiles.
- Fists, daggers, and swords use visibly different stop-to-attack rhythms.
- Exploration can lead to fights, ambushes, hidden caches, shrines, travelers, named hunts, or dungeon entrances.
- Fresh loot shows its combat style, playstyle modifier, and comparison with the equipped item.
- Carried loot remains unsecured until the player returns to the Grey Hearth.
- The route strip records the places visited during the current expedition, turning each run into a readable journey rather than a sequence of disconnected cards.
- Safe return and defeat both have a dedicated expedition report showing secured or recovered loot, renown, and the next Hearth milestone.
- Generated Web Audio feedback, optional vibration, and a persistent sound toggle make timing readable without external assets.
- The **灰喰い坑道** adds three retreatable rooms with an elite fight, a boss, and a first-clear relic.
- Successful returns build **Renown**, which grows the Grey Hearth through small functional milestones.
- Safe Grey Hearth state is stored locally; unfinished expeditions are never saved as secured progress.

### Named hunts

The Grey Hearth rumor board tracks three named targets in sequence:

1. **灰牙** — a Rusher hunt that awards the unarmed relic `灰牙の血布`.
2. **鐘なき騎士** — a Guard hunt that awards the heavy-impact sword `鐘喰らいの武装剣`.
3. **沼鴉** — a Skirmisher hunt that awards the evade-focused dagger `沼鴉の嘴`.

Exploration leads in a target's territory can show `痕跡`. Resolving two relevant locations reveals the target's lair as a dedicated high-risk exploration lead. Hunt clues persist across safe returns and defeats. Defeating a target drops its signature relic as unsecured loot, so the player still has to survive the return trip to keep it.

Real GPS, parties, and faction warfare are intentionally deferred until this loop is consistently fun.

## Hosting

During rapid development:

- **GitHub Pages** publishes the latest `main` build for frequent browser / phone playtests.
- **Vercel Git auto-deploys are disabled**; Vercel is reserved for deliberate stable production releases.
- **ChatGPT Sites** can be used for isolated UI or interaction experiments before successful ideas are brought back into the repository.

See [Deployment strategy](docs/deployment-strategy.md) for the reusable policy intended for future lightweight apps as well.

## Status

Playable prototype / rapid iteration.
