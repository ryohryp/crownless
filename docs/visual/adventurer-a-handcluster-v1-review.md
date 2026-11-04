# Adventurer A: hand-clustered 8-frame gait candidate (v1)

Status: **unapproved review-only candidate**. This is a new motion/pixel-language
study responding to feedback that v0's upper body was static and its pixels dirty.
Nothing here replaces `docs/assets/adventurer-a-approved-anchor-v1.png`, changes
Visual Canon, or is loaded by production runtime.

## Identity and provenance

- Identity parent: the **Approved Anchor**, not the previous rejected pose sheet.
- Charcoal swept hair, one white forelock, dark stubble, navy split overcoat,
  ivory sleeves, leather belts/pouch/boots, and visible back scabbard.
- Same rightward oblique viewpoint and deformed adventurer proportions.
- Drawn at native 64×96 using hand-authored polygon and pixel-cluster placements,
  **not** by resizing, quantizing, or pixelating a generated illustration.
- The previous `.pxo` is read only as a Pixelorama 1.2.3 container-schema template;
  all eight image cels are fully replaced with newly drawn pixels.
- Reproducible source: `generate_adventurer_a_walk.py` (requires Python Pillow).

## Timing and movement

- 8 frames at 8 fps (125 ms each).
- Near/far leg leading foot alternates at frames 0 and 4; knee, ankle and boot
  are independent of the other leg rather than translations of one still body.
- Near/far upper arms and forearms swing counter to the legs; wrist and elbow
  bend through the cycle.
- Shoulders counter-rotate, chest and sling shift, head tilts/bobs, split coat
  tails swing in opposite phases. Fixed feet use the same baseline with a
  brief lifted passing pose.
- Palette: 26 explicitly defined RGBA colors, 25 visible, transparent pixels
  have strictly binary alpha; no blur, hidden gray pixels, or dithering.

## Verification

- All 8 native frames differ. Upper-center body pixel differences across
  opposite gait phases are asserted (not just a moving shoe region).
- Native atlas: 512×96. Frame: 64×96. The review GIF is enlarged only by
  nearest-neighbor 5× for inspecting each integer pixel.
- Pixelorama v1.2.3 Linux headless opened the saved `.pxo` and exported an
  **identical** 512×96 RGBA atlas (pixel-for-pixel comparison).
- Binary alpha, palette bound and native grid checked in script.

## Remaining review limits

- This is a **stylized gameplay-scale redraw**, not a claim of exact pixel-level
  reproduction of the more detailed approved 128×192 illustration.
- Mechanical upper-body movement does not prove natural acting; foot contact,
  shoulder roll, coat inertia, facial expression and character fidelity still
  need human animation review at the actual phone scale.
- No local ComfyUI generation, purchase, human approval, registration, merge,
  game-asset replacement or production deployment was performed.
