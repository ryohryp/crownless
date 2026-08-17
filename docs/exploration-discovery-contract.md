# Exploration discovery contract

Crownless separates **discovery** from **playable destination choice**.

## Current prototype

The browser generates deterministic expedition leads. The exploration presentation exposes at most three of them as immediately actionable discovered destinations. The player does not traverse a second in-game walking layer before entering content.

`src/discovery-provider.js` defines the provider-shaped boundary used by tests and future location work:

- input: generated leads / world context
- output: a small set of discovered places
- current implementation: deterministic simulated provider

The presentation retains a dependency-free fallback so the playable slice does not depend on script-loader ordering.

## Future GPS implementation

When real location enters scope, replace the simulated discovery source rather than the encounter/dungeon/loot loop. Evaluate `h3-js` first for stable lat/lng cells, neighborhood queries, and discovery regions.

GPS should answer **what the player has discovered by walking in reality**. It should not reintroduce mandatory node-by-node traversal inside the game.

## Non-goals

- step-count rewards
- pathfinding for routine travel
- a second movement simulation layered on top of real-world movement
- graph or procedural-map dependencies before gameplay needs them
