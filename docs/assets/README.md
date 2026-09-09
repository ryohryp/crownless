# Crownless Visual Reference Assets

These assets calibrate `docs/visual-design-guide-v0.2.md` and `skills/crownless-visual-design/SKILL.md`.

## Global Visual Canon

- `crownless-visual-design-reference-v0.1.jpg` — **the approved Global Visual Canon for Crownless** and the first visual reference to inspect for every visual task.

It establishes the shared living-medieval-manuscript / rough-woodcut family: irregular hand ink, parchment negative space, crosshatched shadow, restrained semantic color, world-map grammar, encounter presentation, Grey Hearth/base growth, sparse annotation-like UI, physical ink effects, and paper/print material treatment.

When a detail conflicts with current textual Canon or an approved subject Anchor, the more specific current rule wins.

## Approved protagonist visual Anchor

- `player-unarmed-approved-anchor-v0.4.png` — **the approved protagonist identity Anchor**.
- `player-unarmed-approved-anchor-v0.4.json` — approval and integrity record for that Anchor.

The v0.4 Anchor establishes the anonymous unarmed survivor's compact folk-doll silhouette, wrapped hands, patched clothing, scavenged belt/pouch, restrained palette, and manuscript/woodcut treatment. It is an identity/reference asset, not a runtime sprite atlas.

The previous `player-unarmed-approved-anchor-v0.3.png` and its manifest remain in the repository because the v0.4 generation record directly names v0.3 as provenance. They are historical provenance, not current Canon.

Earlier WebP protagonist references failed local decode validation and have been removed from `main`. Git history preserves them for forensic comparison; they must not be restored or used as generation parents. The validated v0.4 PNG Anchor is the authoritative readable identity source.

## Removed real-time combat assets

The dedicated runtime asset set formerly stored under `assets/combat/minimal-v0.1/` was removed from `main` on 2026-09-09 under ADR 0005 after player-controlled real-time combat was rejected.

Do not restore its actor sprites, temporal atlases, directional-pose diagnostics, weapon drops, or combat effect sheets as active runtime dependencies. Git history is sufficient for forensic reference. If future presentation needs a protagonist runtime asset, author it for the current Location × Expedition experience and use the approved v0.4 Anchor as the identity reference.

## Legacy detail references

- `crownless-character-reference-v0.1.jpg`
- `crownless-battle-reference-v0.1.jpg`

These remain useful for **linework, manuscript / woodcut treatment, material texture, encounter composition, and print-like visual grammar**, but their older 4–5-head character proportion and real-time battle framing are no longer authoritative gameplay guidance.

For protagonist identity, deformation, silhouette width, facial simplification, and clothing language, use the approved v0.4 protagonist Anchor plus current textual Canon.

## Visual Director compatibility anchors

- `crownless-visual-design-reference-v0.1.jpg` — **Global Visual Canon / `global_reference_path`**.
- `crownless-character-reference-v0.1.png` — compatibility transcode of the legacy character sheet.
- `crownless-battle-reference-v0.1.png` — compatibility transcode of the legacy battle sheet.

The PNG transcodes preserve the intended decoded pixels of their corresponding JPG references and exist for tooling compatibility. They do **not** restore superseded character proportions or real-time combat as current Canon.

Subject-specific role constraints live in `docs/visual/CHARACTER_VISUAL_CANON.md`.

## Asset lifecycle

- Keep current Canon, Approved Anchors, current runtime sources, and tooling-required compatibility assets on `main`.
- Do not keep rejected, corrupt, or superseded generated assets on `main` solely for history; Git history is the default archive.
- Keep older assets only when a current manifest, generation provenance record, runtime path, or tooling dependency requires them.
- Update documentation, manifests, tests, and Visual Director bindings together when an authoritative asset changes.
- A generated output remains a Candidate until explicitly accepted; do not automatically chain arbitrary Candidates into later generations.

Key guardrails:

- **more stylized does not mean cuter**
- every visual must look like another page of the Global Visual Canon
- exploration reveals an unfinished manuscript; it is not a cinematic black map, satellite map, Google Maps skin, or glowing strategy map
- character silhouette and drawing grammar come before filters / tinting / paper texture
- hostile encounters may be shown in expedition reports or consequence scenes, but visual design must not imply a return to player-controlled real-time combat
- inspect source assets before compensating for a visual problem in code
