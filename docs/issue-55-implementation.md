# Issue #55 implementation summary

The exploration interaction has been simplified around direct discovered destinations.

Removed from the active presentation:

- 9x9 fog-grid traversal
- frontier-cell reveal clicks
- travel-to-known-cell clicks
- separate map persistence for duplicate movement state

Preserved:

- existing deterministic lead generation
- risk/reward/signal information on destination cards
- encounter and non-combat event entry
- hunts and dungeons through the existing lead actions
- unsecured loot and push/return tension
- the Grey Hearth return loop

The direct presentation exposes up to three generated destinations. This is intentionally small so the player is choosing among meaningful opportunities rather than managing a map.
