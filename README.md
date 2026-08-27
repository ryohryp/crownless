# Crownless

**Location-discovery idle expedition RPG in a medieval fantasy world.**

Crownless is built around one loop:

> **Walk → Discover → Prepare → Dispatch → Wait → Report → Adapt**

Real-world movement reveals the game world. The player then returns to safety, chooses companions and equipment, sends an expedition into a discovered place, and later reads what happened.

The project is currently undergoing a deliberate design pivot tracked in [Issue #189](https://github.com/ryohryp/crownless/issues/189) and [ADR 0002](docs/adr/0002-idle-expedition-pivot.md).

## Core idea

Location is not a pedometer reward system.

Walking through reality reveals, remembers, and develops Crownless. A newly discovered forest, ruin, road, cave, or settlement becomes a place the player can later send people into.

The central question is:

> **After dispatching an expedition, do you want to reopen the game to see what happened?**

## What the player does

- walk somewhere and reveal new Crownless world knowledge
- return to the **Grey Hearth**
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

Combat may occur during an expedition, but the current design no longer requires player-controlled real-time action combat.

## Design pillars

- **Discovery:** real-world movement opens the world instead of filling an energy meter
- **Expedition judgment:** the important input is who / what / where / why / how risky
- **Waiting with anticipation:** elapsed time should create curiosity, not chores
- **Reports as stories:** results should be memorable beyond `Gold +100`
- **Companion history:** people become meaningful through survival, injury, rescue, and repeated expeditions
- **Loot with options:** equipment should change possible expedition outcomes and branches, not only stats
- **Survival and return:** carried value is not fully safe until people come home
- **Living medieval world:** factions, territory, war, regional events, hunts, and dungeons remain compatible future layers

## Canonical documents

- [Current Game System Design](docs/game-system-design.md) — canonical overall gameplay design
- [Expedition System Specification](docs/expedition-system-spec.md) — dispatch, elapsed time, event resolution, companions, reports, injury / missing state, and loot
- [Exploration & Location Discovery Specification](docs/exploration-location-spec.md) — GPS / geography discovery and persistent world knowledge
- [Grey Hearth Presentation Specification](docs/hearth-presentation-spec.md) — safe-room presentation and expedition preparation / review
- [ADR 0002 — Idle expedition pivot](docs/adr/0002-idle-expedition-pivot.md) — deliberate replacement of action-combat-centered design
- [Visual Design Guide v0.2](docs/visual-design-guide-v0.2.md) — canonical global visual rules
- [Deployment strategy](docs/deployment-strategy.md)
- [Development guide for coding agents](AGENTS.md)

Historical action-combat documents remain in the repository only as deprecated transition references and do not override the current Canon.

## Current implementation transition

The existing browser prototype still contains the earlier action-combat implementation, combat CSS/assets, Named Hunt combat, and other systems created before ADR 0002.

Do **not** interpret that code as the current product direction.

The next implementation should first prove a small new loop:

```text
known destination
  ↓
choose companion + equipment + policy
  ↓
dispatch
  ↓
elapsed time
  ↓
resolve deterministic events
  ↓
report
  ↓
loot / injury / discovery
  ↓
dispatch again
```

Old combat code should be removed or repurposed incrementally only after tracing runtime/test/document references.

## First PoC target

Keep the first slice deliberately small:

- 3 companions
- 3–5 destinations
- forest / abandoned village / cave destination families
- cautious / standard / greedy policies
- roughly 15 equipment / supply items
- a small deterministic event library
- injury
- loot
- new-place discovery
- policy-driven early return
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
- once a place is legitimately discovered, its expedition content can normally be played later from safety

## Idle-time implementation rule

The first version does not need an always-on backend simulator.

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
3. Build the dispatch / anticipation / report loop before infrastructure.
4. Prefer deterministic systems that can be tested without live GPS or network access.
5. If architecture is cleaner but the prototype is no more compelling, it is probably not the next task.

## Play locally

```bash
npm start
```

Open `http://localhost:4173`.

During the design transition, the current runtime may still expose legacy action-combat behavior until the new PoC replaces it.

## Hosting

- **GitHub Pages** publishes the latest `main` build for frequent browser / phone playtests.
- **Vercel Git auto-deploys are disabled**; Vercel is reserved for deliberate stable releases and server-side capabilities such as geography access.

See [Deployment strategy](docs/deployment-strategy.md) for details.

## Status

Playable browser prototype / major gameplay pivot in progress.