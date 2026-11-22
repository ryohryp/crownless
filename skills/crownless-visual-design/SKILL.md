---
name: crownless-visual-design
description: Create or review Crownless visuals for a readable Western medieval fantasy × Japanese sumi-e on washi game experience.
---

# Crownless Visual Design

Use this Skill when creating or reviewing Crownless visuals.

## Goal

Create a coherent medieval fantasy world that works clearly on a smartphone. For the playable action-forest exploration stage, the user's 2026-11-06 direction is **classic pixel art**; do not apply the older sumi-e/washi presentation to this stage. Other screens keep their existing approved visual anchors until separately changed.

Prioritize:

- readability during play,
- clear distinction between enemies, loot, locations, and actions,
- atmosphere that supports danger, discovery, and reward,
- consistency across generated assets.

Do not preserve old Crownless art styles unless they improve the current game.

Generate only the assets needed for the current playable slice. Evaluate visuals inside the actual game, not in isolation.

If the visual direction is undefined, establish the smallest useful direction and let real play decide what survives.

## Castle-approach field-scene target (2026-11-12)

The user shared a new target screenshot: a richly atmospheric sunset castle, a
stone bridge over a misty waterfall, dense foreground woods, and a small
pixel-like party. For **3/4-view field exploration** the 2026-11-12 target
supersedes the earlier strict environment-only 16-bit/no-HD-2D prescription,
but does not automatically replace approved player identities or every screen.
See `docs/visual-canon.md` and `docs/visual/castle-bridge-reference-2026-11-12.md`.

Treat the screenshot as a visual **goal, not a texture to paste into the game**:
near/mid/far separation, actual walkable bridge geometry, camera parallax,
cast-shadow grounding, parapet/actor overlap, and purposefully restrained phone UI
must work during movement. First test on an opt-in comparison stage. Do not
change default play, existing saves, GPS behavior or approved actor identities
to match a standalone concept. Do not call a glossy single-plane mockup accepted.

## Classic pixel-art exploration-stage contract (2026-11-06)

- Prioritize a recognizable, handcrafted **16-bit-era pixel-art** appearance: intentional pixel clusters, a limited coherent palette, crisp nearest-neighbor scaling, readable silhouettes, and restrained frame animation. Avoid blurry resampling, generic vector scenery, and HD-2D bloom as the target style.
- Improve the *actual playable forest* first: distinct trees, traversable ground, landmark silhouettes, readable depth layers, and environmental variation that makes the next area enticing. Do not substitute standalone concept art for an in-game result.
- Use the **2026-11-14 user-approved red-scarf protagonist** for the playable forest (`assets/action-forest/hero-red-scarf-atlas.png` is the new runtime derivative); keep `docs/assets/player-unarmed-approved-pixel-anchor-v1.png` as the earlier approved reference for comparison. Do not silently replace identity on other screens.
- Expand stage length only alongside meaningful discoveries and return-with-materials decisions; do not pad with empty walking distance.
- Keep existing path/fog/hidden-route navigation, combat return, and current save/material behavior unchanged unless a separately tested gameplay change requires it.
- Review a screenshot at 360/390/430 CSS px and compare against the previous playable stage. A green CI result does not establish excitement or visual quality.

## Current source and image QA

Read AGENTS.md, current docs/visual-canon.md and specialized visual Canon, then use docs/visual/asset-quality-gate.md for new/changed important PNG/JPEG assets. Newer map guidance overrides older map prescriptions; approved actor identity anchors remain binding. No automatic Canon promotion.
