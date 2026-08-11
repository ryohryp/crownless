# Crownless — Visual Design Guide v0.1

> **Status:** global visual baseline / living document  
> **Updated:** 2026-08-12  
> **Scope:** Grey Hearth, exploration, combat, inventory, reports, image generation, UI implementation

This document is the canonical visual-design reference for Crownless. It does not replace gameplay or subsystem specifications. Gameplay behavior remains authoritative in:

- `game-system-design.md`
- `exploration-location-spec.md`
- `combat-presentation-spec.md`
- `hearth-presentation-spec.md`

For execution rules, also use `../skills/crownless-visual-design/SKILL.md`.

---

## 1. The visual thesis — a living medieval manuscript

Crownless must not look like a smaller Diablo, a generic dark-fantasy mobile RPG, or a simplified realistic 3D game.

The world should look as if a **medieval manuscript, woodcut print, field map, and marginal illustration have become playable**.

The core visual fantasy is:

> **The player walks through the real world and gradually causes an unfinished fantasy manuscript to reveal itself, gain ink, gain marks, and gain restrained color.**

Every major surface should feel as if it belongs to the same authored object:

- exploration is a map being drawn and discovered
- combat is an illustration suddenly moving and fighting
- the Grey Hearth is a page that becomes more inhabited as secured progress accumulates
- inventory is a field ledger / relic catalogue rather than a glossy card collection
- reports feel like annotations added after an expedition

This is the primary Crownless signature.

### The rejection test

Before accepting a visual, ask:

> **Could this exact image belong to another medieval action RPG with only the logo changed?**

If yes, it is not Crownless enough.

---

## 2. Visual keywords

Use these words when making or reviewing Crownless visuals:

- living manuscript
- medieval marginalia
- woodcut
- hand-inked
- rough line
- unfinished map
- worn parchment
- physical impact
- asymmetrical
- weathered
- readable
- humble
- discovered, not decorated

Avoid making these the dominant impression:

- photorealistic
- AAA 3D
- glossy
- ornate
- royal
- heroic-by-default
- anime-gacha UI
- neon magic
- polished fantasy chrome
- generic Diablo clone

---

## 3. Rendering language

### 3.1 Base rendering

The target is **stylized 2D / 2.5D illustration** built from:

- black or near-black ink outlines
- irregular hand-drawn contour lines
- flat or lightly textured color planes
- woodcut / hatching shadows
- limited gradients
- visible negative space
- simplified material detail
- slightly imperfect geometry

The scene may use digital depth, layering, transforms, shadow, scale, and perspective, but it should still feel illustrated rather than rendered by a realistic 3D engine.

### 3.2 Character proportion

Characters should normally sit around **4–5 heads tall**.

They are not chibi, but they are deliberately more compact and graphic than realistic humans. Exaggerate what matters at gameplay size:

- hands
- weapon silhouette
- shoulders
- stance
- cloak / hood shape
- enemy posture

Small costume details that disappear on a phone are lower priority.

### 3.3 Surface treatment

Prefer:

- uneven ink density
- crosshatching
- carved / scratched line patterns
- torn-paper edges where useful
- imperfect stamp marks
- rough brush fills

Avoid relying on:

- realistic PBR metal
- detailed skin rendering
- fine cloth simulation
- cinematic depth of field
- realistic bloom
- high-frequency texture noise

---

## 4. The world gains color through discovery

Most of Crownless should begin visually restrained.

### Core palette roles

| Role | Direction | Meaning |
|---|---|---|
| Ink black | near-black / charcoal | structure, UI, line work, unknown world |
| Bone / parchment | warm off-white | page, readable space, neutral information |
| Ash grey | stone / fog / unresolved state | distance, ambiguity, dead ground |
| Vermilion | muted朱赤 | danger, wounds, enemy telegraphs, serious commitment |
| Ember orange | warm灰炉色 | home, fire, safety, secured progress |
| Faded blue-green | desaturated teal | discovered land, water, known routes, recovered world knowledge |
| Ochre / restrained gold | dull ochre | rare earned significance, not generic luxury |

### Color rule

Color is **earned information**.

The world should not be fully saturated by default.

A strong target relationship is:

> **unknown = mostly ink and ash**  
> **discovered = restrained blue-green and local natural color**  
> **danger = vermilion**  
> **home / secured progress = ember orange**  
> **exceptional significance = small ochre / gold marks**

This lets exploration create a visible feeling of restoring information to the world.

---

## 5. Shape language

Crownless should prefer silhouettes that feel hand-cut, drawn, and worn rather than perfectly engineered.

### World

- stone: chunky irregular blocks, broken outlines
- wood: rough beams, splintered silhouettes
- vegetation: grouped brush / hatch masses
- fog: torn or brushed negative space
- ruins: asymmetric, partially collapsed forms
- roads: hand-drawn routes, not clean GIS lines

### People

The player begins poor and anonymous.

Prefer:

- patched cloth
- wrapped hands
- mismatched protection
- scavenged belts / pouches
- asymmetrical equipment
- visible silhouette change from equipment

Do not begin with a polished heroic costume.

### Monsters

Monsters should take inspiration from the **strangeness of medieval bestiaries and marginal drawings**, not only modern realistic creature design.

A wolf can be too long, too hunched, or have an unnerving illustrated face. A humanoid can feel like a crude manuscript warning brought to life.

The goal is not comedy. The goal is memorable wrongness.

---

## 6. Combat — ink becomes motion

Combat uses the fixed oblique top-down battlefield defined in `combat-presentation-spec.md`.

The battlefield should look like an illustration with enough depth to support spatial play.

### 6.1 Movement and attack expression

Combat effects should extend the manuscript language.

Prefer:

- normal attack trails as short black ink strokes
- heavy impacts as ink splashes / broken hatch marks
- dust as dry brush texture
- knockback emphasized by body displacement and rough motion marks
- brief white / parchment flashes for impact separation
- limited screen shake

Do not make ordinary attacks produce large glowing fantasy crescents.

### 6.2 Enemy telegraphs

Enemy warning zones should look **drawn onto the battlefield**, especially in muted vermilion.

Examples:

- hand-drawn arcs
- brush circles
- broken directional lines
- scratch marks
- stamped danger symbols

A perfect evade may briefly tear, break, or scatter the warning mark.

### 6.3 Technique and 決着

Technique can make the ink language more forceful:

- wider brush movement
- stronger black / vermilion contrast
- torn-paper-like impact edge
- stronger hit stop

決着 may briefly exceed normal restraint because the payoff is earned, but it should still look like Crownless—not generic magic VFX.

### 6.4 Control fidelity

Generated art must never silently change the current combat model.

Phone combat remains:

- drag on arena to move
- stop to auto-strike
- **技**
- **回避**

Do not add by default:

- virtual joystick
- light-attack button
- skill cluster
- combat minimap
- party portrait stack
- permanent consumable hotbar

---

## 7. Exploration — the map is the world

Exploration should make the living-manuscript idea strongest.

The fantasy map should feel incomplete before the player moves.

### Unknown territory

Use:

- dense ink wash
- incomplete coastline / road lines
- empty parchment
- torn fog shapes
- distant silhouettes
- tiny uncertain marks

### Frontier hints

A nearby unknown place may first appear as:

- smoke
- tower silhouette
- tracks
- a half-drawn road
- a symbol without a label
- a scratched note

### Discovery

When the player reveals territory, the game can visibly:

1. draw terrain lines
2. reveal route strokes
3. add the POI symbol
4. write or stamp the place name
5. introduce restrained local color

The visual reward is not simply “fog removed.” It is **the manuscript gaining knowledge**.

### GPS relationship

The map must feel fantasy-authored rather than like Google Maps with themed icons.

Real-world movement is input to discovery; the final map is Crownless's own artifact.

---

## 8. Grey Hearth — the page becomes inhabited

The Grey Hearth is not a generic tavern and not a dashboard.

Its visual story is:

> **an almost empty mark of safety slowly becomes a lived-in place because the player returned alive.**

The Hearth should begin sparse:

- a small fire
- minimal shelter
- Mist Gate / dangerous threshold
- the player
- very little secured evidence

As Renown and secured progress grow, the page gains objects:

- map marks
- shelf contents
- recovery cache
- forge fire
- tools
- signs of repeated use

Progress should feel like **new illustration added to an existing page**, not like unlocking another menu tile.

Ember orange should be strongest here.

---

## 9. UI — annotation, stamp, ledger

UI should feel like information written, stamped, scratched, or attached to the manuscript.

### Prefer

- thin ink rules
- hand-marked dividers
- parchment / dark-ink fields
- stamps
- seals
- simple glyphs
- short labels
- asymmetrical placement when readable
- restrained distressed edges

### Avoid

- thick beveled metal frames
- jewel chrome
- oversized gold borders
- floating glossy cards everywhere
- uniform rounded rectangles as the dominant language

### HUD

HP may read as a **red brush / ink line**, not a jeweled fantasy bar.

闘志 can use a darker ink / ash mark that fills or sharpens.

Action controls should resemble strong readable **stamps / sigils** rather than futuristic mobile buttons.

The center of combat remains visually open.

---

## 10. Typography and written marks

The visual system may use expressive serif / manuscript-like display lettering for titles and place names, but Japanese legibility takes precedence.

Use decorative lettering sparingly.

Suggested hierarchy:

1. title / place name
2. important object / enemy / item name
3. short body text
4. small annotation / metadata

Short handwritten-like notes may appear as flavor, but active screens must remain easy to scan.

---

## 11. Item and rarity language

Crownless is a loot game, but it should not visually become a color-rarity card game.

### Item presentation

Prefer an illustrated catalogue / field-ledger treatment:

- item silhouette or ink drawing
- name
- relevant stat comparison
- modifier / identity
- small material or origin notes when useful

### Rarity / significance

Do not default to:

- blue = rare
- purple = epic
- orange = legendary

Instead, significance can accumulate through marks:

- **ordinary:** no special mark
- **good / refined:** maker stamp or small seal
- **rare:** distinctive crest / border ink / provenance mark
- **signature / legendary:** handwritten epithet, unique emblem, irregular illustration treatment

Color may support rarity, but shape and marks must carry meaning too.

This keeps the loot system visually connected to the manuscript world.

---

## 12. Icons and symbols

Icons should look like simplified manuscript glyphs, stamps, or woodcut signs.

Good subjects:

- weapon family
- danger
- Hearth
- discovered / unknown
- route
- secured / unsecured
- Technique
- Evade
- return / retreat

Do not over-detail small heraldry.

A symbol should still be readable at phone size.

---

## 13. Screen composition signature

Across screens, favor:

> **one large spatial / illustrated surface + one primary focal action + restrained annotations**

Examples:

- Hearth: room illustration + Mist Gate + small object notes
- exploration: map + frontier + contextual action
- combat: arena + 技 / 回避 + minimal survival state
- loot: item drawing + comparison + one decision

Avoid building every screen as a stack of equal cards.

---

## 14. Readability is non-negotiable

The manuscript language must not become an excuse for visual noise.

At gameplay size, the player must quickly answer:

- where am I?
- what threatens me?
- where can I go?
- what is interactable?
- what changed?
- what did I earn or lose?

If crosshatching, paper texture, decorative marks, or distressed edges reduce that readability, simplify them.

The game should feel hand-made, not muddy.

---

## 15. Implementation budget

The visual identity must remain achievable for an individual / small prototype.

Prefer reusable techniques:

- sprite / illustration layers
- SVG or Canvas line work
- shared ink textures
- simple CSS masks / filters
- limited color tokens
- reusable stamp / icon grammar
- procedural fog / reveal masks
- simple particles
- flat projected combat plane

Do not require a realistic 3D asset pipeline merely to match concept art.

A rough but consistent Crownless style is better than a technically polished generic style.

---

## 16. Image-generation contract

When generating Crownless visual references, always establish the style before describing content.

### Required core direction

Use language equivalent to:

> **A playable medieval-fantasy world illustrated like a living medieval manuscript and woodcut print: hand-inked irregular linework, parchment negative space, crosshatched shadows, limited muted color, 4–5-head-tall stylized characters, readable game silhouettes, restrained UI annotations, not realistic 3D.**

### Required global constraints

- living medieval manuscript / woodcut identity
- stylized 2D / 2.5D
- hand-inked irregular outlines
- parchment / ink / ash base
- restrained vermilion, ember orange, faded blue-green, ochre accents
- compact readable silhouettes
- asymmetric weathered equipment
- indie-realistic production scope
- gameplay readability first

### Required negatives

- not photorealistic
- not realistic AAA 3D
- not generic Diablo visual imitation
- not glossy mobile RPG UI
- not anime-gacha card presentation
- no oversized decorative gold frames
- no neon magical spectacle by default
- no excessive particle effects

### Combat additions

- fixed oblique top-down battlefield
- combat effects expressed as ink / brush / hatch marks
- enemy telegraphs as hand-drawn vermilion marks
- major actions only **技** and **回避**
- no virtual joystick
- no dedicated light-attack button
- no combat minimap
- no large skill cluster

Generated images are references for style, composition, hierarchy, silhouette, and atmosphere. They do not redefine gameplay systems.

---

## 17. Review checklist

Before accepting any Crownless visual, check:

1. Does it immediately feel illustrated rather than realistically rendered?
2. Does it resemble a living manuscript / woodcut rather than generic dark fantasy?
3. Are silhouettes readable at phone size?
4. Is color communicating discovered knowledge, danger, safety, or earned significance?
5. Is the UI annotation-like rather than glossy / card-heavy?
6. Does combat use physical ink-like impact rather than default glowing VFX?
7. Does exploration feel like a map gaining knowledge?
8. Does the Hearth visibly accumulate evidence of safe progress?
9. Does equipment look scavenged / earned rather than heroic-by-default?
10. Could a small prototype approximate this style without a AAA art pipeline?
11. Does the visual preserve the actual gameplay contract?
12. Most importantly: **would this still be recognizable as Crownless if the logo were removed?**

If several answers are no, simplify and push the visual identity harder before polishing.

---

## 18. One-sentence north star

> **Crownless is a rough medieval manuscript that becomes a living world as the player explores, fights in strokes of ink, survives, and brings color and evidence of life back to the Grey Hearth.**
