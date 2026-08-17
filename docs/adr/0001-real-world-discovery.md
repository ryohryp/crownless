# ADR 0001: Real-world movement feeds discovery, not duplicate travel

Status: Accepted

## Decision

Real-world movement will eventually feed Crownless's discovery layer. In-game exploration should present discovered places and meaningful risk/opportunity choices directly.

The game must not require routine node-by-node movement merely to reach already discovered playable content.

## Consequences

- The current prototype uses deterministic simulated discovery.
- Encounter, dungeon, loot, and return systems remain independent of the future GPS implementation.
- `h3-js` is the first library to evaluate when GPS enters scope; it is not required for the current prototype.
- A world map may visualize revealed territory and history, but it is presentation/context unless a map interaction itself creates a meaningful decision.
