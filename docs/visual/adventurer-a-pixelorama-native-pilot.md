# Adventurer A — editable Pixelorama walk candidate (v0)

**Status: unapproved review candidate.** Not a runtime sprite, not an Approved Anchor replacement, and not a claim of hand-authored pixel clusters or accepted gait.

## Provenance

- **Identity authority:** `docs/assets/adventurer-a-approved-anchor-v1.png` and `docs/visual/CHARACTER_VISUAL_CANON.md`.
- **Pose/image source:** existing unapproved `docs/assets/candidates/adventurer-a-local-poc/ik-masked-review.png` in draft PR #1060. No new AI generation was performed or chained from this candidate.
- **Transformation:** cropped each of the eight 128×160 contact cells to a 128×128 frame (removing the label strip); removed the neutral-gray presentation background, assigned binary transparency, and used one shared 128-color, no-dither palette.
- **Pixelorama file format:** ZIP/JSON structure based on the public [Pixelorama v1.2.3 example](https://github.com/Orama-Interactive/Pixelorama/blob/v1.2.3/Misc/example_pxo_files/animated_layer_effect.pxo) (Orama Interactive, CC-BY-4.0). The example's artwork, palettes and shader effects are not retained; the frame pixels come from the Crownless candidate above.

## Review-only files

- `docs/assets/candidates/adventurer-a-local-poc/adventurer-a-contact-pixelorama-v0.pxo` — editable eight-frame Pixelorama project.
- `docs/assets/candidates/adventurer-a-local-poc/adventurer-a-contact-pixelorama-v0.png` — native-resolution, transparent 1024×128 sprite sheet exported from the `.pxo` by Pixelorama CLI.
- `docs/assets/candidates/adventurer-a-local-poc/adventurer-a-contact-pixelorama-v0.gif` — 3× nearest-neighbor review animation on a warm matte; not a runtime asset.

## Verified technical properties

- Pixelorama v1.2.3 on Linux opened the `.pxo`, returned size **128×128** and **8 frames**, then exported one 1024×128 RGBA PNG.
- All eight frames are nonempty and have distinct pixel hashes.
- The shared sheet passed the opt-in deterministic gate (`nativeSize: [1024,128]`, `maxColors: 128`, `alphaMode: binary`): 128 visible RGBA colors, zero partial-alpha pixels, no issues.
- Foreground bounding-box bottoms vary between pixel rows 105 and 107; this is **not** a foot-contact or natural-walk approval.

## Required before adoption

1. Review at actual phone scale against the approved Adventurer A identity, with a loop playing at 8 fps.
2. Correct foot planting, leg alternation, counter-swing, silhouette stability and coat/sword continuity directly in Pixelorama. The source contains AI-derived anti-aliased rendering reduced to a palette; technical pixel validity does not prove intentional pixel artistry.
3. Re-export, rerun quality checks and explicitly obtain human approval before any runtime image registration or Canon change.

The current local ComfyUI MCP session was unavailable during this preparation. The `contact-v2` workflows in this draft PR were not rerun or accepted.
