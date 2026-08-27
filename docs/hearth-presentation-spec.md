# Grey Hearth Presentation Spec

> **Status:** current presentation specification  
> **Updated:** 2026-08-27  
> **Parent design:** [`game-system-design.md`](game-system-design.md)

## 1. Purpose

The Grey Hearth is the player's safe anchor and the place where Crownless turns expedition results into the next decision.

It should feel like **a poor but increasingly inhabited medieval refuge**, not a modern management dashboard.

The current Hearth loop is:

> **Return / reopen → see who came back and what changed → inspect report → treat / equip / prepare → dispatch again**

The Hearth must support the idle expedition design without becoming a chores game.

## 2. Primary functions

The Hearth is where the player can:

- inspect returned, delayed, or missing expeditions
- read expedition reports
- inspect companion condition
- select a discovered destination
- prepare a new expedition
- assign equipment and supplies
- choose objective and risk policy
- dispatch
- inspect secured loot
- inspect persistent world knowledge / Discovery Journal
- respond to rescue opportunities or future rumors

## 3. Scene-first presentation

The first view should still read as one physical room.

Prefer physical or spatial anchors for the major functions:

- **Mist Gate / departure point** — dispatch / leave
- **wall map** — discovered places and destination selection
- **table / ledger / messenger area** — active and returned expedition reports
- **companions in the room** — readiness, injury, absence
- **loot shelf / rack** — secured equipment and supplies
- **fire / beds / treatment area** — recovery and habitation
- **rumor board / tokens** — hunts, rescue leads, regional events later

Detailed lists or folios may open when precision is needed, but cards should not dominate the room by default.

## 4. Companion presence is state

Under the new design, companions are more important than the player avatar as combat representation.

The room should eventually make companion state visible:

- ready companions are present
- injured companions can appear resting or marked by restrained annotations
- dispatched companions are absent or represented by a physical expedition marker
- missing companions should create an emotionally clear absence / last-known marker

Do not turn this into a crowded hero-collector lineup. A small number of persistent people is the intended starting point.

## 5. Expedition preparation flow

Preparing an expedition should require only a few high-value choices.

The Hearth should guide the player through:

1. destination
2. companion(s)
3. equipment / supplies
4. objective
5. risk policy
6. dispatch confirmation

This can use an opened folio or preparation table, but it should not feel like navigating several unrelated admin screens.

The final dispatch view should make the important tradeoffs visible:

- known danger
- who is going
- what important tools are being risked
- selected policy
- expected return window

Do not expose fake numerical precision if the underlying system cannot justify it.

## 6. Active expeditions

An active expedition should be understandable at a glance.

Show:

- destination
- dispatched companion(s)
- elapsed / expected return state
- whether the expedition is still underway, overdue, or resolved

Avoid a live tactical simulation. Waiting should preserve anticipation rather than invite constant tapping.

If the expedition is overdue, do not immediately explain everything before the report has resolved. Uncertainty can be part of the experience.

## 7. Return and report flow

A returned expedition should create a visible change in the Hearth.

The first result layer should show:

- returned / delayed / missing / failed
- injuries
- important loot
- new knowledge / destination
- one notable event

Then allow the player to open the chronological report.

The report should feel like news from people who were away, not a combat results modal.

After reading it, the next useful actions should be obvious:

- secure / inspect loot
- treat someone
- inspect a new place
- prepare rescue
- change equipment
- dispatch again

## 8. Wall map / Discovery Journal

The wall map remains the physical home for accumulated world knowledge.

It should distinguish:

- known / explored areas
- newly discovered destinations
- destinations available for expedition
- places changed by prior expeditions
- rescue / rumor / regional-event relevance where implemented

The map should not become Google Maps or an exact navigation surface.

## 9. Secured loot and equipment

Returned physical rewards belong in the Hearth.

The loot area should support:

- what came back
- what is secured
- what is currently assigned to companions
- what is available for the next dispatch

Equipment comparison should emphasize expedition effects and available branches, not legacy action-combat rhythm.

## 10. Recovery and absence

Failure states should be legible in the room.

Useful presentation targets:

- injured companion resting
- recovery-time note
- empty place for a missing companion
- lost or damaged equipment annotation
- rescue lead added to the map

This makes failure feel like a world change rather than only a red error card.

## 11. Progression should change the room

The Hearth may become more useful or inhabited as the player survives.

Future progression can visibly add:

- better map storage / expedition planning
- more beds / treatment capacity
- better equipment storage
- scouting information
- recovery capabilities
- visitors / merchants / specialists later

Do not commit to the previous Renown milestone effects if they only served legacy action combat. Reuse or rebalance them only when they support the new loop.

## 12. Interaction rule

Small interactions may exist just to make the Hearth feel inhabited.

Examples:

- stir the fire
- inspect a returned item
- tap a companion for a short line
- open the map
- inspect the report ledger
- notice an empty bed after someone goes missing

They must not become daily chores, mandatory collection clicks, or a separate economy loop.

## 13. Visual rule

Maintain the existing manuscript / woodcut Canon.

Avoid:

- glossy mobile-RPG panels
- hero-card grids
- blue / purple / orange rarity framing
- large permanent dashboard tiles
- duplicated physical objects plus UI cards representing the same state

Prefer:

- physical objects
- ink annotations
- restrained folios
- state changes visible in the room
- compact, readable mobile interaction

## 14. Accessibility and responsive contract

Major Hearth interactions must work with:

- mouse
- keyboard focus
- touch

Do not rely on hover alone.

Respect `prefers-reduced-motion`.

At phone width:

- no horizontal scroll
- destination / dispatch / report actions remain reachable
- labels do not obscure companions or major objects
- detailed folios may scroll vertically instead of clipping

## 15. State authority

The Hearth presents authoritative game state; it does not invent a parallel model.

Authoritative systems include:

- companions and conditions
- discovered places
- active expeditions
- expedition reports
- secured inventory
- equipment assignments
- Grey Hearth safe state
- persistent world knowledge

Presentation may reorganize how these are shown but must not duplicate truth.

## 16. Success criteria

The Hearth direction is successful when:

- opening Crownless feels like returning to a place
- the player can immediately see whether an expedition changed state
- returned / injured / missing companions are emotionally legible
- reading a report naturally leads to the next preparation decision
- the player can dispatch again without navigating a large management dashboard
- newly discovered places feel connected to the wall map
- secured loot visibly belongs to the safe place
- the room remains usable on desktop and phone

The key standard is:

> **Does the Hearth make me care who came home and make it easy to send the next expedition?**