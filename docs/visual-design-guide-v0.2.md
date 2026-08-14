# Crownless — Visual Design Guide v0.2

> **Status:** canonical global visual baseline  
> **Updated:** 2026-08-14  
> **Scope:** characters, enemies, combat, exploration, Grey Hearth, UI, loot, image generation, implementation

## 0. Canonical visual references

The primary global visual reference is:

`docs/assets/crownless-visual-design-reference-v0.1.jpg`

Use it for line weight, manuscript / woodcut treatment, palette, map language, Grey Hearth material language, UI grammar, and physical ink effects.

### Current character override

The accepted combat actor set at:

`assets/combat/minimal-v0.1/actors/`

is authoritative for **character proportion, facial simplification, body deformation, visible silhouette width, and the current combat-character viewpoint**.

It supersedes older 4–5-head-tall proportion guidance visible in earlier calibration boards. Those older images remain useful for illustration-family calibration but must not pull current characters back toward longer anatomy or front-facing portrait presentation.

Gameplay behavior remains authoritative in the relevant system specifications.

---

## 1. North star

> **Crownless is a playable medieval manuscript: a rough, hand-inked world that gains knowledge and restrained color as the player explores, fights, survives, and returns to the Grey Hearth.**

Visual identity:

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

Characters must match the accepted combat actor set.

### Target

- approximately **3–3.5 heads tall**
- strongly deformed, compact **folk-doll proportions**
- large-headed with short limbs and simplified torso, hands, and feet
- rough medieval manuscript / woodcut figures adapted for readable action gameplay
- charming through shape and craft, not glossy cuteness
- defined first by silhouette, stance, equipment, and outer contour
- irregular black ink with restrained interior detail

This deformation is intentional. Do not “correct” it toward realistic anatomy.

### Face

Faces should be tiny and symbolic:

- simple eyes / brows
- little or no mouth detail
- no realistic skin texture
- no anatomical facial modeling
- restrained expression
- crude folk-art quality rather than anime-like polish

The desired feeling is **anonymous, rough, primitive, readable, and slightly strange** — not creepy, not uncanny, not glossy-cute.

### Body and pose

- enlarged head for phone readability
- short simplified limbs
- compact blocky torso
- exaggerated hands / weapons / shields when needed for silhouette
- clear action despite deformation
- useful asymmetry
- role identity that survives at small phone size

### Combat viewpoint lock

Combat characters are not standing portraits pasted onto a battlefield.

For combat actor art:

- author the figure in an **oblique top-down / three-quarter battlefield view**
- let head top, shoulders, back planes, shield top, bow orientation, and foot placement support the elevated camera
- reduce straight-on facial presentation
- make the feet / ground contact read clearly
- keep the role pose functional in the projected battlefield

Do not generate a front-facing or side-on standing illustration and plan to “fix” the camera with renderer skew or squash later.

### Equipment

Prefer patched cloth, wrapped hands, scavenged belts and pouches, mismatched armor pieces, crude shields, weathered weapons, and silhouette-changing gear.

The player begins as an unknown survivor, not a polished hero.

### Explicit character negatives

Reject:

- realistic 7–8-head fantasy concept art
- semi-realistic or anatomically corrected fantasy characters
- painterly character illustration
- uncanny human faces
- glossy modern chibi / cute SD mascots
- anime-gacha characters
- clean vector cartoons
- front-facing portrait poses used as combat sprites when the scene requires oblique top-down figures

**Strong deformation is correct; glossy cuteness and human realism are not.**

---

## 3. Enemies and monsters

Enemy roles must be readable through silhouette and posture before labels.

Humanoid enemies normally use the same 3–3.5-head folk-doll deformation as the player.

Role silhouette anchors:

- **Rusher** — forward lean, compact aggressive mass, fast melee threat
- **Guard** — broad planted shape, shield-dominant block
- **Skirmisher** — narrower mobile shape, bow / ranged-read silhouette

Prefer medieval-bestiary wrongness, asymmetry, crude armor, and distinct posture. The goal is memorable unease and readability, not body horror.

---

## 4. Rendering language

Base rendering:

- stylized 2D / 2.5D
- irregular hand-inked contours
- parchment negative space
- woodcut / crosshatched shadows
- flat or lightly textured muted color planes
- visible brush / carved marks
- imperfect geometry
- limited gradients

Avoid photorealism, realistic AAA 3D, PBR materials, cinematic depth of field, glossy bloom, overly smooth vector illustration, and painterly fantasy concept-art rendering.

The image should feel **drawn / printed**, not realistically rendered.

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

---

## 6. Combat — ink becomes motion

Combat uses the fixed oblique top-down battlefield from the combat presentation specification.

The scene combines:

- parchment battlefield
- compact 3–3.5-head manuscript / folk-doll figures authored for the oblique view
- strong black attack strokes
- muted vermilion telegraphs
- sparse annotation UI

### Actor sprite presentation contract

Accepted actor artwork must preserve authored deformation **after it enters the game**.

For illustrated combat actors:

- project the actor's **ground / foot position** into the oblique battlefield
- draw the actor body as a screen-space billboard above that projected point
- use one uniform scale for both axes
- preserve source visible aspect ratio and silhouette width
- never apply floor oblique squash / skew / non-uniform perspective to the body
- determine apparent size from visible / alpha content bounds, not raw square canvas size
- use an authored pivot or bottom-center of visible bounds
- keep feet, logical ground position, and shadow aligned
- preserve role-specific width: Guard broad, Rusher compact, Skirmisher narrower

Do not solve a sizing mismatch with arbitrary X-only or Y-only correction.

### Overlap and depth

When actors overlap in the oblique view:

- depth order follows projected **foot / ground Y**
- farther / smaller ground Y draws first; nearer / larger ground Y draws later
- use stable tie-breaking to avoid flicker
- do not use enemy-array order as a substitute for visual depth

### Crowded combat HUD

Floating UI is subordinate to actor silhouettes.

- priority threat / nearest enemy and bosses may show name + HP
- ordinary non-priority enemies should prefer compact HP only
- HUD placement uses rectangle collision, not point-only spacing
- resolve collisions with restrained vertical lanes first, then small horizontal nudges
- avoid covering role-defining heads, shields, bows, and telegraphs
- do not move combatants in simulation merely to make labels fit

### Effects

- normal attacks: short forceful black ink arcs
- stronger attacks: wider brush strokes, ink splash, broken hatch marks
- hit impact: ink scatter + body displacement + hit stop
- dust: dry brush texture
- danger telegraphs: hand-drawn vermilion circles / arcs / directional marks
- perfect evade: warning mark may break / tear / scatter

Do not use large glowing fantasy crescents for ordinary attacks.

Presentation effects must follow actual gameplay state. Avoid brittle logic that infers hit events solely from prototype drawing colors.

### Controls are not decorative

Phone combat remains drag movement, stop-to-auto-strike, **技**, and **回避**. Do not add joystick, light-attack button, skill cluster, minimap, or permanent consumable hotbar by convention.

---

## 7. Exploration — a world being written

The fantasy map is an authored manuscript artifact, not themed Google Maps.

Unknown territory uses ink wash, blank parchment, unfinished routes, uncertain symbols, fog, and torn negative space.

Discovery should visibly add:

1. terrain lines
2. route strokes
3. POI symbol
4. name / annotation
5. restrained faded blue-green color

---

## 8. Grey Hearth — a page becoming inhabited

The Grey Hearth begins sparse and poor. Secured progress should physically add illustration: fire, shelter, map marks, loot shelf contents, tools, recovery cache, forge, and signs of repeated use.

It must not turn into a generic tile dashboard or luxury tavern UI.

Ember orange is strongest here because it means safety and survival.

---

## 9. UI — annotation, stamp, ledger

UI should appear written, stamped, scratched, or attached to the manuscript.

Prefer parchment fields, dark ink fields, thin irregular rules, stamps / seals, manuscript glyphs, short labels, and restrained distressed edges.

Avoid glossy rounded cards, thick beveled metal frames, jewel chrome, oversized gold borders, and generic mobile-RPG dashboards.

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

1. inspect the global visual reference
2. inspect the accepted combat actor set when characters appear
3. for combat characters, lock the oblique top-down / 3/4 source-art viewpoint
4. identify which reference controls each requested element
5. preserve 3–3.5-head deformation and rendering grammar
6. describe actual gameplay composition
7. add explicit negative constraints
8. compare output to accepted actors before accepting it

### Prompt anchor

Use wording equivalent to:

> **A playable medieval-fantasy game in Crownless's canonical visual grammar: rough medieval manuscript and woodcut linework, parchment negative space, restrained muted color, strongly deformed 3–3.5-head-tall folk-doll figures with large heads and short limbs, tiny symbolic faces, weathered asymmetric equipment, readable silhouettes, physical black-ink action marks, and sparse annotation-like UI. Combat figures are authored for a diagonal oblique top-down three-quarter battlefield view rather than as front-facing portraits.**

### Required negative anchor

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
- no front-facing portrait pose for an oblique combat sprite unless explicitly requested for a non-combat purpose

Reject drift rather than rationalizing it.

---

## 12. Implementation and asset contract

Prefer illustrated / sprite actor layers, Canvas / SVG linework, shared paper and ink textures, limited palette tokens, CSS masks, procedural reveal masks, small particles, and the existing projected combat plane.

For actor sprites:

- project position, not anatomy
- render art in screen space with uniform scale
- alpha-trim or use visible-content bounds
- use a stable foot pivot
- preserve role-specific silhouette width
- verify final rendered proportion from a phone screenshot

For combat actor PNG assets:

- verify they actually decode
- verify meaningful non-transparent silhouette coverage and plausible alpha bounds
- do not rely on file byte size as a quality / integrity proxy
- when a runtime screenshot shows colored garbage, missing body, or only shadow / labels, inspect the source PNG before changing renderer math

**Character silhouette, deformation, viewpoint, aspect ratio, ground anchoring, depth ordering, and drawing grammar are higher priority than surface filters.**

---

## 13. Mandatory visual review

Before accepting a visual, confirm:

1. it is a playable game screen when gameplay is requested
2. humanoid characters match 3–3.5-head folk-doll proportions
3. faces are tiny and symbolic
4. silhouettes read at phone size
5. combat source art uses the intended oblique viewpoint
6. runtime actor proportions match source art without X/Y stretching or floor distortion
7. feet / shadows align with logical ground position
8. overlapping actors depth-sort by ground / foot Y
9. crowded enemy HUD does not create a label carpet or cover role-defining silhouettes unnecessarily
10. linework belongs to the hand-inked / woodcut family
11. color has semantic purpose
12. combat uses physical ink impact rather than default glow
13. combat PNG assets are intact and visibly non-empty
14. exploration looks like knowledge being written onto a map
15. Grey Hearth progression physically inhabits the space
16. equipment feels scavenged and earned
17. the result preserves actual gameplay contract
18. the result belongs beside the accepted combat actors
19. it remains recognizable as Crownless without the logo

If character proportion, viewpoint, runtime geometry, or illustration family is wrong, reject before polishing.

---

## 14. Rejection test

> **If the visual could belong to another dark-fantasy RPG by swapping the logo, if the actor drifts toward realistic anatomy, if a combat actor is a pasted front-facing portrait, if source deformation is distorted by runtime transforms, or if crowded UI hides the fight, reject it.**
