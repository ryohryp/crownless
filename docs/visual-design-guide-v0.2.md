# Crownless — Visual Design Guide v0.2

> **Status:** canonical global visual baseline  
> **Updated:** 2026-08-12  
> **Scope:** characters, enemies, combat, exploration, Grey Hearth, UI, loot, image generation, implementation

## 0. Canonical visual reference

The primary visual reference for Crownless is:

`docs/assets/crownless-visual-design-reference-v0.1.jpg`

When prose can be interpreted in more than one way, **match the visual grammar of this image rather than inventing a new adjacent style**.

The reference image is authoritative for:

- character proportion and degree of stylization
- facial simplification
- line weight and woodcut / manuscript character treatment
- enemy strangeness and silhouette
- combat ink effects
- map rendering language
- Grey Hearth progression language
- UI material and icon grammar
- palette balance

It is a style reference, not a pixel-perfect screen layout and not a gameplay specification.

Gameplay behavior remains authoritative in the relevant game/system specifications.

---

## 1. North star

> **Crownless is a playable medieval manuscript: a rough, hand-inked world that gains knowledge and restrained color as the player explores, fights, survives, and returns to the Grey Hearth.**

The visual identity is:

> **medieval manuscript × woodcut × stylized action RPG × living map**

Priority order:

1. readable and playable game screen
2. recognizable Crownless character / world silhouettes
3. manuscript / woodcut visual identity
4. dark medieval atmosphere
5. detail and polish

Do not sacrifice gameplay readability for illustration detail.

---

## 2. Character lock — do not drift

This section exists because “stylized manuscript character” is easy to misread as either realistic concept art or cute modern chibi.

### Target

Characters must match the **CHARACTERS** row and battle character treatment in the canonical reference image.

They are:

- approximately **4–5 heads tall**
- compact, but **not chibi**
- simplified, but **not cute-anime mascots**
- rough medieval manuscript figures adapted for readable action gameplay
- defined first by silhouette, stance, equipment and outer contour
- rendered with irregular black ink and restrained interior detail

### Face

Faces should be:

- small relative to the head
- minimally described
- restrained in expression
- somewhat crude / folk-art-like
- readable without large anime eyes or expressive cartoon mouths

The desired feeling is **anonymous, weathered, human, slightly strange** — not adorable.

### Body and pose

- head may be modestly enlarged for phone readability, not oversized
- torso and limbs remain substantial enough to feel physical
- hands / weapons / shields may be exaggerated for silhouette readability
- poses should look grounded and action-capable
- asymmetry is welcome

### Equipment

Prefer:

- patched cloth
- wrapped hands
- scavenged belts and pouches
- mismatched armor pieces
- crude shields
- weathered weapons
- silhouette-changing gear

The player begins as an unknown survivor, not a polished hero.

### Explicit character negatives

Reject characters that read as:

- realistic 7–8-head-tall fantasy concept art
- painterly character illustration
- modern chibi / super-deformed characters
- cute indie-RPG mascots
- anime-gacha characters
- clean vector cartoons
- pixel-art block figures when the target is manuscript illustration

**“More stylized” must never automatically mean “cuter” or “bigger head.”**

---

## 3. Enemies and monsters

Enemy roles must be readable through silhouette and posture before labels.

Use the canonical reference image as the target for distortion level.

Prefer:

- medieval bestiary wrongness
- long, hunched, uneven animal anatomy
- strange heads and masks
- crude armor silhouettes
- asymmetric weapons
- distinct posture per role

The goal is memorable unease, not comedy.

---

## 4. Rendering language

Base rendering:

- stylized 2D / 2.5D
- irregular hand-inked contour lines
- parchment negative space
- woodcut / crosshatched shadows
- flat or lightly textured muted color planes
- visible brush / carved marks
- imperfect geometry
- limited gradients

Avoid:

- photorealism
- realistic AAA 3D
- PBR material rendering
- cinematic depth of field
- glossy bloom
- overly smooth vector illustration
- painterly fantasy concept-art rendering

The image should feel **drawn / printed**, not rendered by a realistic engine.

---

## 5. Semantic color

Color is information, not decoration.

- **ink black / charcoal** — structure, line, unknown
- **bone / parchment** — readable neutral space
- **ash grey** — fog, stone, uncertainty
- **muted vermilion** — danger, wounds, telegraphs
- **ember orange** — Grey Hearth, safety, secured progress
- **faded blue-green** — discovered land, known routes, recovered knowledge
- **dull ochre / restrained gold** — earned significance

Do not default to saturated blue / purple / orange rarity colors.

Unknown territory should remain mostly ink and ash. Discovery may return restrained blue-green and local color.

---

## 6. Combat — ink becomes motion

Combat uses the fixed oblique top-down battlefield from the combat specification.

The combat scene should match the canonical reference image's relationship between:

- parchment battlefield
- compact manuscript figures
- strong black attack strokes
- muted vermilion telegraphs
- sparse annotation UI

### Effects

- normal attacks: short, forceful black ink arcs
- stronger attacks: wider brush strokes, ink splash, broken hatch marks
- hit impact: ink scatter + body displacement + hit stop
- dust: dry brush texture
- danger telegraphs: hand-drawn vermilion circles / arcs / directional marks
- perfect evade: warning mark may break / tear / scatter

Do not use large glowing fantasy crescents for ordinary attacks.

### Controls are not negotiable visual decoration

Phone combat remains:

- drag on arena to move
- stop to auto-strike
- **技**
- **回避**

Do not add by convention:

- virtual joystick
- light-attack button
- large skill cluster
- combat minimap
- permanent consumable hotbar

---

## 7. Exploration — a world being written

The fantasy map is an authored manuscript artifact, not themed Google Maps.

Unknown territory:

- ink wash
- blank parchment
- unfinished routes
- uncertain symbols
- fog / torn negative space

Discovery should feel like knowledge being added:

1. terrain lines appear
2. route strokes appear
3. POI symbol appears
4. name / annotation is written or stamped
5. restrained color returns

Use faded blue-green for discovered knowledge rather than flooding the entire map with color.

---

## 8. Grey Hearth — a page becoming inhabited

The Grey Hearth begins sparse and poor.

Secured progress should physically add illustration to the place:

- fire
- shelter
- map marks
- loot shelf contents
- tools
- recovery cache
- forge
- signs of repeated use

It must not turn into a generic tile dashboard or luxurious tavern UI.

Ember orange is strongest here because it means safety and survival.

---

## 9. UI — annotation, stamp, ledger

UI should appear written, stamped, scratched or attached to the manuscript.

Prefer:

- parchment fields
- dark ink fields
- thin irregular rules
- stamps / seals
- manuscript glyphs
- short labels
- restrained distressed edges

Avoid:

- glossy rounded cards
- thick beveled metal frames
- jewel chrome
- oversized decorative gold borders
- generic mobile RPG dashboards

HUD examples from the canonical reference image are preferred over inventing a new UI material language.

---

## 10. Loot and rarity

Treat items as a field ledger / relic catalogue.

Significance should accumulate through marks:

- ordinary: no mark
- refined: maker stamp / seal
- rare: crest / provenance / distinctive border treatment
- signature: handwritten epithet / unique emblem / bespoke treatment

Do not let rarity color become the primary identity.

---

## 11. Image-generation contract

Before generating any Crownless image:

1. inspect `docs/assets/crownless-visual-design-reference-v0.1.jpg`
2. identify which part of the reference controls this task
3. preserve its character grammar and rendering grammar
4. describe the actual gameplay composition
5. add explicit negative constraints
6. review the output against the reference before accepting it

### Prompt anchor

Use wording equivalent to:

> **A playable medieval-fantasy game illustrated in the exact visual grammar of Crownless's canonical style board: rough medieval manuscript and woodcut linework, parchment negative space, restrained muted color, compact 4–5-head-tall non-chibi figures, small simple faces, weathered asymmetric equipment, readable silhouettes, physical black-ink action marks, and sparse annotation-like UI.**

### Required negative anchor

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

When a generated character looks cuter, rounder, more anime-like, more realistic, or more painterly than the canonical reference, **reject and regenerate rather than rationalizing the difference**.

---

## 12. Implementation contract

Implementation should approximate the visual reference with reusable low-cost techniques.

Prefer:

- illustrated / sprite actor layers
- Canvas / SVG linework
- shared paper and ink textures
- limited palette tokens
- CSS masks and simple filters
- procedural reveal masks
- simple particles
- flat projected combat plane

Do not attempt to reproduce the reference by merely tinting generic prototype graphics if the resulting silhouette language is still wrong.

**Character silhouette and drawing grammar are higher priority than surface filters.**

---

## 13. Mandatory visual review

Before accepting a visual, answer all of these:

1. Is it clearly a playable game screen rather than concept art?
2. Do characters match the canonical reference's 4–5-head-tall manuscript proportions?
3. Are faces simple and restrained rather than cute / anime-like?
4. Are silhouettes readable at phone size?
5. Does the linework feel hand-inked / woodcut rather than smooth or painterly?
6. Does color carry meaning rather than decoration?
7. Does combat use physical ink impact rather than default glowing VFX?
8. Does exploration look like knowledge being written onto a map?
9. Does Grey Hearth progression physically inhabit the space?
10. Does equipment feel scavenged and earned?
11. Does the visual preserve the actual gameplay contract?
12. Could a small prototype plausibly approximate it?
13. **Does it visibly belong to the same game as the canonical reference image?**
14. **Would it still be recognizable as Crownless without the logo?**

If #2, #3, #13 or #14 is no, the visual is not accepted.

---

## 14. Rejection test

> **If the visual could belong to another dark-fantasy RPG by swapping the logo, or if its characters belong to a different illustration family than the canonical reference, reject it.**
