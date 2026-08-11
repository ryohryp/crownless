---
name: crownless-visual-design
description: Apply Crownless's canonical living-medieval-manuscript visual language to concept art, image generation, UI, HUD, maps, combat presentation, Grey Hearth presentation, items, icons, effects, and visual reviews. Use whenever a task creates, edits, implements, or evaluates Crownless visuals.
---

# Crownless Visual Design

## Purpose

Use this skill whenever work touches the visual identity of Crownless.

Typical triggers:

- create or revise a Crownless image / concept art / style board
- implement or restyle UI, HUD, CSS, Canvas, SVG, sprites, or visual effects
- design combat, exploration, Grey Hearth, inventory, loot, reports, icons, characters, enemies, or maps
- review whether an existing screen or generated image feels like Crownless
- translate visual concepts into a prototype-friendly implementation

## Source of truth

Before making visual decisions, read:

1. `../../docs/visual-design-guide-v0.1.md` — canonical visual language
2. `../../docs/game-system-design.md` — gameplay contract
3. the relevant subsystem spec when the task touches it:
   - exploration / maps: `../../docs/exploration-location-spec.md`
   - combat: `../../docs/combat-presentation-spec.md`
   - Grey Hearth: `../../docs/hearth-presentation-spec.md`

If visual styling conflicts with gameplay behavior, gameplay and subsystem specifications win.

## North star

> **Crownless is a rough medieval manuscript that becomes a living world as the player explores, fights in strokes of ink, survives, and brings color and evidence of life back to the Grey Hearth.**

The desired identity is not merely “dark fantasy.” It is:

> **living medieval manuscript × woodcut × evolving fantasy map × physical action RPG**

## Non-negotiable visual grammar

### Rendering

- stylized 2D / 2.5D, never photorealistic as the target
- irregular hand-inked outlines
- parchment negative space
- woodcut / crosshatched shadows
- flat or lightly textured color planes
- 4–5-head-tall characters with readable silhouettes
- simplified materials and intentionally imperfect geometry
- enough depth for gameplay, but the result must still feel illustrated

### Palette

Use color semantically:

- ink black / charcoal — structure, unknown, linework
- bone / parchment — readable neutral field
- ash grey — uncertainty, stone, fog
- vermilion / muted朱赤 — danger, wounds, enemy telegraphs
- ember orange — Grey Hearth, safety, secured progress
- faded blue-green — discovered land, routes, recovered world knowledge
- dull ochre / restrained gold — rare earned significance

Color is earned information. Avoid saturating everything.

### Characters and enemies

- player begins anonymous, poor, patched, asymmetrical, and visibly under-equipped
- gear should change silhouette over time
- fists must look intentional, not like missing equipment
- enemy roles must read from silhouette and posture
- monsters may borrow the strange proportions and unsettling logic of medieval bestiaries
- prefer memorable wrongness over realistic creature anatomy

### UI

UI should feel annotated, stamped, scratched, or attached to a manuscript.

Prefer:

- ink rules
- stamps / seals
- parchment or dark ink fields
- short labels
- distressed but restrained edges
- simple manuscript glyphs

Avoid:

- thick beveled metal frames
- glossy cards
- jewel chrome
- giant gold borders
- generic mobile-RPG dashboard layouts

### Loot and rarity

Do not default to blue / purple / orange rarity-card language.

Prefer significance through accumulated marks:

- ordinary — no special mark
- refined — maker stamp / seal
- rare — crest / provenance mark / distinctive ink treatment
- signature — handwritten epithet / unique emblem / bespoke illustration treatment

Color may support rarity but must not be the only signal.

## Screen-specific rules

### Exploration

The map is the game surface, not a decorated menu.

Unknown territory should look unfinished. Discovery should feel like the manuscript gaining knowledge:

1. terrain lines appear
2. routes are drawn
3. symbols emerge
4. names / notes are written or stamped
5. restrained local color returns

Do not make the result look like Google Maps with fantasy icons.

### Combat

Preserve the fixed oblique top-down battlefield and current stand-to-strike model.

Phone controls remain:

- drag on arena to move
- stop to auto-strike
- **技**
- **回避**

Never add merely for convention or concept-art polish:

- virtual joystick
- light-attack button
- large skill cluster
- combat minimap
- party portrait stack
- permanent hotbar

Combat expression:

- normal trails = short black ink strokes
- impacts = ink splashes / broken hatch marks / dry brush
- enemy telegraphs = hand-drawn vermilion arcs, circles, or scratches
- perfect evade may tear / break the warning mark
- Technique / 決着 can use wider, stronger ink language but must not become generic neon magic

### Grey Hearth

The Hearth is a sparse safe page that becomes inhabited because the player survived.

Progress should appear as new physical illustration:

- map marks
- shelf contents
- recovery cache
- forge fire
- tools and signs of repeated use

Do not turn progression into a grid of feature buttons.

### Inventory and reports

Treat items as a field ledger / relic catalogue rather than collectible cards.

Return / defeat screens should clearly annotate:

- secured
- unsecured
- lost
- newly discovered
- changed in the Hearth

## Image-generation workflow

When producing a Crownless image reference:

1. Read the canonical guide and relevant subsystem spec.
2. State the visual identity before scene details.
3. Describe the gameplay composition and information hierarchy.
4. Add the manuscript / woodcut rendering rules.
5. Add the semantic palette.
6. Add explicit negative constraints.
7. For combat, explicitly preserve the real control contract.
8. After generation, review the output against the rejection test before treating it as a reference.

### Core prompt anchor

Use wording equivalent to:

> A playable medieval-fantasy world illustrated like a living medieval manuscript and woodcut print, with irregular hand-inked linework, parchment negative space, crosshatched shadows, limited muted color, compact 4–5-head-tall characters, readable game silhouettes, physical ink-like action effects, and restrained annotation-like UI; stylized 2D/2.5D, not realistic 3D.

### Negative anchor

Always guard against:

- photorealism
- realistic AAA 3D
- generic Diablo imitation
- glossy mobile RPG UI
- anime-gacha card language
- oversized ornate gold framing
- neon magical VFX by default
- excessive particles
- overly detailed environment clutter

## Implementation workflow

When implementing the visual language in code:

1. Preserve current gameplay logic first.
2. Reuse shared tokens and treatments instead of one-off screen styling.
3. Prefer cheap reusable techniques:
   - SVG / Canvas linework
   - sprite layers
   - CSS masks / textures
   - shared ink / paper assets
   - limited palette tokens
   - procedural reveal masks
   - small particles
   - projection / transforms rather than engine rewrites
4. Prototype the visual effect at playable scale.
5. Check readability on phone-sized layouts.
6. Remove decoration that competes with gameplay.

Do not build a production art pipeline before the visual idea proves fun and readable.

## Review workflow

Evaluate every candidate visual with these questions:

1. Does it feel illustrated rather than realistically rendered?
2. Does it clearly express the living-manuscript / woodcut identity?
3. Are silhouettes readable at phone size?
4. Does color carry meaning rather than decoration?
5. Is UI annotation-like instead of glossy and card-heavy?
6. Does combat use ink / physical impact rather than default glowing VFX?
7. Does exploration look like knowledge being added to a map?
8. Does Grey Hearth progression appear physically in the space?
9. Does equipment feel scavenged and earned rather than heroic-by-default?
10. Can an individual developer approximate the idea without a AAA pipeline?
11. Does the visual preserve actual controls and game-state behavior?
12. **Would it still be recognizably Crownless without the logo?**

If several answers are no, do not polish the generic result. Push the identity harder first.

## Rejection test

The strongest final check is simple:

> **If another dark-fantasy RPG could use the same image by swapping the logo, reject it as insufficiently Crownless.**
