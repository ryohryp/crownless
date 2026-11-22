# Castle-bridge visual target — 2026-11-12

**Status:** User-directed visual goal. **Not implemented, art-approved or adopted.**
**Source:** User-provided 1536 × 864 Crownless concept screenshot in the 2026-11-12 chat.
The screenshot binary is not archived in the repository; do not substitute another image
and call it the user's reference. Work tracked in [#1114](https://github.com/ryohryp/crownless/issues/1114).
Previously unapproved 2.5D work: draft [#1094](https://github.com/ryohryp/crownless/pull/1094).

## What the reference conveys

- **World-first composition:** a cliffside approach with a recognizable distant castle
  across a high old stone bridge, waterfall, mountains and thin rolling mist.
  A player can answer “where do I want to go?” without reading a card.
- **Coherent materials:** stonework, ivy, wood, foliage and warm sunlight occupy a
  single world, with atmosphere setting near/mid/far contrast. The large
  environment is painterly/HD-2D-like; small party actors have crisp pixel-art
  silhouettes. **Do not force the environment into an 8-bit grid.**
- **Grounded characters:** an adventuring party stays small versus landscape,
  with feet on the same projected surface, cast/contact shadows,
  correct parapet occlusion and a camera that reveals depth as the player moves.
  Keep the approved protagonist's identity when adapting scale/material.
- **Quiet fantasy HUD:** small top-left quest text, compact top resource strip,
  map/status in a corner, common actions near thumbs. The reference's gold
  icons, fixed joystick, labels and numerical resources are illustrative, not
  mandatory new mechanics or values.
- **Playable curiosity:** walking over the bridge needs a meaningful sign,
  risk or changed destination to justify playing again. The image alone is not
  evidence that the game loop is fun.

## First implementation (one testable vertical slice)

Entry: optional demo/comparison route (separate from default `expedition.html`).
No changes to production saves or stationary GPS trigger.

1. Start on an authored foreground forest trail that reaches the bridge.
   Castle silhouette remains visible; the camera/terrain construction has
   distinct near-, middle- and far-field behavior.
2. Allow short direct movement and an inspectable clue **on the bridge**.
   Walking, clue touch bounds, bridge collision and shading use one world-to-
   screen projection. Foreground parapets can overlap actors physically.
3. At the far end, reveal a reason to revisit/prepare for the castle rather
   than simply end a corridor. Connect the eventual outcome to the existing
   explore → gather/fight → return alive → craft → revisit loop.
4. Test on 360/390/430 CSS px phone portraits, landscape and reloaded page.
   Keep the viewport playable without document scrolling, maintain useful
   touch areas, respect safe areas and don't render unimplemented HUD items
   as if they work.

## Visual comparison gate

| Criterion | A pass requires |
| --- | --- |
| Depth | A moving camera visibly changes foreground/background relationship; distant castle is not glued to the bridge |
| Contact | Actor feet, ground, shadow and parapet masks stay registered throughout the bridge walk |
| Material unity | Stone/foliage/actor texture and pixel density don't look like pasted elements |
| Navigation | From the entrance, the bridge and reachable destination read immediately |
| Phone use | Objectives/actions remain legible and reachable at 360/390/430 CSS px, portrait and landscape |
| Gameplay | At least one discovery or choice changes the desire/option for a later expedition |
| Release | Actual browser input, test suite and human visual/15-min play reviews complete before production adoption |

## Keep scope deliberately small

Use the existing Canvas2D experiment infrastructure if it remains sufficient.
Do not migrate to Unity/Godot/3D/WebGL until a measured blocker requires it.
A separate image-generation or art pass should produce **editable layered
environment assets** for castle, bridge, trees and waterfall rather than an
image with UI and character baked in. Background art quality is not solved
by CSS gradients, pixelation or extra UI chrome. Preserve the option to
reject an experiment and keep the live game unchanged.
