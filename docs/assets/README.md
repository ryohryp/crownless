# Crownless Visual Reference Assets

These images calibrate `docs/visual-design-guide-v0.2.md` and `skills/crownless-visual-design/SKILL.md`.

## Global Visual Canon

- `crownless-visual-design-reference-v0.1.jpg` — **the approved Global Visual Canon for Crownless**. This is the first image to inspect for every visual task and the reference behind Visual Director's `global_reference_path`.

This board establishes that every screen belongs to the same **living medieval manuscript / rough woodcut world**. It is authoritative for the shared illustration family: irregular hand ink, parchment negative space, woodcut / crosshatched shadow, restrained semantic color, world-map grammar, battle presentation, Grey Hearth/base growth, sparse annotation-like UI, physical ink effects, item/rarity framing, and paper/print material treatment.

Its core rule is:

> **Every screen is another page of the same manuscript. Exploration writes the world into existence: unknown land is unfinished, and walking / discovery restores terrain lines, routes, symbols, names and restrained faded blue-green color.**

Treat this as a calibration anchor, not optional inspiration. A generated image that merely has parchment colors but belongs to another fantasy game's illustration family must be rejected.

When a detail conflicts with current textual Canon or accepted combat actors, the more specific current rule wins. In particular, the accepted actor set overrides any older character proportions visible on supporting boards.

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

- `crownless-visual-design-reference-v0.1.jpg` — **Global Visual Canon / `global_reference_path`**; applies to every generation package before subject-specific rules
- `crownless-character-reference-v0.1.png` — compatibility transcode of the legacy character sheet
- `crownless-battle-reference-v0.1.png` — compatibility transcode of the legacy battle sheet

The PNG transcodes preserve the intended decoded pixels of their corresponding JPG references and exist for tooling compatibility. They do **not** restore the superseded 4–5-head proportion as current canon.

Subject-specific role constraints live in `docs/visual/CHARACTER_VISUAL_CANON.md`.

A generated output remains a review candidate until explicitly accepted. Do not automatically chain arbitrary generated candidates into later generations.

Key guardrails:

- **more stylized does not mean cuter**
- every visual must look like another page of the Global Visual Canon
- exploration reveals an unfinished manuscript; it is not a cinematic black map, satellite map, Google Maps skin, or glowing strategy map
- character silhouette and drawing grammar come before filters / tinting / paper texture
- combat character source art must match the oblique battlefield viewpoint
- a visually broken runtime actor may be a corrupt PNG rather than a renderer problem; inspect the asset before compensating in code
