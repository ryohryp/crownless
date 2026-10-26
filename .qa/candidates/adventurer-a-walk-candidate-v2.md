# CROWNLESS Adventurer A — alternate-step animation candidate v2

Status: **Draft candidate, not approved or in runtime.** Supersedes and rejects v1: its second and fourth frames repeatedly led with the same foot and made an implausible walk.

## Asset contract

- `crownless-a-walk-4frames-160x192-v2.png`: RGBA, 640 × 192 pixels, four cells of 160 × 192 pixels in one row.
- `crownless-a-walk-160x192-v2.gif`: review animation only, NOT a game rendering source; color-quantized GIF.
- Frame rectangles: `(0,0,160,192)`, `(160,0,160,192)`, `(320,0,160,192)`, `(480,0,160,192)`.
- Order: 0 right-side foot extended/contact; 1 neutral gather; 2 left-side foot extended/contact; 3 neutral gather.
- Suggested frame durations: 120 ms, 90 ms, 120 ms, 90 ms. Approximate pivot `(80,171)` in each cell; verify with actual projected floor.
- Equipment-free base only; no weapon/shield drawn into these frames.

## Source and generation

The user chose the leftmost Adventurer A in the original three-option pixel concept. New left- and right-leading contact poses were generated separately, with their distinct screen-side foot contacts specified. The two distinct poses and existing neutral sprite were fitted to equal-height transparent cells using nearest-neighbor scaling. This uses image generation for character art and mechanical atlas preparation; it is not hand-keyed pixel animation.

Identity to preserve: charcoal hair with silver forelock, short stubble, navy split-coat, rolled cream sleeves, belts/pouches, dark trousers and strapped brown boots.

## Review result and limitations

- The screen-right leading boot in frame 0 swaps with a screen-left leading boot in frame 2. This directly addresses the missing alternation in rejected v1.
- Alpha transparency, frame bounds and phone-oriented reduction can be mechanically verified.
- **Not yet motion-approved:** the split coat's trailing tails and minor costume details jump abruptly between independently generated contact frames; frames 1 and 3 are reused neutral poses. A human should judge the loop on device before runtime adoption.
- No oblique battlefield camera test, equipment-layer registration, asset-quality workflow, gameplay integration, or Canon promotion yet.

Never use v1 GIF for review or ship either candidate to the main game without a coherent gait and playtest.
