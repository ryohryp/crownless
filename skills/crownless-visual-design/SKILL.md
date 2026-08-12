---
name: crownless-visual-design
description: Apply Crownless's canonical living-medieval-manuscript visual language to concept art, image generation, UI, HUD, maps, combat presentation, Grey Hearth presentation, items, icons, effects, characters, enemies, and visual reviews. Use whenever a task creates, edits, implements, or evaluates Crownless visuals.
---

# Crownless Visual Design

## Mandatory sources

Before any Crownless visual task, read in this order:

1. `../../docs/visual-design-guide-v0.2.md` — canonical visual rules
2. **inspect** `../../docs/assets/crownless-visual-design-reference-v0.1.jpg` — canonical visual reference image
3. `../../docs/game-system-design.md` — gameplay contract
4. relevant subsystem spec:
   - exploration / maps: `../../docs/exploration-location-spec.md`
   - combat: `../../docs/combat-presentation-spec.md`
   - Grey Hearth: `../../docs/hearth-presentation-spec.md`

The image is not optional context. It is the visual calibration target.

If prose permits multiple interpretations, choose the interpretation that stays in the **same illustration family as the canonical reference image**.

Gameplay specs remain authoritative for controls and behavior.

## North star

> **Crownless is a playable medieval manuscript: rough hand-inked figures and places, woodcut texture, a world that gains knowledge and restrained color, and action expressed through physical ink.**

## Character lock

This is the highest-risk drift area.

Match the canonical reference image's **CHARACTERS** row and battle figures.

Characters are:

- approximately **4–5 heads tall**
- compact but **not chibi**
- stylized but **not cute mascot characters**
- simple-faced and restrained in expression
- rough / folk-art / medieval-manuscript in anatomy and contour
- readable primarily through silhouette, stance and equipment
- drawn with irregular black ink and restrained interior detail

Prefer weathered asymmetry, patched cloth, crude shields, wrapped hands, scavenged equipment and silhouette-changing gear.

### Reject character drift immediately

Reject and redo if characters become:

- realistic 7–8-head-tall fantasy concept art
- painterly fantasy illustration
- modern chibi / super-deformed
- cute indie-RPG mascots
- anime-gacha
- clean vector cartoons
- generic pixel-block prototype figures when a manuscript actor is intended

**More stylized does not mean cuter.**

Do not rationalize a generated character that belongs to a different illustration family than the reference image.

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

Use the canonical reference image as the target relationship between parchment battlefield, compact manuscript figures, black-ink attacks, vermilion warning marks and sparse UI.

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
2. Inspect the canonical reference image.
3. Identify the exact reference region governing the requested asset or screen.
4. Preserve the reference's character and line grammar before adding scene details.
5. Preserve actual gameplay composition and controls.
6. Add semantic palette rules.
7. Add explicit negative constraints.
8. Generate.
9. Compare the result back to the canonical image.
10. Reject and regenerate if the illustration family drifted.

### Prompt anchor

Use wording equivalent to:

> **A playable medieval-fantasy game in Crownless's canonical visual grammar: rough medieval manuscript and woodcut linework, parchment negative space, restrained muted color, compact 4–5-head-tall non-chibi figures, small simple restrained faces, weathered asymmetric equipment, readable silhouettes, physical black-ink action marks, and sparse annotation-like UI.**

### Negative anchor

Always include the substance of:

- not photorealistic
- not realistic fantasy concept art
- not painterly
- not modern chibi
- not cute mascot style
- not anime-gacha
- not clean vector cartoon
- not generic Diablo imitation
- not glossy mobile RPG UI
- no neon magic by default

## Implementation workflow

1. Preserve gameplay logic.
2. Compare the existing implementation against the canonical reference image.
3. Fix **silhouette / actor drawing grammar before surface filters**.
4. Prefer reusable low-cost techniques: sprites / illustrated layers, Canvas / SVG, paper and ink textures, limited color tokens, masks, small particles and the existing projected combat plane.
5. Check at phone size.
6. Remove decoration that competes with gameplay.

Do not claim a screen matches the visual guide merely because it has parchment colors or a paper filter while the character silhouettes remain generic.

## Acceptance gate

A visual is accepted only when all critical checks pass:

- playable game screen, not merely concept art
- characters match the canonical 4–5-head manuscript proportion
- faces are restrained, not cute / anime-like
- silhouettes read at phone size
- linework belongs to the same hand-inked / woodcut family
- color has semantic purpose
- physical ink effects replace generic glow where appropriate
- actual gameplay contract is preserved
- the result visibly belongs beside the canonical reference image
- it remains recognizable as Crownless without the logo

If the character style or overall illustration family does not match the reference image, **reject it before polishing**.
