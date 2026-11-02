---
name: crownless-visual-design
description: Create or review Crownless visuals for a readable Western medieval fantasy × Japanese sumi-e on washi game experience.
---

# Crownless Visual Design

Use this Skill when creating or reviewing Crownless visuals.

## Goal

Create a coherent medieval fantasy world in the approved sumi-e/washi visual language that works clearly on a smartphone.

Prioritize:

- readability during play,
- clear distinction between enemies, loot, locations, and actions,
- atmosphere that supports danger, discovery, and reward,
- consistency across generated assets.

Do not preserve old Crownless art styles unless they improve the current game.

Generate only the assets needed for the current playable slice. Evaluate visuals inside the actual game, not in isolation.

If the visual direction is undefined, establish the smallest useful direction and let real play decide what survives.

## Current source and image QA

Read AGENTS.md, current docs/visual-canon.md and specialized visual Canon, then use docs/visual/asset-quality-gate.md for new/changed important PNG/JPEG assets. Newer map guidance overrides older map prescriptions; approved actor identity anchors remain binding. No automatic Canon promotion.

## ChatGPT animation preview handoff

When sharing an animated sprite preview in ChatGPT:

1. Verify that the actual output file exists at its exact path and that the GIF decodes as an animation (more than one frame). Checking the source sprite sheet alone is insufficient.
2. Embed the **verified** GIF in the reply using Markdown image syntax with a sandbox URL, e.g. `![歩行アニメ](sandbox:/mnt/data/<verified-path>/walk_preview.gif)`. Never output a bare `/mnt/data/...` path as the only way to view it.
3. Provide a separate clickable `[GIFを開く](sandbox:/mnt/data/<same-verified-path>/walk_preview.gif)` fallback. If inline animation is unavailable in the client, also offer a verified contact-sheet PNG or individual frames.
4. Distinguish file validity from client playback: a locally valid animated GIF does **not** prove that a user's app rendered or animated it. Do not claim display success without evidence.

This is a delivery checklist, not artwork approval. Keep walk-loop, pixel-quality, contact and phone-scale acceptance gates separate.
