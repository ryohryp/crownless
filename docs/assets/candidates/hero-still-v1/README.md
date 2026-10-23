# Protagonist still review, not an adopted sprite

The user rejected both code-drawn character versions, then approved the workflow: coherent still first, walking second, coarse equipment/accessory layers afterward. This deliverable is that first visual checkpoint. It is not a completed animated character.

## Provenance and editable source

- Visual Director returned a successful `crownless` / `player-unarmed` / `character_sprite` package. Approved identity reference: `docs/assets/player-unarmed-approved-anchor-v0.4.png`. The user's current pixel-art direction is explicit and candidate-scoped; no global Canon or Approved Anchor was changed.
- Built-in image generation produced `source.png` and one corrective attempt `source-v2.png`, both preserved unchanged. Exact prompts: `generation-prompt.txt` and `generation-prompt-v2.txt`. Both generations reference the approved original, never the rejected code drawings or another generated candidate.
- The corrective prompt requested simpler low-resolution clusters and no halo. It still produced a detailed 1024x1536 image with partial transparency. Do not claim a native 64x96 sprite, a restricted palette, or successful halo cleanup.
- `python scripts/pack-hero-review.py` packages the second original in `hero-review.ora`, with one coherent-body layer. It does not redraw or resample any original pixels. Pixelorama supports importing OpenRaster: https://www.oramainteractive.com/Pixelorama-Docs/user_manual/Import .
- Pixelorama v1.2.3 portable Windows x64 was downloaded from the official GitHub release; SHA256 matched the release asset digest. It is retained locally under `.qa/tools/pixelorama/` (ignored), with no system installation or paid subscription. Official release: https://github.com/Orama-Interactive/Pixelorama/releases/tag/v1.2.3 .
- The actual Pixelorama executable loaded the OpenRaster document and exported `hero-review.png` using its headless CLI. The exported image is 1024x1536 RGBA; alpha values match the original but RGB bytes are not identical. Original PNGs remain read-only. Headless Godot logs include nonfatal shader/UI warnings; no interactive GUI session or native `.pxo` editing is claimed.

Reproduce the export after obtaining the official portable executable:

```powershell
python scripts/pack-hero-review.py
& '.\.qa\tools\pixelorama\v1.2.3\Pixelorama-Windows-64bit\Pixelorama.exe' --headless --quit -- --export "$PWD\docs\assets\candidates\hero-still-v1\hero-review.ora"
```

## Preview and verification

- `hero-art-review.html`: full-figure concept and approximate game-size comparison, with link to the real scene.
- `gemini-feel-lab.html?actor=still`: opt-in protagonist-only still review. Default mode never loads/draws this candidate. Existing facing/jump/down transforms remain available, but the image has no walk/attack frames; the page explicitly says so. Uniform display scaling does not convert the source into hand-authored low-resolution animation.
- `node scripts/verify-hero-still.cjs`: actual Canvas draw calls, source loaded, no horizontal overflow/page errors, candidate absent in normal mode, and review-page images checked at 360/390/430px. Screenshots recorded from fresh browser contexts.
- `npm test`: 1,402 passed, zero failed/skipped. Syntax and diff checks passed.
- The new preview smoke is part of mobile CI.

## Honest visual status

Source Jev Vision completed successfully (`jev-1.14.0`), composed `needs_review`: raw `revise` confidence .35, primary issue style confidence .24; quality 2.62/4 and artifact probability .60. The existing global rubric retains sumi-e while the user requested pixel art, but this does not erase anatomy/artifact concerns. Actual 360/390/430 screenshots returned `revise` confidence .61, crop primary issue .82, readability 3.22/4. The full protagonist is visibly present in the inspected 390px screenshot; edge clipping of other world actors is also visible. Keep crop feedback for review rather than treating it as approval or regenerating without a specific demonstrated correction.

Raw judgments and actual 390px screenshot are under `review/`. The character still has more detail and partial-alpha shading than a production low-resolution sprite should have. Human approval of face/body/style is pending. Walking, coarse separated equipment layers, physical-phone FPS and a new full playable actor set are not delivered in this checkpoint. Do not merge or deploy this as a finished replacement.
