# Crownless Global Visual Style

This file is the Visual Director adapter view of the canonical rules in
[`../visual-design-guide-v0.2.md`](../visual-design-guide-v0.2.md). The guide and
the canonical reference image remain authoritative.

## Global Visual Canon

The single global visual-family reference for Crownless is:

`docs/assets/crownless-visual-design-reference-v0.1.jpg`

This image is not mood-board inspiration. It is the **Global Visual Canon** used to judge whether every Crownless visual belongs to the same game.

It governs the shared visual grammar across:

- world map / GPS exploration
- battle screens and effects
- Grey Hearth / base progression
- characters and enemies, except where the accepted current actor set overrides old proportions
- UI, HUD, icons, inventory, loot and rarity presentation
- paper, ink, woodcut, annotation and restrained-color treatment

The canonical idea expressed by the board is:

> **Every screen is another page of the same living medieval manuscript. The world begins as rough ink, ash and parchment, and walking, discovering, fighting and surviving write knowledge and restrained color back into it.**

For exploration and maps in particular, do not interpret "dark fantasy" as a black cinematic map, satellite terrain, glowing borders or a conventional fantasy strategy UI. Unknown territory should feel **unwritten or unfinished**, while discovery adds terrain strokes, routes, symbols, names and faded blue-green knowledge to the manuscript.

### Authority order

When references disagree, use this order:

1. current gameplay / subsystem specification for behavior and composition
2. `docs/visual-design-guide-v0.2.md` for current global rules
3. `docs/assets/crownless-visual-design-reference-v0.1.jpg` for global illustration-family, material, palette, map/UI and physical-ink calibration
4. `assets/combat/minimal-v0.1/actors/` for current combat-character proportion, silhouette and viewpoint
5. older supporting boards only where they do not conflict with the above

A generated image is always a candidate. Do not promote it to Canon or use it as the parent of later generations merely because it was generated successfully.

## Global Visual Style Lock

```text
A playable medieval-fantasy game illustrated in Crownless's canonical visual grammar: every screen is a page of one living medieval manuscript, drawn with rough woodcut and irregular hand-inked contours on parchment negative space, crosshatched shadow, flat or lightly textured muted color, compact 3–3.5-head-tall non-chibi figures where characters appear, small restrained folk-art faces, weathered asymmetric equipment, readable phone-scale silhouettes, physical black-ink action marks, muted vermilion danger marks, faded blue-green discovered knowledge, and sparse annotation-like UI. The result must feel drawn, written and printed rather than realistically rendered, painterly, glossy, cinematic or vector-clean, and must visibly belong to the same illustration family as docs/assets/crownless-visual-design-reference-v0.1.jpg.
```

## Fixed Avoid Block

```text
AVOID: photorealism, realistic fantasy concept art, painterly rendering, realistic AAA 3D, modern chibi, cute mascot style, anime-gacha characters, clean vector cartoons, generic Diablo imitation, glossy mobile RPG UI, neon magic, cinematic black-map presentation, satellite-map rendering, glowing territory borders, oversized decorative gold frames, blue-purple-orange rarity-card language, excessive particles, high-frequency texture clutter
```

### Allowed Changes

- Pose, facing, and action phase within the fixed oblique top-down battlefield
- Readable hand, weapon, shield, and attack-gesture exaggeration at phone scale
- Minor wear, patch placement, and asymmetric garment details that preserve the subject silhouette
- Controlled black-ink, ash, parchment, faded blue-green and semantic accent variation within the canonical palette
- Generous transparent padding and sprite framing required for implementation
- Map detail and annotation density appropriate to the player's discovered knowledge

### Forbidden Changes

- Do not change the compact 3–3.5-head-tall non-chibi manuscript proportion or small restrained face grammar
- Do not turn anonymous, weathered figures into polished heroic, royal, cute, anime, or realistic fantasy characters
- Do not give the unarmed player a weapon, shield, crown, class costume, or polished armor
- Do not exchange the Rusher, Guard, and Skirmisher role silhouettes or combat-reading props
- Do not replace physical ink strokes and vermilion danger marks with glowing fantasy VFX
- Do not add UI, text, logos, virtual joysticks, attack buttons, minimaps, or skill clusters to sprite assets
- Do not turn the world map into a generic dark-fantasy, satellite, Google Maps, or strategy-game map with luminous borders

## Visual Director gate

Before preparing any Crownless generation package, Visual Director should apply the global reference path and this Global Visual Style Lock first, then layer subject-specific and subsystem-specific rules on top.

Reject the result before polishing when either is true:

- it could belong to another fantasy game by changing the logo
- it does not look like another page from `crownless-visual-design-reference-v0.1.jpg`
