---
name: crownless-visual-design
description: Apply Crownless's canonical living-medieval-manuscript visual language to concept art, image generation, UI, HUD, maps, combat presentation, Grey Hearth presentation, items, icons, effects, characters, enemies, and visual reviews. Use whenever a task creates, edits, implements, or evaluates Crownless visuals.
---

# Crownless Visual Design

## Mandatory sources

Before any Crownless visual task, read in this order:

1. `../../docs/visual-design-guide-v0.2.md` — canonical visual rules
2. inspect `../../docs/assets/crownless-visual-design-reference-v0.1.jpg` — global line / palette / material calibration
3. inspect `../../assets/combat/minimal-v0.1/actors/` when combat characters appear — current character proportion / silhouette / combat-view authority
4. `../../docs/game-system-design.md` — gameplay contract
5. relevant subsystem spec:
   - exploration / maps: `../../docs/exploration-location-spec.md`
   - combat: `../../docs/combat-presentation-spec.md`
   - Grey Hearth: `../../docs/hearth-presentation-spec.md`
6. for named combat subject generation, also read `../../docs/visual/CHARACTER_VISUAL_CANON.md`
7. before invoking an image generator for a production asset, read `../../docs/visual/IMAGE_GENERATION_HANDOFF.md`

Older v0.1 boards remain authoritative for linework, palette, materials, map/UI grammar, and physical ink effects. The accepted combat actor set supersedes older 4–5-head proportion guidance and controls the current combat-character viewpoint.

Gameplay specs remain authoritative for controls and behavior.

## North star

> **Crownless is a playable medieval manuscript: rough hand-inked figures and places, woodcut texture, a world that gains knowledge and restrained color, and action expressed through physical ink.**

## Character lock

Match the accepted actor set at `../../assets/combat/minimal-v0.1/actors/`.

Characters are:

- approximately **3–3.5 heads tall**
- strongly deformed, compact **folk-doll figures**
- large-headed with short limbs and simplified torso, hands, and feet
- tiny symbolic faces and restrained expression
- rough folk-art / medieval-manuscript anatomy and contour
- readable primarily through silhouette, stance, and equipment
- irregular black ink with restrained interior detail

This deformation is intentional. **Do not correct actors toward realistic anatomy.**

### Combat viewpoint lock

When the asset is a combat actor, also match the gameplay camera in the source art:

- oblique top-down / three-quarter view
- slightly visible upper planes of head / shoulders / equipment where appropriate
- grounded foot placement
- reduced straight-on portrait information
- role action readable on the diagonal battlefield

Do not generate a front-facing standing portrait and expect implementation to skew it into the combat view later.

### Face lock

- tiny simple eyes / brows
- little or no mouth detail
- no realistic skin texture
- no anatomical facial modeling
- no horror-like eyes or uncanny expression

Target rough, primitive, and readable rather than realistic or glossy-cute.

### Reject character drift immediately

Reject and redo if characters become:

- realistic 7–8-head fantasy concept art
- semi-realistic / anatomically corrected humans
- painterly fantasy illustration
- uncanny realistic faces
- glossy modern chibi / cute SD mascots
- anime-gacha
- clean vector cartoons
- front-facing portrait sprites for oblique combat

**Strong deformation is correct. Glossy cuteness and human realism are not.**

## Enemy role silhouettes

- **Rusher:** forward lean, aggressive compact mass, fast melee weapon
- **Guard:** wide planted block, shield-dominant silhouette
- **Skirmisher:** narrower mobile shape, bow / ranged-read silhouette

Role identity must read without labels at phone size.

## Rendering grammar

- stylized 2D / 2.5D
- irregular hand-inked contours
- parchment negative space
- woodcut / crosshatched shadows
- flat or lightly textured muted color planes
- imperfect geometry
- physical marks rather than glossy effects

Avoid photorealism, realistic AAA 3D, PBR materials, painterly concept art, smooth vector-cartoon treatment, and excessive bloom.

## Semantic palette

- ink black / charcoal — line, structure, unknown
- bone / parchment — neutral readable field
- ash grey — fog, stone, uncertainty
- muted vermilion — danger, wounds, enemy telegraphs
- ember orange — Grey Hearth, safety, secured progress
- faded blue-green — discovered land / knowledge
- dull ochre — earned significance

Color is information, not decoration.

## Combat rules

Combat uses the fixed oblique top-down battlefield and accepted compact actor set.

Combat expression:

- normal trails = short strong black ink strokes
- heavy / Technique = wider brush stroke, ink splash, broken hatch
- impact = ink scatter + body displacement + hit stop
- danger = hand-drawn vermilion arcs / circles / scratches
- perfect evade may break or scatter the warning mark

Phone controls remain drag movement, stop to auto-strike, **技**, and **回避**. Never add joystick, light-attack button, large skill cluster, combat minimap, or permanent hotbar by convention.

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

## Exploration rules

The map is the game surface and should look like a manuscript gaining knowledge.

Unknown = ink / ash / blank parchment / unfinished routes.

Discovery visibly adds terrain lines, routes, POI symbols, names / notes, and restrained faded blue-green color.

Do not make themed Google Maps.

## Grey Hearth rules

The Hearth is a sparse safe page that becomes inhabited because the player survived.

Secured progress should add physical illustration: fire, map marks, shelf contents, recovery cache, tools, forge, and signs of repeated use.

Do not turn it into a generic management dashboard or luxury tavern.

## UI rules

UI should feel written, stamped, scratched, or attached to the manuscript.

Prefer parchment / dark ink fields, thin irregular rules, stamps, seals, manuscript glyphs, and restrained distressed edges.

Avoid glossy rounded cards, beveled metal, jewel chrome, giant gold borders, and generic mobile-RPG dashboards.

## Image-generation workflow

1. Read the v0.2 guide.
2. Inspect the global visual reference.
3. If characters appear, inspect accepted actors.
4. If combat characters appear, explicitly lock the oblique top-down / 3/4 source-art viewpoint.
5. Identify the exact reference governing each requested element.
6. Preserve 3–3.5-head folk-doll deformation before scene detail.
7. Preserve actual gameplay composition and controls.
8. Add semantic palette rules and explicit negatives.
9. Build the **asset-only handoff** required by `../../docs/visual/IMAGE_GENERATION_HANDOFF.md`.
10. Generate.
11. Compare back to Canon / accepted actors and reject drift or meta-output.

### Asset-only handoff and meta-output guard

Immediately before production image generation, strip development metadata from the generation request. Keep only the requested asset identity, composition, Canon/style lock, required scene facts, allowed/forbidden changes, and reference assets that the current Canon package actually permits.

Do not feed Issue numbers, PR metadata, progress summaries, PASS/FAIL reports, dashboard descriptions, acceptance-checklist UI, tool output, or commit information into the image request unless the production asset itself explicitly requires those elements.

If the result is a GitHub/project-management screen, progress dashboard, validation card, review report, or other **meta-output** instead of the requested game asset, reject immediately. It is not a Candidate and must not become a source reference, parent, crop source, or runtime asset.

After meta-output, do not blindly retry the same request. Rebuild the handoff from repository Canon and the asset contract in a clean valid reference context. If the same wrong-reference or meta-output class repeats twice, stop generation and treat the handoff/host binding as defective.

### Prompt anchor

Use wording equivalent to:

> **A playable medieval-fantasy game in Crownless's canonical visual grammar: rough medieval manuscript and woodcut linework, parchment negative space, restrained muted color, strongly deformed 3–3.5-head-tall folk-doll figures with large heads and short limbs, tiny symbolic faces, weathered asymmetric equipment, readable silhouettes, physical black-ink action marks, and sparse annotation-like UI. Combat figures are drawn for a diagonal oblique top-down three-quarter battlefield view, not as front-facing portraits.**

### Negative anchor

Always include the substance of:

- not photorealistic
- not realistic or semi-realistic fantasy concept art
- not anatomically corrected human proportions
- not painterly
- no uncanny realistic faces or skin detail
- not glossy modern chibi / cute mascot style
- not anime-gacha
- not clean vector cartoon
- not generic Diablo imitation
- not glossy mobile RPG UI
- no neon magic by default
- no front-facing portrait pose for oblique combat actors

## Implementation workflow

1. Preserve gameplay logic.
2. Compare implementation against canonical references.
3. Fix silhouette / deformation / viewpoint / drawing grammar before surface filters.
4. For sprites, inspect actual runtime transform chain before changing art.
5. Project actor position into arena; keep body in screen space with uniform scale.
6. Use visible / alpha bounds and stable foot pivot.
7. Depth-sort overlapping actors by projected foot Y.
8. Keep crowded HUD collision-aware and simplify non-priority labels.
9. Validate changed actor PNG integrity before blaming renderer transforms.
10. Check an actual phone-size viewport.
11. Include a crowded multi-enemy case when combat overlap or HUD changed.
12. Remove decoration that competes with gameplay.

Do not claim a screen matches the guide merely because it has parchment colors or a paper filter while silhouettes, viewpoint, overlap, or runtime geometry remain wrong.

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

## Acceptance gate

A visual is accepted only when all critical checks pass:

- playable game screen when gameplay is requested
- humanoids match 3–3.5-head folk-doll proportions
- combat figures use the correct oblique source-art viewpoint
- faces are tiny and symbolic
- silhouettes read at phone size
- runtime proportions match source without X/Y stretching or floor distortion
- feet / shadows align with logical ground position
- overlapping actors depth-sort naturally
- crowded HUD does not hide the fight
- linework belongs to the hand-inked / woodcut family
- color has semantic purpose
- physical ink effects replace generic glow where appropriate
- actor assets are decodable and visibly intact
- actual gameplay contract is preserved
- result visibly belongs beside accepted actors
- it remains recognizable as Crownless without the logo

If character style, viewpoint, runtime proportion, grounding, overlap, asset integrity, illustration family, or meta-output contamination fails, **reject before polishing**.
