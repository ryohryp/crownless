# Crownless Visual Reference Assets

These images are visual calibration assets for `docs/visual-design-guide-v0.2.md` and `skills/crownless-visual-design/SKILL.md`.

## Canonical overview

- `crownless-visual-design-reference-v0.1.jpg` — full-board overview. Use it to keep combat, map, Grey Hearth, UI, palette, texture, characters, enemies, and effects in one illustration family.

## Detail references

- `crownless-character-reference-v0.1.jpg` — **authoritative character-proportion and character-drawing detail**. Use this when creating or implementing player / NPC figures. The target is compact 4–5-head-tall medieval-manuscript figures, not modern chibi and not realistic concept art.
- `crownless-battle-reference-v0.1.jpg` — **authoritative combat actor / ink-effect detail**. Use this when implementing battle silhouettes, attack strokes, enemy telegraphs, and arena balance.

## Visual Director Approved Anchors

- `crownless-visual-design-reference-v0.1.jpg` — global visual reference for project `crownless`.
- `crownless-character-reference-v0.1.png` — lossless compatibility transcode of the canonical character JPG and Approved Visual Anchor for `player_unarmed`.
- `crownless-battle-reference-v0.1.png` — lossless compatibility transcode of the canonical battle JPG and shared Approved Visual Anchor for the ordinary combat archetypes `enemy_rusher`, `enemy_guard`, and `enemy_skirmisher`.

The shared anchors lock the approved illustration family. Subject-specific role
constraints live in `docs/visual/CHARACTER_VISUAL_CANON.md`. A generated output
is a review candidate and does not replace an anchor merely because it was saved
in the repository.

The PNG files preserve the intended decoded pixels of their corresponding
canonical JPG references. They exist because the source detail JPGs contain
non-standard entropy-byte stuffing that some decoders reject. The streams were
normalized and then transcoded to PNG so Visual Director and image tooling can
read the same reference consistently.

If a generated or implemented character conflicts with the character detail image, the character detail image wins for visual style. Gameplay behavior still follows the game and subsystem specifications.

Key guardrail: **more stylized does not mean cuter. Character silhouette and drawing grammar come before filters, tinting, or paper texture.**
