# ADR 0014 — Connected path tiles for the living neighborhood map

- **Status:** Accepted / implemented as first playable presentation slice
- **Date:** 2026-10-14
- **Builds on:** `AGENTS.md`, ADR 0001 (real-world discovery), ADR 0008 (fog, regional POIs and place memory, subject to newer product direction), ADR 0009 (phone readability), ADR 0011 (location-based sandbox play), and `docs/visual-canon.md`.
- **Implementation reference:** [PR #1002](https://github.com/ryohryp/crownless/pull/1002), merged 2026-10-14. The initial renderer is `src/nearby-home-view.js`.

## Context

The former neighborhood map presented discovered places largely as separate cards. Their names and actions were available, but the view did not communicate how the places belonged to one explorable world. The user requested an **Orna-like sense of a fantasy field** and, if a square grid was retained, **チクタクバンバン-like tiles whose roads join at their edges**.

After PR #1002 replaced the card-list map with an interlocking tile board, the user reported that it was easier to understand. That is positive feedback about *spatial legibility*, not yet evidence that the player wants another expedition.

## Decision

**The primary living-neighborhood overview is a spatial fantasy map made of adjoining terrain tiles, with visibly continuous fictional roads, rather than a paginated list of independent place cards.** The map should make the next unknown area feel nearby while keeping already discovered places and their useful actions clear.

1. **Continuity first:** Adjacent tiles align at their edges. Roads, bends and junctions read as one connected network; discovered land should not look like unrelated stamps. Terrain (forest, wetland, tower, ruins, etc.) and meaningful place silhouettes remain distinguishable without reading every label.
2. **Discovery is earned:** Undiscovered land remains veiled. A hint of terrain, distant structure or road continuation may invite curiosity, but must not automatically reveal a hidden route, a precise secret entrance or an unearned POI. The player's actual discovered-place records remain authoritative.
3. **Places are actionable:** A revealed district remains selectable, with its shop/event, expedition, claimed flag, NPC trace and other applicable actions accessible. Preserve concise selected-place feedback and touch-friendly controls on roughly 360–430 CSS px screens. Map decoration must not obscure those actions.
4. **Separate fantasy layout from physical navigation:** Connecting lines are **fictional presentation**, not real streets, safe walking directions, turn-by-turn routing or evidence of live GPS. Selecting a tile does not imply the player physically occupies it. New discoveries still obey explicit, stationary location interaction and coarse identity/privacy rules. Recognized distant landmarks must not be forced into a misleading local grid.
5. **Do not add a second movement game:** The tile motif does not require sliding pieces, a timer, pathfinding, tile-by-tile movement, or simulated walking on top of real-world discovery. Tapping a discovered location is enough to select or enter its supported gameplay.
6. **Keep the rendering replaceable:** The first implementation uses a 5×5 view centered on the selected district and connected route edges. Those dimensions, road-building algorithm and CSS/SVG technique are an implementation choice, **not a permanent world-coordinate or engine contract**. Improve the camera or terrain when playtests warrant it without changing earned discovery state.

This decision concerns the **living-neighborhood overview**. It does not impose visible navigation arrows on the dungeon/expedition exploration layer; that layer keeps the secret-path and learned-skill rules of ADR 0013. The broader visual language remains under `docs/visual-canon.md`, with its 2026-10-14 map-specific override.

## Alternatives considered

- **Keep independent place cards:** Simple to implement, but the user could not easily perceive adjacency or the larger world; rejected as the primary map (detail cards remain useful).
- **Use a literal road map/GPS route overlay:** Familiar geography, but misrepresents fictional passages and increases safety/privacy risk; rejected.
- **Make the track tiles a sliding or path-building puzzle:** Evokes the toy more literally, but introduces an unrelated mechanic before the exploration loop is fun; deferred.
- **Show every path and destination in advance:** Improves navigation at the cost of discovery and hidden-path mystery; rejected.

## Validation and next iteration

- **Implemented:** PR #1002 replaced the card list with 25 visible terrain tiles, connected SVG path segments, selectable discovered places, obscured unknown land and retained local actions. The corresponding automated route-continuity, UI and phone-browser checks passed before and after merge.
- **Human observation:** The user's first response was that the new map was **easier to understand**. No claim is made yet about replay motivation or outdoor usability.
- **Next test:** On an actual phone, can the player recognize their current selection, choose an earned POI without confusion, and form a hypothesis about what lies beyond the fog? After a new discovery, do they *want* to inspect one more area or embark on an expedition?
- **Smallest follow-up hypothesis:** Try one restrained curiosity cue (e.g. a partial ruin silhouette or road disappearing into mist), and verify that it motivates inspection without disclosing a secret or misleading the player about real-world travel. Do not build a procedural road/terrain platform first.

## Consequences

**Benefits:** Greater spatial readability, a recognizable connected world, and a place for discovery, shops, traces and conquest to accumulate visually.

**Risks:** Fictional roads may be mistaken for traversable routes; dense tile details can clutter phone screens; too much fog can hide usable actions, while too much preview can spoil discovery. Mitigate with explicit map labeling, clear selection states, accessibility and human playtests.

**Not authorized:** Continuous GPS tracking; storing actual movement routes; real-world navigation; mandatory in-game grid traversal; auto-revealed hidden passages; a new puzzle/engine system; or replacing the existing safe-return and crafting progression loop.
