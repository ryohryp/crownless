# Crownless

**Location-discovery expedition RPG in a medieval fantasy world.**

Crownless is built around one loop:

> **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**

Real-world movement reveals the game world. The player then returns to safety, chooses companions and equipment, sends an expedition into a discovered place, and later reads what happened.

This is the current canonical product direction, established by [Issue #189](https://github.com/ryohryp/crownless/issues/189) and [ADR 0002](docs/adr/0002-idle-expedition-pivot.md). The earlier action hack-and-slash direction is no longer gameplay Canon.

## Core idea

Location is not a pedometer reward system.

Walking through reality reveals, remembers, and develops Crownless. A newly discovered forest, ruin, road, cave, settlement, event, or facility becomes part of the playable world and can create new expedition or interaction options.

The central question is:

> **After dispatching an expedition, do you want to reopen the game to see what happened?**

## What the player does

- walk somewhere and reveal new Crownless world knowledge
- return to the **Grey Hearth** or another safe stationary context
- choose a discovered destination
- choose companions
- assign weapons, clothing, tools, and supplies
- choose an objective and risk policy
- dispatch the expedition
- let time pass
- read a concise result and optional chronological report
- secure returned loot and knowledge
- deal with injuries, delays, missing companions, or rescue opportunities
- adapt and send the next expedition

Combat may occur during an expedition, but the current design does not use player-controlled real-time action combat as a core system.

`Idle` or elapsed-time behavior is an expedition-resolution mechanic, not the main genre identity. Crownless is primarily a **Location × Expedition RPG**.

## Design pillars

- **Discovery:** real-world movement opens the world instead of filling an energy meter
- **Expedition judgment:** the important input is who / what / where / why / how risky
- **Waiting with anticipation:** elapsed time should create curiosity, not chores
- **Reports as stories:** results should be memorable beyond `Gold +100`
- **Companion history:** people become meaningful through survival, injury, rescue, and repeated expeditions
- **Loot with options:** equipment should change possible expedition outcomes and branches, not only stats
- **Survival and return:** carried value is not fully safe until people come home
- **Living medieval world:** factions, territory, war, regional events, hunts, facilities, and dungeons remain compatible future layers

## Canonical documents

- [Current Game System Design](docs/game-system-design.md) — canonical overall gameplay design
- [Expedition System Specification](docs/expedition-system-spec.md) — dispatch, elapsed time, event resolution, companions, reports, injury / missing state, and loot
- [Exploration & Location Discovery Specification](docs/exploration-location-spec.md) — GPS / geography discovery and persistent world knowledge
- [Grey Hearth Presentation Specification](docs/hearth-presentation-spec.md) — safe-room presentation and expedition preparation / review
- [ADR 0002 — Location-discovery expedition RPG](docs/adr/0002-idle-expedition-pivot.md) — explicit replacement of the action-combat-centered direction
- [Visual Design Guide v0.2](docs/visual-design-guide-v0.2.md) — canonical global visual rules
- [Deployment strategy](docs/deployment-strategy.md)
- [Development guide for coding agents](AGENTS.md)

Historical action-combat documents remain in the repository only as deprecated transition references and do not override the current Canon.

## Current implementation transition

The browser prototype may still contain earlier action-combat implementation, combat CSS/assets, Named Hunt combat, and other systems created before ADR 0002.

Do **not** interpret that code as the current product direction.

Current implementation should strengthen this loop:

```text
walk in reality
  ↓
discover Crownless places
  ↓
choose a destination + party + equipment + policy
  ↓
dispatch
  ↓
elapsed time
  ↓
resolve deterministic events
  ↓
report
  ↓
loot / injury / discovery / new options
  ↓
adapt and dispatch again
```

Old combat code should be removed or repurposed incrementally only after tracing runtime/test/document references.

## First playable target

Keep slices deliberately small and playable:

- a small persistent companion roster
- several location-discovered destinations
- multiple destination / event families
- meaningful equipment and supplies
- cautious / standard / greedy-style policies
- deterministic expedition events
- injury / delay / missing states
- loot and new discoveries
- concise result summary + expandable chronology
- instant / accelerated developer resolution

If this does not create a reason to come back for the result, do not expand the world simulation yet.

## Location rules

- device GPS is used only after explicit permission / player action
- external geography is translated into Crownless fiction rather than copied literally
- private homes and individual businesses are not turned directly into dangerous game targets
- no continuous background location tracking is required
- no step-count reward loop
- no exact route history stored as game collection state
- deterministic / simulated location fallback remains available
- once a place is legitimately discovered, its game-facing content can normally be used later from safety

## Elapsed-time implementation rule

The current design does not need an always-on backend simulator.

An active expedition can persist:

- dispatch inputs
- `startedAt`
- `expectedReturnAt`
- deterministic seed
- rules / content version

When the app is reopened, elapsed events can be resolved deterministically and idempotently.

## Visual direction

The existing Crownless visual identity remains active:

- living medieval manuscript / woodcut presentation
- irregular ink lines
- parchment / ash fields
- restrained semantic color
- compact folk-doll-like characters
- physical / annotation-like UI rather than glossy mobile-RPG panels

See [Visual Design Guide v0.2](docs/visual-design-guide-v0.2.md).

## Intentionally deferred

- real-time action combat as a core requirement
- gacha
- stamina / energy monetization
- daily chores
- PvP
- clans
- large crafting trees
- always-on faction-war simulation
- production cloud accounts
- large LLM-driven event generation
- monetization design

## Development principles

1. **Fun beats technical novelty.**
2. **Design → smallest implementation → play → improve.**
3. Build discovery → expedition → anticipation → report before infrastructure.
4. Prefer deterministic systems that can be tested without live GPS or network access.
5. If architecture is cleaner but the prototype is no more compelling, it is probably not the next task.

## Play locally

```bash
npm start
```

Open `http://localhost:4173`.

## Hosting

- **Canonical public / phone-playtest URL:** https://ryohryp.github.io/crownless/
- **GitHub Pages** publishes the latest tested `main` build and is the player-facing source of truth during active development.
- **Vercel Git auto-deploys are disabled.** Vercel is not the canonical game URL; it is reserved for deliberate server-side / release verification such as `/api/geography`.

See [Deployment strategy](docs/deployment-strategy.md) for details.

## Status

Playable browser prototype / **Location × Expedition RPG** in active development.
