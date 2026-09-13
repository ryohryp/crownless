# Crownless

**Location-discovery territory-expansion RPG in a medieval fantasy world.**

Crownless is built around one loop:

> **Walk → Discover → Scout / Learn → Prepare → Contest / Expedition → Control → Exploit / Defend / Expand → Next place**

Real-world movement reveals the game world. The player can then return to safety, learn what matters about discovered places, choose companions, equipment, and an approach, contest NPC-held locations, and see persistent control of the map change.

This is the current canonical product direction, established by [Issue #503](https://github.com/ryohryp/crownless/issues/503) and [ADR 0004](docs/adr/0004-territory-driven-reforge.md). [ADR 0005](docs/adr/0005-realtime-combat-rejected.md) remains the guardrail against reintroducing player-controlled real-time combat. ADR 0002 is historical context and no longer defines the product-level loop or North Star.

## Core idea

Location is not a pedometer reward system.

Walking through reality reveals, remembers, and develops Crownless. A newly discovered forest, ruin, road, cave, settlement, event, or facility becomes part of the playable world and can create new expedition or interaction options.

The central question is:

> **自分の行動で勢力圏が広がった地図を見たとき、次の地点を取りたくなるか？**

## What the player does

- walk somewhere and reveal new Crownless world knowledge
- return to the **Grey Hearth** or another safe stationary context
- inspect discovered places, uncertainty, NPC control, and strategic value
- scout a target or deliberately accept incomplete information
- choose companions, equipment, supplies, and an approach
- contest the place through the deterministic expedition / event resolver
- understand the result, injuries, loot, knowledge, and causal consequences
- on legitimate success, change persistent control from NPC to player
- see the Atlas and at least one later target condition change
- choose which place to take next

Combat may occur during an expedition, but the current design does not use player-controlled real-time action combat as a core system.

Expeditions and elapsed-time resolution remain important means of acting on places, but they are not the product goal. Crownless is primarily a **Location × Territory RPG**.

## Design pillars

- **Discovery:** real-world movement opens the world instead of filling an energy meter
- **Discovery:** real-world movement opens the world instead of filling an energy meter
- **Territorial judgment:** scouting, preparation, and approach should determine whether and how a place can be taken
- **Visible world change:** legitimate success must change persistent control and make that change legible on the Atlas
- **Strategic consequence:** a controlled place should change at least one later option, risk, duration, resource, route, or piece of information
- **Companion history:** people become meaningful through survival, injury, rescue, geographic knowledge, and repeated expeditions
- **Loot with options:** equipment should change possible approaches and outcomes, not only stats
- **Reports as evidence:** results explain what happened and why; they are not the product reward by themselves
- **Living medieval world:** factions, territory, war, regional events, hunts, facilities, and dungeons remain compatible future layers

## Canonical documents

- [Current Game System Design](docs/game-system-design.md) — canonical overall gameplay design
- [Expedition System Specification](docs/expedition-system-spec.md) — dispatch, elapsed time, event resolution, companions, reports, injury / missing state, and loot
- [Exploration & Location Discovery Specification](docs/exploration-location-spec.md) — GPS / geography discovery and persistent world knowledge
- [Grey Hearth Presentation Specification](docs/hearth-presentation-spec.md) — safe-room presentation and expedition preparation / review
- [ADR 0004 — Territory-driven Reforge](docs/adr/0004-territory-driven-reforge.md) — current product decision, core loop, and North Star
- [ADR 0002 — Location-discovery expedition RPG](docs/adr/0002-idle-expedition-pivot.md) — historical expedition-centered pivot; product-level wording is superseded by ADR 0004
- [ADR 0005 — Real-time combat rejected](docs/adr/0005-realtime-combat-rejected.md) — guardrail against reintroducing player-controlled real-time combat
- [Visual Design Guide v0.2](docs/visual-design-guide-v0.2.md) — canonical global visual rules
- [Deployment strategy](docs/deployment-strategy.md)
- [Development guide for coding agents](AGENTS.md)

Historical action-combat documents may remain only as deprecated references and do not override the current Canon.

## Current implementation

The rejected real-time combat runtime, combat-specific presentation modules, dedicated runtime assets, and dedicated tests have been removed from the active product under ADR 0005.

The repository root entry point routes to `reboot.html`, a bounded exploration / consequence prototype. It is useful implementation work, but it does not replace the Territory-driven Canon. Combat or hostile encounters may still be represented inside deterministic expedition and encounter resolution; that is intentionally distinct from player-controlled real-time combat.

Current implementation should strengthen this loop:

```text
walk in reality
  ↓
discover Crownless places
  ↓
scout / learn
  ↓
prepare companions + equipment + approach
  ↓
contest / expedition
  ↓
resolve deterministic consequences
  ↓
valid success may change control
  ↓
Atlas and next-place conditions change
  ↓
choose the next place
```

Do not rebuild a manual attack / dodge / enemy-HP loop without a new explicit Canon decision.

## First playable target

Keep the first Territory slice deliberately small and playable:

- exactly three representative discovered places
- NPC-controlled and player-controlled states
- visible uncertainty and strategic value
- scouting versus acting with incomplete information
- at least one companion / equipment / approach choice that changes the contest
- deterministic contest resolution that reuses the expedition resolver where practical
- persistent NPC → player control on legitimate success only
- failure / retreat that does not grant control
- idempotent Report / reload behavior
- at least one captured-place effect that changes a later target's approach, risk, duration, resource, route, or information
- a clear next-target decision immediately after capture

If taking one place does not change the map and make another place desirable, fix or kill the hypothesis before expanding territory content or infrastructure.

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
3. Build the smallest discovery → scout → prepare → contest → control → next-place slice before infrastructure.
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

Playable browser prototype / **Location × Territory RPG** in active development.
