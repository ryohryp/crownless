---
name: crownless-visual-design
description: Apply Crownless's canonical living-medieval-manuscript visual language to concept art, image generation, UI, HUD, maps, combat presentation, Grey Hearth presentation, items, icons, effects, characters, enemies, and visual reviews. Use whenever a task creates, edits, implements, or evaluates Crownless visuals.
---

# Crownless Visual Design

## Mandatory sources

Before any Crownless visual task, read in this order:

1. `../../docs/visual-design-guide-v0.2.md` — canonical visual rules
2. inspect `../../docs/assets/crownless-visual-design-reference-v0.1.jpg` — canonical environment / line / palette reference
3. inspect `../../assets/combat/minimal-v0.1/actors/` when characters appear — canonical character deformation reference
4. `../../docs/game-system-design.md` — gameplay contract
5. relevant subsystem spec:
   - exploration / maps: `../../docs/exploration-location-spec.md`
   - combat: `../../docs/combat-presentation-spec.md`
   - Grey Hearth: `../../docs/hearth-presentation-spec.md`

The v0.1 style board remains authoritative for linework, palette, materials, map/UI grammar and physical ink effects. The accepted combat actor set supersedes its older 4–5-head character proportion.

Gameplay specs remain authoritative for controls and behavior.

## North star

> **Crownless is a playable medieval manuscript: rough hand-inked figures and places, woodcut texture, a world that gains knowledge and restrained color, and action expressed through physical ink.**

## Character lock

This is the highest-risk drift area.

Match the accepted actor set at `../../assets/combat/minimal-v0.1/actors/`.

Characters are:

- approximately **3–3.5 heads tall**
- strongly deformed, compact **folk-doll figures**
- large-headed with short limbs and simplified torso, hands and feet
- tiny, symbolic-faced and restrained in expression
- rough / folk-art / medieval-manuscript in anatomy and contour
- readable primarily through silhouette, stance and equipment
- drawn with irregular black ink and restrained interior detail

This deformation is intentional. **Do not correct actors toward realistic anatomy.**

Prefer weathered asymmetry, patched cloth, crude shields, wrapped hands, scavenged equipment and silhouette-changing gear.

### Face lock

Faces should use very little information:

- tiny simple eyes / brows
- little or no mouth detail
- no realistic skin texture
- no anatomical facial modeling
- no horror-like eyes or uncanny expression

The target is rough, primitive and readable rather than realistic or glossy-cute.

### Reject character drift immediately

Reject and redo if characters become:

- realistic 7–8-head-tall fantasy concept art
- semi-realistic / anatomically corrected humans
- painterly fantasy illustration
- uncanny realistic faces
- glossy modern chibi / cute SD mascots
- anime-gacha
- clean vector cartoons
- generic pixel-block prototype figures when a manuscript actor is intended

**Strong deformation is correct. Glossy cuteness and human realism are not.**

## Enemy role silhouettes

Humanoid enemies normally share the same 3–3.5-head deformation as the player.

- **Rusher:** forward lean, aggressive compact mass, fast melee weapon
- **Guard:** wide planted block, shield-dominant silhouette
- **Skirmisher:** narrower mobile shape, bow / ranged-read silhouette

Role identity must be readable without labels at phone size.

## Rendering grammar

- stylized 2D / 2.5D
- irregular hand-inked contours
- parchment negative space
- woodcut / crosshatched shadows
- flat or lightly textured muted color planes
- imperfect geometry
- physical marks rather than glossy effects

Avoid photorealism, realistic AAA 3D, PBR materials, painterly concept art, smooth vector-cartoon treatment and excessive bloom.

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

Combat uses the fixed oblique top-down battlefield and the accepted compact actor set.

Combat expression:

- normal trails = short strong black ink strokes
- heavy / Technique = wider brush stroke, ink splash, broken hatch marks
- impact = ink scatter + body displacement + hit stop
- danger = hand-drawn vermilion arcs / circles / scratches
- perfect evade may break or scatter the warning mark

Phone controls remain:

- drag on arena to move
- stop to auto-strike
- **技**
- **回避**

Never add for convention:

- virtual joystick
- light-attack button
- large skill cluster
- combat minimap
- permanent hotbar

## Actor integration lock

When implementing or reviewing illustrated actor sprites, preserve the accepted source deformation after rendering.

Required rules:

- project the actor's **foot / ground position** into the oblique arena
- render the actor body above that point in screen space / billboard space
- use **one uniform scale** for X and Y
- never stretch width and height independently
- never apply the arena floor's skew, squash, or non-uniform projection to the actor body
- calculate apparent size from visible / alpha content bounds, not raw square PNG dimensions
- transparent padding must not make a sprite smaller, thinner, or offset
- use an authored pivot when available; otherwise anchor at bottom-center of visible content bounds
- keep the foot pivot aligned with the logical combat position and shadow
- preserve role-specific visible width; Guard should remain broad, Skirmisher narrow, Rusher compact
- if source bounds are poor, trim/preprocess or alpha-crop; **do not compensate by X-only or Y-only stretching**

If the accepted 3–3.5-head source art looks tall/thin, squat/wide, skewed, compressed, or otherwise differently proportioned in the actual game, classify it as a rendering defect.

## Exploration rules

The map is the game surface and should look like a manuscript gaining knowledge.

Unknown = ink / ash / blank parchment / unfinished routes.

Discovery should visibly add:

1. terrain lines
2. route strokes
3. POI symbols
4. names / notes
5. restrained faded blue-green color

Do not make themed Google Maps.

## Grey Hearth rules

The Hearth is a sparse safe page that becomes inhabited because the player survived.

Secured progress should add physical illustration: fire, map marks, shelf contents, recovery cache, tools, forge and signs of repeated use.

Do not turn it into a generic management dashboard or luxury tavern.

## UI rules

UI should feel written, stamped, scratched or attached to the manuscript.

Prefer parchment / dark ink fields, thin irregular rules, stamps, seals, manuscript glyphs and restrained distressed edges.

Avoid glossy rounded cards, beveled metal, jewel chrome, giant gold borders and generic mobile-RPG dashboards.

## Image-generation workflow

1. Read the v0.2 guide.
2. Inspect the v0.1 style board.
3. If characters appear, inspect the accepted actor set.
4. Identify the exact reference governing each part of the requested asset or screen.
5. Preserve the 3–3.5-head folk-doll deformation before adding scene details.
6. Preserve actual gameplay composition and controls.
7. Add semantic palette rules.
8. Add explicit negative constraints.
9. Generate.
10. Compare the result back to the accepted actors and reject drift.

### Prompt anchor

Use wording equivalent to:

> **A playable medieval-fantasy game in Crownless's canonical visual grammar: rough medieval manuscript and woodcut linework, parchment negative space, restrained muted color, strongly deformed 3–3.5-head-tall folk-doll figures with large heads and short limbs, tiny symbolic faces, weathered asymmetric equipment, readable silhouettes, physical black-ink action marks, and sparse annotation-like UI.**

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

## Implementation workflow

1. Preserve gameplay logic.
2. Compare the existing implementation against the canonical references.
3. Fix **silhouette / deformation / actor drawing grammar before surface filters**.
4. For actor sprites, inspect the actual runtime transform chain before changing asset art.
5. Project actor position into the arena, but keep the illustrated actor body in screen space with uniform X/Y scale.
6. Use visible / alpha bounds and a stable foot pivot; do not size from raw square PNG bounds.
7. Prefer reusable low-cost techniques: sprites / illustrated layers, Canvas / SVG, paper and ink textures, limited color tokens, masks, small particles and the existing projected combat plane.
8. Check the result at an actual phone-size viewport.
9. Compare the rendered body proportion directly with the accepted source actor.
10. Remove decoration that competes with gameplay.

Do not claim a screen matches the visual guide merely because it has parchment colors or a paper filter while the character silhouettes remain generic or distorted.

## Phone-size actor review

For every actor integration or renderer change, verify from a phone screenshot or equivalent mobile viewport:

- source and rendered head/body proportion match
- no vertical stretching or horizontal squeezing
- no non-uniform X/Y scaling
- role silhouette width remains intact
- feet and shadow meet the logical ground point
- HP/name labels clear the actor silhouette
- effects do not obscure the actor's role-defining shape
- apparent size is large enough to read but does not consume the arena

A source PNG looking correct is **not sufficient**. Runtime composition is the acceptance target.

## Acceptance gate

A visual is accepted only when all critical checks pass:

- playable game screen, not merely concept art
- humanoid characters match the accepted **3–3.5-head folk-doll proportions**
- faces are tiny and symbolic, not realistic, creepy, cute-mascot or anime-like
- silhouettes read at phone size
- runtime actor proportions match the accepted source art without X/Y stretching, floor-projection distortion, or transparent-padding shrinkage
- feet / shadows align with logical ground position
- linework belongs to the same hand-inked / woodcut family
- color has semantic purpose
- physical ink effects replace generic glow where appropriate
- actual gameplay contract is preserved
- the result visibly belongs beside the accepted actor set
- it remains recognizable as Crownless without the logo

If the character style, runtime proportion, grounding, or overall illustration family does not match the accepted actors, **reject it before polishing**.
