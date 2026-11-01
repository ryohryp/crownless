# Adventurer A native-pixel idle study v1 (review only)

**Status:** unapproved native-pixel review candidate. Preserve existing Approved
Anchor `docs/assets/adventurer-a-approved-anchor-v1.png`, Canon and game runtime.

## Approval boundary

- On 2026-11-01 the user approved the **look** of the new single still concept
  ("おー、完璧"). That was approval of visual identity / composition, **not**
  approval of its approximately 124,758-color anti-aliased raster output or of
  a walk animation.
- The rejected algorithmic `adventurer-a-handcluster-v1` puppet / gait frames
  are not an artistic source, identity parent, or animation to continue.
- Original project Approved Anchor remains the only Visual Director generation
  identity parent. This native candidate was prepared as deterministic editing,
  not by prompting an image model with an unapproved candidate.

## New source and edits

- The user-approved still visual study (1024×1536 RGBA) was interpreted onto a
  128×192 native grid. A 24-color median-cut palette was selected **without
  dithering**, and alpha made binary to remove the AI soft edge halos.
- A conservative native-pixel cleanup merged 742 isolated *near-color* pixels
  into their larger adjacent clusters in three passes, protecting silhouette
  boundary pixels, the eye, single highlights and hardware details.
- All costume regions remain in their approved visual positions: charcoal hair
  and silver forelock, small bearded face, navy split coat, ivory sleeves,
  belt/pouches, back sword, strapped leather boots and grounded stance.
- This is a **pixel-cleaned transformation of a generated concept**, not a
  claim that a pixel artist individually designed every final cluster.

## Verification

- Native PNG: `adventurer-a-idle-native-128-v1.png` — 128×192 RGBA, 24 visible
  colors, all alpha values exactly 0 or 255; nonzero bbox (25,25)–(105,172).
- Editable Pixelorama file: `adventurer-a-idle-native-128-v1.pxo`, **one cel**.
- Actual Pixelorama **v1.2.3 Linux CLI** opened the `.pxo` and exported a PNG
  which compared pixel-for-pixel identical to the native candidate.
- `adventurer-a-idle-native-128-review-4x.png` is only a nearest-neighbor 4×
  zoom on warm neutral matte to make the logical grid visible; it is not the
  master sprite or a source for re-editing.

## What remains

- A human pixel-art review of hair and face readability, highlight clusters,
  silhouette and coat details at actual game size.
- Intentional manual Pixelorama cleanup of any remaining noisy clusters if
  desired. Palette/alpha checks alone do not establish artistic finish.
- After *single-cel* approval: individually draw opposing gait key poses and
  verify planted feet, shoulders/hips counter-rotation, distinct frames and
  consistency **before** creating in-betweens.
- **No merge, runtime asset replacement, Canon revision or walk-animation
  approval.**
