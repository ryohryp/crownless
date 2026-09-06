# Legacy actor presentation reference

Read this only when the current task explicitly authorizes maintenance or repurposing of existing actor presentation. This file preserves useful rendering and integrity checks; it does not authorize new real-time combat work.

Before any real-time combat change, establish that the current issue and Canon decision satisfy the Historical combat rule in AGENTS.md. An old asset or renderer alone is not authorization.

[AGENTS.md](../../../AGENTS.md) and the [current gameplay Canon](../../../docs/game-system-design.md) control scope. [The old combat presentation spec](../../../docs/combat-presentation-spec.md) is historical implementation context only. Apply each check only where that rendering mode exists; Hearth companions, portraits, and expedition reports do not inherit a battlefield camera or enemy HUD.

Resolve current asset roles in [Character Visual Canon](../../../docs/visual/CHARACTER_VISUAL_CANON.md) before using a file. Being stored under `assets/combat/minimal-v0.1/actors/` does not make every file an Approved Anchor or runtime-eligible.

## Combat viewpoint lock

When the asset is a combat actor, also match the gameplay camera in the source art:

- oblique top-down / three-quarter view
- slightly visible upper planes of head / shoulders / equipment where appropriate
- grounded foot placement
- reduced straight-on portrait information
- role action readable on the diagonal battlefield

Do not generate a front-facing standing portrait and expect implementation to skew it into the combat view later.

## Enemy role silhouettes

- **Rusher:** forward lean, aggressive compact mass, fast melee weapon
- **Guard:** wide planted block, shield-dominant silhouette
- **Skirmisher:** narrower mobile shape, bow / ranged-read silhouette

Role identity must read without labels at phone size.

## Actor integration lock

When implementing or reviewing illustrated actor sprites:

- project the actor's **foot / ground position** into the arena
- render the body above that point in screen / billboard space
- use one uniform scale for X and Y
- never apply arena floor skew / squash / non-uniform projection to the body
- calculate size from visible / alpha content bounds, not raw square PNG dimensions
- transparent padding must not make a sprite smaller, thinner, or offset
- use an authored pivot when available; otherwise bottom-center of visible content bounds
- keep foot pivot, logical combat position, and shadow aligned
- preserve role-specific visible width: Guard broad, Skirmisher narrow, Rusher compact
- if bounds are poor, trim / alpha-crop; never compensate with X-only or Y-only stretch

If accepted source art looks tall/thin, squat/wide, skewed, compressed, or otherwise differently proportioned in-game, classify it as a rendering defect.

## Oblique overlap lock

For ground-bound combatants in the oblique view:

- depth-sort by projected **foot / ground Y**
- draw farther / smaller Y first and nearer / larger Y later
- use a stable tie-breaker to prevent flicker
- do not mutate simulation update order merely to change visual overlap
- include still-visible dead / falling actors in the same presentation ordering

## Crowded enemy HUD lock

When enemies cluster:

- preserve silhouettes before labels
- priority threat / nearest enemy and bosses may show name + HP
- ordinary non-priority enemies should prefer compact HP only
- treat HUDs as rectangles with width / height
- avoid other HUD rectangles and nearby actor silhouette regions
- resolve with small vertical lanes first, then restrained horizontal nudges
- keep HP background and fill on one resolved placement
- reset HUD occupancy each frame
- do not push combatants apart in simulation just to make labels fit

Review at least one three-enemy cluster before approving a HUD or overlap change.

## Combat asset integrity lock

A runtime visual glitch may come from the PNG, not renderer math.

For every new or replaced combat actor PNG:

1. confirm the file is a decodable PNG
2. confirm supported bit depth / color format for the current pipeline when applicable
3. inspect non-transparent pixel coverage
4. inspect visible alpha bounds for unexpectedly empty / narrow / short silhouettes
5. do **not** use compressed file byte size as the validity criterion
6. if runtime shows colored garbage, missing body, or only shadow / label, inspect the asset before changing transforms
7. add or extend automated integrity coverage for the changed actor where practical

Do not hide a corrupt sprite with renderer hacks.

## Phone-size actor review

Verify:

- source and rendered head/body proportion match
- combat source art matches oblique viewpoint
- no vertical stretching or horizontal squeezing
- no non-uniform X/Y scaling
- role silhouette width remains intact
- feet and shadow meet logical ground point
- near/far overlap follows foot-Y depth
- priority HP/name labels clear the actor silhouette
- non-priority labels stay quiet in clusters
- effects do not obscure role-defining shape
- actor PNG is intact and visibly non-empty
- apparent size is readable without consuming the arena

A source PNG looking correct is not sufficient. Runtime composition is the acceptance target.

For replacement transparent sprites, verify genuine transparent pixels and inspect the background for baked checkerboards. RGBA mode alone is insufficient. For animation, inspect every frame and distinguish temporal frames from direction variants; resolve current frame dimensions, actions, and authored pivots from the asset contract.
