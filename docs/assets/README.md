# Crownless Visual Reference Assets

These assets calibrate `docs/visual-design-guide-v0.2.md` and `skills/crownless-visual-design/SKILL.md`.

## Global Visual Canon

- `crownless-visual-design-reference-v0.1.jpg` — **the approved Global Visual Canon for Crownless** and the first visual reference to inspect for every visual task.

It establishes the shared living-medieval-manuscript / rough-woodcut family: irregular hand ink, parchment negative space, crosshatched shadow, restrained semantic color, world-map grammar, battle presentation, Grey Hearth/base growth, sparse annotation-like UI, physical ink effects, and paper/print material treatment.

When a detail conflicts with current textual Canon or accepted combat actors, the more specific current rule wins. In particular, the accepted actor set overrides older character proportions visible on supporting boards.

## Approved protagonist visual Anchor

- `player-unarmed-approved-anchor-v0.4.png` — **the approved protagonist identity Anchor**.
- `player-unarmed-approved-anchor-v0.4.json` — approval and integrity record for that Anchor.

The v0.4 Anchor establishes the anonymous unarmed survivor's compact folk-doll silhouette, wrapped hands, patched clothing, scavenged belt/pouch, restrained palette, and manuscript/woodcut treatment for the oblique battlefield camera. It is an identity/reference asset, not a runtime sprite atlas.

The previous `player-unarmed-approved-anchor-v0.3.png` and its manifest remain in the repository because the v0.4 generation record directly names v0.3 as provenance. They are historical provenance, not current Canon.

Earlier WebP protagonist references failed local decode validation and have been removed from `main`. Git history preserves them for forensic comparison; they must not be restored or used as generation parents. The validated v0.4 PNG Anchor is the authoritative readable identity source.

## Directional protagonist combat source

- `assets/combat/minimal-v0.1/actors/player-unarmed-combat-sprite-sheet-v0.1.png` — transparent 768×512 directional-pose source retained for diagnosis and future re-authoring.
- `assets/combat/minimal-v0.1/player-unarmed-direction-reference.json` — measured cell rectangles, visible bounds, directional-pose families, ground-pivot policy, and runtime rejection record.

Pixel review confirmed that each eight-column row rotates the subject through directional views rather than supplying eight temporal animation frames. Replaying those columns over time makes the actor spin. The sheet also drifts from the Approved Visual Anchor's protagonist identity. It remains **not runtime-eligible**.

## Accepted protagonist runtime animation

- `assets/combat/minimal-v0.1/actors/player-unarmed-combat-sprite-sheet-v0.3.png` — accepted 2048×2048 RGBA temporal atlas for the MVP combat runtime.
- `assets/combat/minimal-v0.1/player-unarmed-animation.json` — 4×4 frame grid, authored foot pivot, measured alpha bounds, timing policy, provenance hash, and fallback contract.

The four rows are `idle`, `walk`, `jab`, and `hurt`; the four columns are time-progressing frames in one fixed oblique battlefield facing. The atlas was explicitly accepted on 2026-08-24 after identity, transparency, foot-point, clipping, and non-rotation review. `player-unarmed.png` remains the fail-safe static runtime fallback. Attack trails and impact ink are still drawn by their existing separate presentation layers.

## Legacy detail references

- `crownless-character-reference-v0.1.jpg`
- `crownless-battle-reference-v0.1.jpg`

These remain useful for **linework, manuscript / woodcut treatment, material texture, and broad combat composition**, but their older 4–5-head character proportion is no longer authoritative.

For player and ordinary combat-enemy proportion, deformation, silhouette width, facial simplification, and combat viewpoint, use:

`assets/combat/minimal-v0.1/actors/`

The current target is approximately **3–3.5 heads tall**, strongly deformed folk-doll anatomy, with combat sprites authored for the **oblique top-down / three-quarter battlefield view**.

## Visual Director compatibility anchors

- `crownless-visual-design-reference-v0.1.jpg` — **Global Visual Canon / `global_reference_path`**.
- `crownless-character-reference-v0.1.png` — compatibility transcode of the legacy character sheet.
- `crownless-battle-reference-v0.1.png` — compatibility transcode of the legacy battle sheet.

The PNG transcodes preserve the intended decoded pixels of their corresponding JPG references and exist for tooling compatibility. They do **not** restore the superseded 4–5-head proportion as current Canon.

Subject-specific role constraints live in `docs/visual/CHARACTER_VISUAL_CANON.md`.

## Asset lifecycle

- Keep current Canon, Approved Anchors, runtime sources, and tooling-required compatibility assets on `main`.
- Do not keep rejected, corrupt, or superseded generated assets on `main` solely for history; Git history is the default archive.
- Keep older assets only when a current manifest, generation provenance record, runtime path, or tooling dependency requires them.
- Update documentation, manifests, tests, and Visual Director bindings together when an authoritative asset changes.
- A generated output remains a Candidate until explicitly accepted; do not automatically chain arbitrary Candidates into later generations.

Key guardrails:

- **more stylized does not mean cuter**
- every visual must look like another page of the Global Visual Canon
- exploration reveals an unfinished manuscript; it is not a cinematic black map, satellite map, Google Maps skin, or glowing strategy map
- character silhouette and drawing grammar come before filters / tinting / paper texture
- combat character source art must match the oblique battlefield viewpoint
- a visually broken runtime actor may be a corrupt PNG rather than a renderer problem; inspect the asset before compensating in code
