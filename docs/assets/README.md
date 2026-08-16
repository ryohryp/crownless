# Crownless Visual Reference Assets

These images calibrate `docs/visual-design-guide-v0.2.md` and `skills/crownless-visual-design/SKILL.md`.

## Canonical overview

- `crownless-visual-design-reference-v0.1.jpg` — **approved World Direction / global visual-family board**. Use it as the first visual reference for linework, palette, materials, world-map grammar, battle presentation, Grey Hearth/base growth, character/enemy drawing grammar, physical ink effects, sparse UI, item-rarity framing, parchment/woodcut texture, and the principle that every screen belongs to the same manuscript. If a detail conflicts with current textual Canon or accepted combat actors, the more specific current rule wins.

## Approved protagonist sprite reference

- `player-unarmed-sprite-sheet-reference-v0.1.webp` — approved appearance and motion-sheet reference for the unarmed protagonist. It establishes the compact 3–3.5-head silhouette, subdued scavenged clothing, unarmed pose language, directional readability, and core action family.

This sheet is a **visual / animation reference**, not a runtime sprite atlas. It contains presentation labels and sheet-level composition, so gameplay frames must be produced separately as transparent, text-free, consistently grounded assets before integration.

## Accepted protagonist combat sprite source

- `assets/combat/minimal-v0.1/actors/player-unarmed-combat-sprite-sheet-v0.1.png` — accepted transparent combat sprite source sheet for the unarmed protagonist (optimized runtime-source derivative, 768×512).

The sheet is approved as source art for runtime slicing. It does not replace the Approved Visual Anchor or current `player-unarmed.png` automatically; frame coordinates, ground points, animation timing, and the first in-game slice (`idle` / `walk` / `jab` / `hurt`) remain implementation and validation work.

## Legacy detail references

- `crownless-character-reference-v0.1.jpg`
- `crownless-battle-reference-v0.1.jpg`

These remain useful for **linework, manuscript / woodcut treatment, material texture, and broad combat composition**, but their older 4–5-head character proportion is no longer authoritative.

### Current character authority

For player and ordinary combat-enemy proportion, deformation, silhouette width, facial simplification, and combat viewpoint, use:

`assets/combat/minimal-v0.1/actors/`

The current target is approximately **3–3.5 heads tall**, strongly deformed folk-doll anatomy, with combat sprites authored for the **oblique top-down / three-quarter battlefield view**.

If an older reference conflicts with the accepted combat actors on anatomy or combat viewpoint, the accepted combat actors win.

## Visual Director compatibility anchors

- `crownless-visual-design-reference-v0.1.jpg` — approved World Direction / global visual-family anchor
- `crownless-character-reference-v0.1.png` — compatibility transcode of the legacy character sheet
- `crownless-battle-reference-v0.1.png` — compatibility transcode of the legacy battle sheet

The PNG transcodes preserve the intended decoded pixels of their corresponding JPG references and exist for tooling compatibility. They do **not** restore the superseded 4–5-head proportion as current canon.

Subject-specific role constraints live in `docs/visual/CHARACTER_VISUAL_CANON.md`.

A generated output remains a review candidate until explicitly accepted. Do not automatically chain arbitrary generated candidates into later generations.

Key guardrails:

- **more stylized does not mean cuter**
- character silhouette and drawing grammar come before filters / tinting / paper texture
- combat character source art must match the oblique battlefield viewpoint
- a visually broken runtime actor may be a corrupt PNG rather than a renderer problem; inspect the asset before compensating in code
