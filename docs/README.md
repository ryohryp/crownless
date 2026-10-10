# Crownless documentation map

This directory contains current specifications, decision records, playtest evidence, and historical design material. File names alone do **not** establish authority.

## Authority order

When documents disagree, use this order:

1. **`AGENTS.md`** — current product invariants, playable goal, build principles, smartphone rules, and autonomous-development guardrails.
2. **Accepted ADRs that are not superseded** — durable decisions and explicit guardrails. A newer ADR may supersede only the scope it names.
3. **Current subsystem / presentation specifications** — implementation guidance that remains valid only where it does not conflict with `AGENTS.md`, newer ADRs, or the active runtime.
4. **Current runtime + tests** — source of truth for what is actually implemented. A passing test does not make an obsolete product direction Canon.
5. **Playtest records and implementation notes** — evidence about a particular build or experiment, not standing product requirements.
6. **Historical documents** — context only. They must never override current Canon.

If a document labels itself “canonical” but conflicts with a newer item above, the newer authority wins.

## Current product Canon

Start here:

- [`../AGENTS.md`](../AGENTS.md) — highest-level current product and development Canon.
- [ADR 0001 — real-world discovery](adr/0001-real-world-discovery.md)
- [ADR 0003 — web-first, native-ready location](adr/0003-web-first-native-ready-location.md)
- [ADR 0004 — territory-driven reforge](adr/0004-territory-driven-reforge.md) — retained territory decision; product-loop wording is subordinate to the newer `AGENTS.md`.
- [ADR 0005 — reject real-time player-controlled combat](adr/0005-realtime-combat-rejected.md) — this rejects real-time action combat, not the current deliberate choice-based fight loop.
- [ADR 0006 — social territory control](adr/0006-social-territory-control.md)
- [ADR 0008 — frontier and chronicle](adr/0008-frontier-and-chronicle.md)
- [ADR 0009 — smartphone combat viewport and tactical information density](adr/0009-smartphone-combat-viewport-and-tactical-density.md)
- [ADR 0010 — selective game-development tooling before engine migration](adr/0010-selective-game-tooling-before-engine-migration.md)
- [ADR 0011 — location-based asynchronous sandbox economy](adr/0011-async-sandbox-economy.md) — active product pivot; replaces finished-gear drop and territory-only motivation.
- [ADR 0012 — landmark control grants passive blessings](adr/0012-landmark-control-passive-buffs.md) — accepted decision, **not yet implemented**; automatic passive benefits with stacking limits.

- [Visual Canon](visual-canon.md) — single global visual authority; specialized `visual/` documents must conform to it
- [Deployment strategy](deployment-strategy.md)

ADR 0002 is retained because later decisions preserve some of its location/privacy and deterministic-expedition boundaries, but its product identity and North Star are superseded.

## Supporting specifications

These are useful subsystem references, not independent product Canon:

- [Active gameplay specification](gameplay-spec.md) — current supporting gameplay contract for exploration, combat, loot, territory/frontier development, rivals, Hearth, Chronicle, persistence, and smartphone validation.
- [Exploration/location](exploration-location-spec.md)
- [Exploration discovery contract](exploration-discovery-contract.md)
- [Geography production operations](geography-production-operations.md)
- Character specifications under [`characters/`](characters/).
- Visual implementation references under [`visual/`](visual/). Keep only active Canon adapters, production pipelines, and specialized asset contracts; Issue-specific visual handoffs belong in Git/Issue history once completed.

## Playtest evidence

Dated playtest files and `playable-slice-playtest.md` record meaningful end-to-end evidence from particular builds. Keep useful behavioral evidence, but remove one-off implementation checklists once the corresponding Issue/PR and Git history are sufficient. Do not infer current product requirements from an old playtest.

The most recent dated playtest should normally be consulted first when investigating actual player-visible behavior.

Do not add new one-off design documents when an existing current document can be updated. Prefer:

- product invariant or current milestone → `AGENTS.md`
- durable decision / rejected direction → ADR
- active subsystem contract → existing subsystem spec
- observed behavior → dated playtest record
- implementation task/progress → GitHub Issue / PR, not a permanent design document

## Maintenance rule

When a product direction changes:

1. update `AGENTS.md` if the current playable goal/invariant changes;
2. add or supersede an ADR only for a durable decision;
3. update affected active specs;
4. remove fully displaced design/spec documents once still-useful rules have been absorbed into an active spec or ADR; use Git history for obsolete versions instead of keeping parallel pseudo-Canon;
5. keep task progress in GitHub rather than creating another design file.

The goal is a small, navigable set of current documents—not a complete archive of every idea at the same authority level.
