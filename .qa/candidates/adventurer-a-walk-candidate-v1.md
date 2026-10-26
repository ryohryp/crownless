# CROWNLESS Adventurer A — walk-sprite candidate v1

Status: **Unapproved candidate.** The user preferred Adventurer A in the concept comparison; this is a new derivative animation and has not received independent motion approval. Do not replace the current approved player anchor or runtime character automatically.

## Art identity

Adult wandering swordsman: dark messy hair with a prominent silver forelock, short stubble, dark-navy sleeveless split traveling coat, rolled off-white sleeves, brown belts and packs, wrapped hands, dark trousers and strapped boots. He is deliberately unarmed in this base sheet, allowing future equipment layers. This character is a different candidate from the older red-headband protagonist.

## Sprite layout

- PNG: `crownless-a-walk-4frames-128x192-v1.png`
- Grid: 4 columns, one row, 128 × 192 px per frame; atlas is 512 × 192 px.
- Frame rectangles (x, y, width, height): `(0,0,128,192)`, `(128,0,128,192)`, `(256,0,128,192)`, `(384,0,128,192)`.
- Sequence: idle / left step / passing step / right step. Suggested prototype timing: 160 ms per frame (6.25 fps), looping.
- All frames have transparent margins and a nominal bottom-center ground anchor `(64, 172)` inside each cell. Revalidate the anchor in the actual character renderer.
- Concept direction: three-quarter view facing right. This sprite set is for a visual test, not approved directional combat animation.

## Generation and mechanical preparation

Based on Adventurer A (leftmost character) in the user-favored 3-option pixel-art comparison. Generated as a four-pose transparent strip with the same character identity, without sword or shield. Individual poses were mechanically cropped from the 2172 × 724 px generation, resized using nearest-neighbor sampling to fit a 128 × 192 cell, and packed left to right. The original generator output is not an engine atlas and the first pose must not be interpreted as a separate new approved still.

Prompt summary: mature wandering swordsman with black-and-silver messy hair, stubble, deep navy split coat, cream shirt, brown leather equipment; 4 corresponding temporal idle/walk poses at fixed scale, transparent background, distinct silhouette, square-pixel art, no labels or weapons.

## Verification and unresolved decisions

- Verified PNG format, 512 × 192 pixels, non-opaque alpha; inspected every frame and a 64 × 96 px reduction.
- Generated GIF is a quick visual cycle proof, not the source of truth for the atlas. The GIF has color quantization and should not ship as the rendering source.
- Not verified inside a running game scene at 360–430 CSS px, with controls or combat labels.
- Not run through the repository asset-quality gate or human on-phone playtest.
- Potential issue: navy tails may blend into dark backgrounds; review contrast on the actual map/combat field.
- Equipment must be a separate layer, with matching pivot and per-frame registration, before claiming visible equipment changes.

No Canon update, automatic adoption, merge or production asset replacement is authorized by this candidate alone.
