# Action forest: pixel-art experiment, 2026-10-23

The user explicitly requests an HD-2D-like pixel RPG evolution, delegates technical direction, and asks for a reviewable PR without additional paid subscriptions. This scoped experiment translates the ink-derived charcoal, warm earth and muted moss into pixel environments. It does not promote generated images to global Visual Canon or replace approved character anchors.

The scene uses original modular tree/rock/ruin sprites, atmospheric distance, world-space paths and the existing bridge height function. Original actor code, combat timing, save namespace and location privacy remain intact. The generated sheet is a candidate; its actual layout did not follow the requested equal grid, so runtime source rectangles explicitly follow observed silhouettes. No direction variants are used as animation frames.

The attached one-image forest prototype is useful as distant atmosphere, but not as walkable geometry or a tile set. Its original binary is retained; its old integration code is not applied. A single stretched image cannot supply parallax or match the bridge. Both original PNGs remain unmodified.

## Tool decision

- Keep Canvas 2D: current rules/input/save work and no measured renderer bottleneck requires migration. Static ground texture is cached once; scene dressing uses six explicit source rectangles. No general engine/editor framework.
- Phaser is MIT and a viable future WebGL scene alternative if measured performance or animation needs warrant it: https://phaser.io/download/license
- Pixelorama is free/open source and suitable for future hand-authored pixel sources: https://orama-interactive.itch.io/pixelorama . It was researched, not installed or used; this PR does not claim a native Pixelorama source project.
- Godot/full native migration would require rebuilding the working web integration before proving this slice. Deferred.
- Visual Director MCP successfully prepared a non-character package for `crownless`, using `assets/living-map-terrain.svg` as material/palette reference. Built-in image generation created the sheet; no paid PixelLab subscription, remote editor MCP or new service was installed. Existing GitHub tools, local Playwright and TypeSafe Jev handle review and checks.

## Source and acceptance

`forest-objects-v1.png` is one generated transparent atlas. Source reference was the rendered repository SVG, never the handoff candidate. Generation prompt and provenance are in the quality manifest. The atlas is 1536x1024; actual source rectangles are in `src/pixel-forest.js`. The source PNG is editable in raster editors but is not layered source art.

The candidate is evaluated in this PR's actual scene at 360/390/430 CSS pixels, not by replacing a map background. Human 15-minute replay desire and physical phone performance remain separate acceptance observations. No art or fun approval is inferred from CI/Jev.
