# Crownless

**Location-based medieval fantasy action hack-and-slash RPG.**

Crownless is built around one loop:

> Explore → Fight → Loot → Survive → Grow → Explore deeper

The project combines:

- the tense dungeon exploration, party identity, and survival pressure of **Wizardry**
- the direct, satisfying action feel of **Kunio-kun**
- the loot hunting and build experimentation of **Diablo**
- real-world discovery driven by **GPS / location data**
- a medieval fantasy world of factions, territory, and war inspired by **Game of Thrones**

## Core idea

Location is not a pedometer reward system. Walking through the real world reveals, remembers, and develops the game world.

The player begins as an unknown, unarmed person. Bare hands remain a valid fighting style rather than only a tutorial state.

## Development principles

1. **Fun beats technical novelty.**
2. **Design → smallest implementation → play → improve.**
3. Build and deepen the core loop before expanding the world.
4. Keep exploration, combat, loot, survival, and return tightly connected.
5. Respect the canonical design documents and the current implementation.

## Canonical documents

- [Current Game System Design](docs/game-system-design.md) — canonical living gameplay design
- [Exploration & Location Discovery Specification](docs/exploration-location-spec.md) — GPS, persistent exploration, Discovery Journal, regional missions, and target map direction
- [Combat Presentation Specification](docs/combat-presentation-spec.md) — oblique top-down camera, HUD, actor rendering, overlap, and combat-loot presentation
- [Grey Hearth Presentation Specification](docs/hearth-presentation-spec.md) — safe-room scene, interactions, progression presentation, and stationary regional-content entry
- [Visual Design Guide v0.2](docs/visual-design-guide-v0.2.md) — canonical global visual rules
- [Game System Design v0.1](docs/game-system-design-v0.1.md) — historical baseline
- [Deployment strategy](docs/deployment-strategy.md)
- [Development guide for coding agents](AGENTS.md)

## Play the prototype

```bash
npm start
```

Open `http://localhost:4173`.

The current browser prototype includes both deterministic exploration and real GPS / geography enrichment. Location failure or permission denial must degrade safely rather than make the rest of the game unusable.

### Combat controls

The current model is **stand-to-strike**: move to survive and reposition, then stop to attack.

- Movement: `WASD` / arrow keys on desktop, or **drag on the combat arena** on pointer / touch devices
- Normal attacks / combo: **AUTO while stopped** with an enemy in weapon range
- Technique: `K` or the **技** button
- Evade / perfect evade: `Space` or the **回避** button
- Enemy attacks telegraph and often lock their aim, so movement creates punish windows
- Defeated enemies can drop temporary battlefield weapons; move onto one and stop briefly to pick it up
- Fighting well builds **闘志**; at full meter the next Technique becomes **決着**

The player owns positioning but does not need a separate light-attack button.

## What is currently playable

Try several expeditions rather than only one encounter. The current slice tests whether the player wants to begin another run through a combination of combat feel, discovery, loot risk, persistent knowledge, and longer goals.

### Exploration and location

- Device GPS can enrich exploration with nearby public geographic signals.
- Geographic data is translated into Crownless fiction rather than shown as a literal POI checklist.
- A manuscript-style nearby sketch map shows approximate local discovery context rather than navigation-grade roads.
- Deterministic / simulated discovery remains available for development and fallback.
- Discovered places persist in the **Discovery Journal** even if the expedition later ends in defeat.
- Stable geographic identity distinguishes source namespaces such as node / way / relation.
- Coarse explored areas persist without storing raw GPS tracks or exact route history.
- The Discovery Journal can show area-level discovery progress and browse known places in list / detail form.
- Supported discovery archetypes can unlock location visuals; the first production slice includes the **Ruined Watchtower / 崩れた物見台**.

### Regional mission

The first regional mission is **消えた荷駄隊**.

Its current loop is:

> road-like discovery → collect two traces → reveal 街道荒らしの野営地 → return to the Grey Hearth → deliberately launch the assault → win unsecured loot → return alive → regional knowledge / next rumor

This is the first implemented bridge between outdoor discovery and longer stationary combat.

### Combat

- **Rusher** closes distance aggressively.
- **Guard** blocks ordinary pressure and rewards Technique / guard breaking.
- **Skirmisher** keeps range and fires telegraphed projectiles.
- Fists, daggers, and swords use different stop-to-attack rhythms.
- Technique, Evade, perfect-evade counters, **闘志**, and **決着** reward clean play.
- Temporary battlefield weapons let an unarmed character improvise without changing secured equipment.
- Combat uses the fixed oblique top-down presentation defined in the combat spec.

### Loot, survival, and return

- Fresh loot shows combat style, modifier, and comparison with equipped gear.
- Carried loot remains unsecured until the player returns to the Grey Hearth.
- Defeat can lose unsecured value without deleting permanent progression.
- Safe return and defeat use dedicated expedition reports.
- The current ordinary loot pool proves build-sensitive itemization but is still comparatively small; expanding variety within Fists / Dagger / Sword is a current priority.

### Named Hunts and dungeon

The Grey Hearth tracks three named targets in sequence:

1. **灰牙** — Rusher identity → `灰牙の血布`
2. **鐘なき騎士** — Guard identity → `鐘喰らいの武装剣`
3. **沼鴉** — Skirmisher identity → `沼鴉の嘴`

Hunt clues persist across expeditions. Signature relics still have to be carried home alive.

The **灰喰い坑道** is a three-room retreatable dungeon with an elite fight, boss, first-clear reward, and deliberate push-deeper / retreat decisions.

### Grey Hearth and persistence

- Successful returns build **Renown**.
- Hearth milestones at 5 / 15 / 30 Renown add small functional benefits.
- The Grey Hearth is presented as a scene-first safe room rather than a dashboard.
- The wall map is the physical home for accumulated discovery knowledge.
- Regional danger discovered outdoors can be surfaced at the Hearth for deliberate stationary assault.
- Safe state is stored locally.
- Unfinished expedition state is never treated as secured progress.
- Learned world knowledge may persist without securing carried expedition value.

## Current priorities

Before Party or faction-scale systems, prioritize:

1. deeper ordinary equipment variety and more meaningful loot choices
2. playtesting the first regional mission loop
3. incremental improvements to progressive map reveal / frontier curiosity
4. continued real-phone readability and interaction QA

## Intentionally deferred

- Party implementation
- real-time multiplayer
- faction / territory warfare simulation
- cloud accounts / production backend persistence
- large crafting systems
- monetization systems
- massive seamless world generation

Real GPS is **not** deferred; it is already part of the current playable exploration slice.

## Hosting

During rapid development:

- **GitHub Pages** publishes the latest `main` build for frequent browser / phone playtests.
- **Vercel Git auto-deploys are disabled**; Vercel is reserved for deliberate stable production releases and server-side capabilities such as geography access.
- Isolated UI / interaction experiments may be prototyped separately before successful ideas are brought back into the repository.

See [Deployment strategy](docs/deployment-strategy.md) for details.

## Status

Playable browser prototype / rapid iteration.
