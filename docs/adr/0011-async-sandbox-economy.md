# ADR 0011 — Location-based asynchronous sandbox economy

- **Status:** Accepted / active product direction
- **Date:** 2026-10-09
- **Supersedes in scope:** ADR 0008's finished-weapon regional drops, and ADR 0006's assumption that territory capture must be the only social meta-loop.
- **Retains:** Real-world discovery, tactical combat without real-time PvP, return/survival stakes, coarse location identity, smartphone-first play, and meaningful place histories.

## Context

The current expedition/frontier slice functions mechanically but does not create sufficient desire to return. More POIs or richer loot presentation alone have not solved that. The new hypothesis is that **other people changing a place, crafting objects, and creating demand** will give both exploration and non-combat play durable meaning.

This is an explicit product-direction change requested on 2026-10-09, not a claim that multiplayer networking or a player economy is already implemented.

## Decision

Crownless targets a **location-based, asynchronous sandbox MMO** inspired by the *social interdependence* of Ultima Online, not by reproducing its full feature set.

1. **A shared living world:** Actions leave bounded, persistent traces attached to coarse game-world places. Other players can later use, contest, or be affected by them. No simultaneous connection is required.
2. **A player-driven supply chain:** Enemy defeats yield **materials, currency and/or knowledge/recipes, never finished equippable weapons or armor**. Gathering likewise yields resources. Finished weapons and armor enter the economy through craft professions only. Starting equipment may be untradeable loan gear. Existing saved equipment is grandfathered during migration and must not be duplicated or silently destroyed.
3. **Crafting is primary play:** Crafting, repairing, commission work and eventually trade should give artisans their own decisions and recognition. An item can retain maker identity and (coarse) source provenance without revealing real-world routes.
4. **Multiple characters per account:** Begin with up to three character slots, one active at a time, per-character skill growth, and one shared account warehouse. Character specialization matters but permanent locked classes are not required. Location discovery and safe physical presence are account-scoped to prevent switch-based teleportation.
5. **Place-based regional economies:** Resource and recipe identity can differ by broad region/landmark. Crafting and trade may change the utility and history of places, rather than using GPS for simple travel rewards.
6. **No forced simultaneity:** Trades, work orders, installed facilities and their effects resolve without both players online. Never expose exact player whereabouts or location histories.

## Implementation boundary

Do **not** build identity servers, global auction houses, guilds, live PvP, complex simulated supply-demand, or nationwide infrastructure before testing a single small loop.

### First playable vertical slice

- A saved account can switch between an **adventurer** and a **smith** at a safe location (the third slot can remain unused until needed).
- One existing expedition yields an identifiable **material**, banked only on safe return.
- Only the smith can consume that material to create **one usable weapon**. The adventurer can equip it and notice a meaningful difference in a subsequent expedition.
- A local simulated buyer/order or authored trace can prove the value of a crafter while player population is zero; it must be clearly marked as simulated.
- Reload and repeat actions cannot duplicate materials, equipment, or commissions.
- The former finished-weapon drops must be removed or quarantined for this playable slice; a mixed ruleset is not the target state.

**Observe:** After one crafted weapon, does the player choose to explore for material again, or want to fill the next order without being prompted? If not, reduce or redesign rather than adding more professions.

### Later, conditional on this being fun

1. Shared place traces with a second account fixture / simulated other player.
2. Asynchronous orders and item provenance between distinct accounts, with server authority and abuse protections.
3. Regional market differences, repair demand, structures and more specializations.

## Safety and economy guardrails

- Store and share only coarse place identifiers, not raw GPS fixes or precise routes. Never reveal live positions or allow player-on-player location stalking.
- Source-of-truth and transaction checks must prevent item duplication and account-switch exploits. Client-only state is a prototype, **not a trustworthy shared economy**.
- Explicit repair/consumption sinks may be needed to sustain demand, but punitive item breakage is not presumed fun.
- No mandatory daily tasks, arbitrary timers, or offline production spam.

## Validation

Code + tests verify rules, save migration, idempotence and phone-size reachability. Real players determine whether the crafted-object/social-effect loop is enjoyable; CI alone cannot answer that question.
