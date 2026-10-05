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
- [Visual Canon](visual-canon.md)
- [Deployment strategy](deployment-strategy.md)

ADR 0002 is retained because later decisions preserve some of its location/privacy and deterministic-expedition boundaries, but its product identity and North Star are superseded.

## Supporting specifications

These are useful subsystem references, not independent product Canon:

- [Game system design](game-system-design.md) — September territory-era design; useful context, but `AGENTS.md` now owns the current core loop and milestone.
- [Expedition system](expedition-system-spec.md) — deterministic expedition concepts; its claim that expeditions are “the gameplay center” is historical.
- [Exploration/location](exploration-location-spec.md)
- [Exploration discovery contract](exploration-discovery-contract.md)
- [Grey Hearth presentation](hearth-presentation-spec.md) — expedition-era Hearth reference; current runtime and `AGENTS.md` take precedence.
- [Geography production operations](geography-production-operations.md)
- Character specifications under [`characters/`](characters/).
- Visual implementation references under [`visual/`](visual/).

## Playtest evidence

Files named `playtest-*.md` and `playable-slice-playtest.md` record what was tested in a particular build. Keep them as evidence. Do not infer current product requirements from an old playtest.

The most recent dated playtest should normally be consulted first when investigating actual player-visible behavior.

## Historical / experiment references

These remain in place for traceability but are explicitly non-Canon:

- [`game-system-design-v0.1.md`](game-system-design-v0.1.md) — original action hack-and-slash direction.
- [`visual-design-guide-v0.1.md`](visual-design-guide-v0.1.md) — superseded visual baseline.
- [`visual-design-guide-v0.2.md`](visual-design-guide-v0.2.md) — older combat-actor visual baseline; use current Visual Canon and visual skill first.
- [`issue-55-implementation.md`](issue-55-implementation.md) — implementation snapshot for one historical issue.

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
4. mark displaced documents historical instead of leaving two files claiming to be Canon;
5. keep task progress in GitHub rather than creating another design file.

The goal is a small, navigable set of current documents—not a complete archive of every idea at the same authority level.
